import { Router, type IRouter } from "express";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import {
  attachmentCleanupEventsTable,
  attachmentUploadsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import {
  ensureProjectAccess,
  ProjectAccessError,
  type ProjectAccess,
} from "../lib/project-access";
import {
  canViewCleanupOperations,
  cleanupWarning,
  CLEANUP_WARNING_THRESHOLD,
} from "../lib/cleanup-operations";
import { tenantDatabase as db, withProjectContext } from "../lib/tenant-database";

const router: IRouter = Router();

router.get("/workspace/operations/storage-cleanup", requireAuth, async (_req, res, next): Promise<void> => {
  try {
    const access = await ensureProjectAccess(res.locals.clerkUserId) as ProjectAccess;
    if (!canViewCleanupOperations(access.membership.role)) {
      res.status(403).json({ error: "Hanya QA Engineer yang dapat melihat status pembersihan storage." });
      return;
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [pendingResult, totals, repeatedFailures, recentFailures] = await withProjectContext(
      access.project.id,
      () => Promise.all([
        db.select({ count: count() }).from(attachmentUploadsTable).where(eq(
          attachmentUploadsTable.projectId,
          access.project.id,
        )),
        db.select({
          deleted: sql<number>`count(*) filter (where ${attachmentCleanupEventsTable.outcome} = 'deleted')::int`,
          preserved: sql<number>`count(*) filter (where ${attachmentCleanupEventsTable.outcome} = 'preserved')::int`,
          failed: sql<number>`count(*) filter (where ${attachmentCleanupEventsTable.outcome} = 'failed')::int`,
        }).from(attachmentCleanupEventsTable).where(and(
          eq(attachmentCleanupEventsTable.projectId, access.project.id),
          gte(attachmentCleanupEventsTable.createdAt, since),
        )),
        db.select({
          uploadId: attachmentCleanupEventsTable.uploadId,
          failureCount: count(),
        }).from(attachmentCleanupEventsTable).where(and(
          eq(attachmentCleanupEventsTable.projectId, access.project.id),
          eq(attachmentCleanupEventsTable.outcome, "failed"),
          gte(attachmentCleanupEventsTable.createdAt, since),
        )).groupBy(attachmentCleanupEventsTable.uploadId)
          .having(sql`count(*) >= ${CLEANUP_WARNING_THRESHOLD}`),
        db.select({
          uploadId: attachmentCleanupEventsTable.uploadId,
          error: attachmentCleanupEventsTable.errorMessage,
          occurredAt: attachmentCleanupEventsTable.createdAt,
        }).from(attachmentCleanupEventsTable).where(and(
          eq(attachmentCleanupEventsTable.projectId, access.project.id),
          eq(attachmentCleanupEventsTable.outcome, "failed"),
          gte(attachmentCleanupEventsTable.createdAt, since),
        )).orderBy(desc(attachmentCleanupEventsTable.createdAt)).limit(10),
      ]),
    );

    const summary = totals[0] ?? { deleted: 0, preserved: 0, failed: 0 };
    res.json({
      windowHours: 24,
      pending: pendingResult[0]?.count ?? 0,
      deleted: summary.deleted,
      preserved: summary.preserved,
      failed: summary.failed,
      warning: cleanupWarning(summary.failed, repeatedFailures.length),
      repeatedFailures,
      recentFailures: recentFailures.map((failure) => ({
        ...failure,
        occurredAt: failure.occurredAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      res.status(403).json({ error: error.message });
      return;
    }
    next(error);
  }
});

export default router;