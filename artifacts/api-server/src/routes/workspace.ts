import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  attachmentUploadsTable,
  auditEventsTable,
  projectInvitationsTable,
  projectMembershipsTable,
  qaqcRecordsTable,
  recordAttachmentsTable,
  usersTable,
} from "@workspace/db";
import {
  CreateWorkspaceRecordBody,
  CreateWorkspaceRecordParams,
  CreateRecordAttachmentBody,
  CreateRecordAttachmentParams,
  CreateRecordAttachmentResponse,
  DeleteWorkspaceRecordParams,
  DeleteRecordAttachmentParams,
  DownloadRecordAttachmentParams,
  PreviewRecordAttachmentParams,
  GetWorkspaceResponse,
  InviteProjectMemberBody,
  InviteProjectMemberResponse,
  RequestRecordAttachmentUploadBody,
  RequestRecordAttachmentUploadParams,
  RequestRecordAttachmentUploadResponse,
  UpdateWorkspaceRecordBody,
  UpdateWorkspaceRecordParams,
  UpdateWorkspaceRecordResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import {
  canMutate,
  canManageAttachment,
  ensureProjectAccess,
  ProjectAccessError,
  type ProjectAccess,
} from "../lib/project-access";
import {
  attachmentObject,
  ATTACHMENT_UPLOAD_GRACE_PERIOD_MS,
  createAttachmentUploadUrl,
  isAllowedAttachmentType,
  MAX_ATTACHMENT_SIZE,
  streamAttachment,
  streamAttachmentPreview,
} from "../lib/object-storage";
import { createHeicPreviewWithRetry, needsHeicPreview } from "../lib/attachment-preview";
import { logger } from "../lib/logger";
import {
  createdRecordAudit,
  deletedRecordAudit,
  updatedRecordAudit,
} from "../lib/record-audit";
import { executeAuditedMutation } from "../lib/record-transaction";
import { onlyProjectRows } from "../lib/project-scope";
import { tenantDatabase as db, withProjectContext } from "../lib/tenant-database";

const router: IRouter = Router();
const pendingPreviewJobs: Array<() => Promise<void>> = [];
let previewJobActive = false;

function attachmentPreviewUrl(
  attachment: Pick<typeof recordAttachmentsTable.$inferSelect, "id" | "recordId" | "recordType" | "previewStatus">,
) {
  if (attachment.previewStatus === "failed" || attachment.previewStatus === "processing") return null;
  return `/api/workspace/${attachment.recordType}/${attachment.recordId}/attachments/${attachment.id}/preview`;
}

function runNextPreviewJob() {
  if (previewJobActive) return;
  const job = pendingPreviewJobs.shift();
  if (!job) return;
  previewJobActive = true;
  setImmediate(() => {
    void job().finally(() => {
      previewJobActive = false;
      runNextPreviewJob();
    });
  });
}

function queueHeicPreview(input: {
  attachmentId: string;
  projectId: string;
  sourceObjectPath: string;
}) {
  pendingPreviewJobs.push(async () => {
    const candidatePath = `/objects/uploads/${input.attachmentId}-preview`;
    try {
      await withProjectContext(input.projectId, async () => {
        const preview = await createHeicPreviewWithRetry(
          attachmentObject(input.sourceObjectPath),
          attachmentObject(candidatePath),
          candidatePath,
        );
        const [updated] = await db.update(recordAttachmentsTable).set({
          previewObjectPath: preview.objectPath,
          previewStatus: preview.status,
          previewError: preview.error,
        }).where(and(
          eq(recordAttachmentsTable.id, input.attachmentId),
          eq(recordAttachmentsTable.projectId, input.projectId),
          eq(recordAttachmentsTable.previewStatus, "processing"),
        )).returning({ id: recordAttachmentsTable.id });
        if (!updated && preview.objectPath) {
          await attachmentObject(preview.objectPath).delete({ ignoreNotFound: true });
        }
      });
    } catch (error: unknown) {
      logger.error({
        err: error,
        attachmentId: input.attachmentId,
        projectId: input.projectId,
      }, "Attachment preview background job failed");
      await attachmentObject(candidatePath).delete({ ignoreNotFound: true }).catch(() => undefined);
      await withProjectContext(input.projectId, async () => {
        await db.update(recordAttachmentsTable).set({
          previewObjectPath: null,
          previewStatus: "failed",
          previewError: "Pratinjau gagal diproses. File asli tetap dapat diunduh.",
        }).where(and(
          eq(recordAttachmentsTable.id, input.attachmentId),
          eq(recordAttachmentsTable.projectId, input.projectId),
          eq(recordAttachmentsTable.previewStatus, "processing"),
        ));
      }).catch((updateError: unknown) => {
        logger.error({
          err: updateError,
          attachmentId: input.attachmentId,
          projectId: input.projectId,
        }, "Attachment preview failure status could not be saved");
      });
    }
  });
  runNextPreviewJob();
}

async function queueLegacyHeicPreview(
  attachment: typeof recordAttachmentsTable.$inferSelect,
) {
  if (
    attachment.previewStatus !== "original"
    || !needsHeicPreview(attachment.contentType, attachment.fileName)
  ) {
    return false;
  }
  const [claimed] = await db.update(recordAttachmentsTable).set({
    previewStatus: "processing",
    previewError: null,
  }).where(and(
    eq(recordAttachmentsTable.id, attachment.id),
    eq(recordAttachmentsTable.projectId, attachment.projectId),
    eq(recordAttachmentsTable.previewStatus, "original"),
  )).returning({ id: recordAttachmentsTable.id });
  if (!claimed) return false;
  attachment.previewStatus = "processing";
  queueHeicPreview({
    attachmentId: attachment.id,
    projectId: attachment.projectId,
    sourceObjectPath: attachment.objectPath,
  });
  return true;
}

router.use("/workspace", requireAuth, async (_req, res, next): Promise<void> => {
  try {
    const access = await ensureProjectAccess(res.locals.clerkUserId);
    res.locals.projectAccess = access;
    await withProjectContext(access.project.id, () => new Promise<void>((resolve) => {
      res.once("finish", resolve);
      res.once("close", resolve);
      next();
    }));
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      res.status(403).json({ error: error.message });
      return;
    }
    next(error);
  }
});

router.get("/workspace", async (req, res): Promise<void> => {
  const access = res.locals.projectAccess as ProjectAccess;
  const records = onlyProjectRows(access.project.id, await db.select().from(qaqcRecordsTable)
    .where(eq(qaqcRecordsTable.projectId, access.project.id))
    .orderBy(desc(qaqcRecordsTable.updatedAt)));
  const attachments = onlyProjectRows(access.project.id, await db.select().from(recordAttachmentsTable)
    .where(eq(recordAttachmentsTable.projectId, access.project.id))
    .orderBy(desc(recordAttachmentsTable.createdAt)));
  for (const attachment of attachments) {
    await queueLegacyHeicPreview(attachment);
  }
  const events = onlyProjectRows(access.project.id, await db.select({
    id: auditEventsTable.id,
    projectId: auditEventsTable.projectId,
    action: auditEventsTable.action,
    subject: auditEventsTable.subject,
    timestamp: auditEventsTable.createdAt,
    actor: usersTable.name,
  }).from(auditEventsTable)
    .innerJoin(usersTable, eq(auditEventsTable.actorUserId, usersTable.id))
    .where(eq(auditEventsTable.projectId, access.project.id))
    .orderBy(desc(auditEventsTable.createdAt))
    .limit(100));
  const activeMembers = onlyProjectRows(access.project.id, await db.select({
    id: projectMembershipsTable.id,
    projectId: projectMembershipsTable.projectId,
    name: usersTable.name,
    email: usersTable.email,
    role: projectMembershipsTable.role,
  }).from(projectMembershipsTable)
    .innerJoin(usersTable, eq(projectMembershipsTable.userId, usersTable.id))
    .where(eq(projectMembershipsTable.projectId, access.project.id)));
  const invitations = onlyProjectRows(access.project.id, await db.select().from(projectInvitationsTable).where(and(
    eq(projectInvitationsTable.projectId, access.project.id),
    isNull(projectInvitationsTable.acceptedAt),
  )));

  const grouped: Record<string, Record<string, unknown>[]> = {
    qualityPlans: [], itps: [], inspections: [], ncrs: [], documents: [], audits: [],
  };
  for (const record of records) {
    const recordAttachments = attachments
      .filter((attachment) => attachment.recordId === record.id && attachment.recordType === record.type)
      .map((attachment) => ({
        id: attachment.id,
        fileName: attachment.fileName,
        contentType: attachment.contentType,
        size: attachment.size,
        createdAt: attachment.createdAt.toISOString(),
        downloadUrl: `/api/workspace/${record.type}/${record.id}/attachments/${attachment.id}/content`,
        previewUrl: attachmentPreviewUrl(attachment),
        previewStatus: attachment.previewStatus,
        previewError: attachment.previewError,
      }));
    grouped[record.type].push({
      ...record.data,
      id: record.id,
      attachments: recordAttachments,
      evidenceCount: recordAttachments.length,
    });
  }

  res.json(GetWorkspaceResponse.parse({
    projects: [access.project],
    ...grouped,
    activities: events.map((event) => ({ ...event, timestamp: event.timestamp.toISOString() })),
    members: [
      ...activeMembers.map((member) => ({
        ...member,
        email: member.email ?? "",
        status: "active" as const,
      })),
      ...invitations.map((invite) => ({
        id: invite.id,
        name: invite.email,
        email: invite.email,
        role: invite.role,
        status: "invited" as const,
      })),
    ],
    currentUser: {
      id: access.user.id,
      name: access.user.name,
      role: access.membership.role,
      permissions: access.permissions,
    },
  }));
});

router.post("/workspace/invitations", async (req, res): Promise<void> => {
  const body = InviteProjectMemberBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Email atau peran tidak valid." });
    return;
  }
  const access = res.locals.projectAccess as ProjectAccess;
  if (access.membership.role !== "QA_ENGINEER") {
    res.status(403).json({ error: "Hanya QA Engineer yang dapat mengundang anggota." });
    return;
  }
  const email = body.data.email.toLowerCase();
  const [invitation] = await db.insert(projectInvitationsTable).values({
    projectId: access.project.id,
    email,
    role: body.data.role,
    invitedBy: access.user.id,
  }).onConflictDoUpdate({
    target: [projectInvitationsTable.projectId, projectInvitationsTable.email],
    set: { role: body.data.role, acceptedAt: null, invitedBy: access.user.id },
  }).returning();
  await db.insert(auditEventsTable).values({
    projectId: access.project.id,
    actorUserId: access.user.id,
    action: "Invited member",
    subject: email,
    after: { email, role: body.data.role },
  });
  res.status(201).json(InviteProjectMemberResponse.parse({
    id: invitation.id,
    name: email,
    email,
    role: invitation.role,
    status: "invited",
  }));
});

async function recordExists(projectId: string, collection: "inspections" | "ncrs", id: string) {
  const [record] = await db.select({ id: qaqcRecordsTable.id }).from(qaqcRecordsTable).where(and(
    eq(qaqcRecordsTable.id, id),
    eq(qaqcRecordsTable.projectId, projectId),
    eq(qaqcRecordsTable.type, collection),
  )).limit(1);
  return Boolean(record);
}

router.post("/workspace/:collection/:id/attachments/upload-url", async (req, res): Promise<void> => {
  const params = RequestRecordAttachmentUploadParams.safeParse(req.params);
  const body = RequestRecordAttachmentUploadBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Metadata file tidak valid atau melebihi batas 25 MB." });
    return;
  }
  const access = res.locals.projectAccess as ProjectAccess;
  if (!canManageAttachment(access.membership.role, params.data.collection, "add")) {
    res.status(403).json({ error: "Peran Anda tidak memiliki izin menambah bukti." });
    return;
  }
  if (!isAllowedAttachmentType(body.data.contentType)) {
    res.status(400).json({ error: "Jenis file ini tidak diizinkan." });
    return;
  }
  if (!await recordExists(access.project.id, params.data.collection, params.data.id)) {
    res.status(404).json({ error: "Record tidak ditemukan." });
    return;
  }
  const upload = await createAttachmentUploadUrl();
  await db.insert(attachmentUploadsTable).values({
    projectId: access.project.id,
    recordId: params.data.id,
    recordType: params.data.collection,
    objectPath: upload.objectPath,
    requestedBy: access.user.id,
    expiresAt: new Date(Date.now() + ATTACHMENT_UPLOAD_GRACE_PERIOD_MS),
  });
  res.json(RequestRecordAttachmentUploadResponse.parse(upload));
});

router.post("/workspace/:collection/:id/attachments", async (req, res): Promise<void> => {
  const params = CreateRecordAttachmentParams.safeParse(req.params);
  const body = CreateRecordAttachmentBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Metadata lampiran tidak valid." });
    return;
  }
  const access = res.locals.projectAccess as ProjectAccess;
  if (!canManageAttachment(access.membership.role, params.data.collection, "add")) {
    res.status(403).json({ error: "Peran Anda tidak memiliki izin menambah bukti." });
    return;
  }
  if (!await recordExists(access.project.id, params.data.collection, params.data.id)) {
    res.status(404).json({ error: "Record tidak ditemukan." });
    return;
  }
  const object = attachmentObject(body.data.objectPath);
  const [exists] = await object.exists();
  if (!exists) {
    res.status(404).json({ error: "File unggahan tidak ditemukan di storage." });
    return;
  }
  const [objectMetadata] = await object.getMetadata();
  const actualSize = Number(objectMetadata.size);
  const actualContentType = String(objectMetadata.contentType || "application/octet-stream").toLowerCase();
  if (
    !Number.isSafeInteger(actualSize) ||
    actualSize < 1 ||
    actualSize > MAX_ATTACHMENT_SIZE ||
    actualSize !== body.data.size ||
    actualContentType !== body.data.contentType.toLowerCase() ||
    !isAllowedAttachmentType(actualContentType)
  ) {
    await object.delete({ ignoreNotFound: true });
    await db.delete(attachmentUploadsTable)
      .where(eq(attachmentUploadsTable.objectPath, body.data.objectPath));
    res.status(400).json({ error: "Isi file tidak sesuai metadata atau melebihi batas 25 MB." });
    return;
  }
  const requiresPreview = needsHeicPreview(actualContentType, body.data.fileName);
  const previewStatus: "original" | "processing" = requiresPreview ? "processing" : "original";

  const attachment = await db.transaction(async (tx) => {
    const [claimedUpload] = await tx.delete(attachmentUploadsTable).where(and(
      eq(attachmentUploadsTable.objectPath, body.data.objectPath),
      eq(attachmentUploadsTable.projectId, access.project.id),
      eq(attachmentUploadsTable.recordId, params.data.id),
      eq(attachmentUploadsTable.recordType, params.data.collection),
      isNull(attachmentUploadsTable.cleanupStartedAt),
    )).returning({ id: attachmentUploadsTable.id });
    if (!claimedUpload) return null;

    const inserted = await tx.insert(recordAttachmentsTable).values({
      projectId: access.project.id,
      recordId: params.data.id,
      recordType: params.data.collection,
      objectPath: body.data.objectPath,
      fileName: body.data.fileName,
      contentType: actualContentType,
      size: actualSize,
      previewStatus,
      uploadedBy: access.user.id,
    }).returning();
    await tx.insert(auditEventsTable).values({
      projectId: access.project.id,
      actorUserId: access.user.id,
      recordType: params.data.collection,
      recordId: params.data.id,
      action: "Added evidence",
      subject: body.data.fileName,
      after: { attachmentId: inserted[0].id, fileName: body.data.fileName, size: body.data.size },
    });
    return inserted[0];
  });
  if (!attachment) {
    res.status(409).json({ error: "Sesi unggah sudah kedaluwarsa atau telah diproses." });
    return;
  }
  if (requiresPreview) {
    queueHeicPreview({
      attachmentId: attachment.id,
      projectId: attachment.projectId,
      sourceObjectPath: attachment.objectPath,
    });
  }
  res.status(201).json(CreateRecordAttachmentResponse.parse({
    id: attachment.id,
    fileName: attachment.fileName,
    contentType: attachment.contentType,
    size: attachment.size,
    createdAt: attachment.createdAt.toISOString(),
    downloadUrl: `/api/workspace/${attachment.recordType}/${attachment.recordId}/attachments/${attachment.id}/content`,
    previewUrl: attachmentPreviewUrl(attachment),
    previewStatus: attachment.previewStatus,
    previewError: attachment.previewError,
  }));
});

router.get("/workspace/:collection/:id/attachments/:attachmentId/content", async (req, res): Promise<void> => {
  const params = DownloadRecordAttachmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Parameter lampiran tidak valid." });
    return;
  }
  const access = res.locals.projectAccess as ProjectAccess;
  const [attachment] = await db.select().from(recordAttachmentsTable).where(and(
    eq(recordAttachmentsTable.id, params.data.attachmentId),
    eq(recordAttachmentsTable.projectId, access.project.id),
    eq(recordAttachmentsTable.recordId, params.data.id),
    eq(recordAttachmentsTable.recordType, params.data.collection),
  )).limit(1);
  if (!attachment) {
    res.status(404).json({ error: "Lampiran tidak ditemukan." });
    return;
  }
  await streamAttachment(attachmentObject(attachment.objectPath), res, attachment.fileName);
});

router.get("/workspace/:collection/:id/attachments/:attachmentId/preview", async (req, res): Promise<void> => {
  const params = PreviewRecordAttachmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Parameter lampiran tidak valid." });
    return;
  }
  const access = res.locals.projectAccess as ProjectAccess;
  const [attachment] = await db.select().from(recordAttachmentsTable).where(and(
    eq(recordAttachmentsTable.id, params.data.attachmentId),
    eq(recordAttachmentsTable.projectId, access.project.id),
    eq(recordAttachmentsTable.recordId, params.data.id),
    eq(recordAttachmentsTable.recordType, params.data.collection),
  )).limit(1);
  if (!attachment) {
    res.status(404).json({ error: "Lampiran tidak ditemukan." });
    return;
  }
  if (await queueLegacyHeicPreview(attachment)) {
    res.status(202).json({ error: "Pratinjau sedang diproses." });
    return;
  }
  if (attachment.previewStatus === "processing") {
    res.status(202).json({ error: "Pratinjau masih diproses." });
    return;
  }
  if (attachment.previewStatus === "failed") {
    res.status(422).json({ error: attachment.previewError || "Pratinjau tidak dapat dibuat." });
    return;
  }
  await streamAttachmentPreview(
    attachmentObject(attachment.previewObjectPath || attachment.objectPath),
    res,
  );
});

router.delete("/workspace/:collection/:id/attachments/:attachmentId", async (req, res): Promise<void> => {
  const params = DeleteRecordAttachmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Parameter lampiran tidak valid." });
    return;
  }
  const access = res.locals.projectAccess as ProjectAccess;
  if (!canManageAttachment(access.membership.role, params.data.collection, "delete")) {
    res.status(403).json({ error: "Peran Anda tidak memiliki izin menghapus bukti." });
    return;
  }
  const attachment = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(recordAttachmentsTable).where(and(
      eq(recordAttachmentsTable.id, params.data.attachmentId),
      eq(recordAttachmentsTable.projectId, access.project.id),
      eq(recordAttachmentsTable.recordId, params.data.id),
      eq(recordAttachmentsTable.recordType, params.data.collection),
    )).limit(1);
    if (!existing) return null;
    await tx.delete(recordAttachmentsTable).where(eq(recordAttachmentsTable.id, existing.id));
    await tx.insert(auditEventsTable).values({
      projectId: access.project.id,
      actorUserId: access.user.id,
      recordType: params.data.collection,
      recordId: params.data.id,
      action: "Deleted evidence",
      subject: existing.fileName,
      before: { attachmentId: existing.id, fileName: existing.fileName, size: existing.size },
    });
    return existing;
  });
  if (!attachment) {
    res.status(404).json({ error: "Lampiran tidak ditemukan." });
    return;
  }
  await attachmentObject(attachment.objectPath).delete({ ignoreNotFound: true });
  if (attachment.previewObjectPath) {
    await attachmentObject(attachment.previewObjectPath).delete({ ignoreNotFound: true });
  }
  res.sendStatus(204);
});

router.post("/workspace/:collection", async (req, res): Promise<void> => {
  const params = CreateWorkspaceRecordParams.safeParse(req.params);
  const body = CreateWorkspaceRecordBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Data record tidak valid." });
    return;
  }
  const access = res.locals.projectAccess as ProjectAccess;
  if (!canMutate(access.membership.role, params.data.collection, "create")) {
    res.status(403).json({ error: "Peran Anda tidak memiliki izin membuat data ini." });
    return;
  }
  const id = String(body.data.id || randomUUID());
  const { id: _inputId, ...data } = body.data;
  const [created] = await db.transaction(async (tx) => {
    return executeAuditedMutation(
      tx,
      (transaction) => transaction.insert(qaqcRecordsTable).values({
        id,
        projectId: access.project.id,
        type: params.data.collection,
        data,
        createdBy: access.user.id,
        updatedBy: access.user.id,
      }).returning(),
      async (transaction) => {
        await transaction.insert(auditEventsTable).values(createdRecordAudit({
          projectId: access.project.id,
          actorUserId: access.user.id,
          recordType: params.data.collection,
          recordId: id,
        }, body.data));
      },
    );
  });
  res.status(201).json({ ...created.data, id: created.id });
});

router.patch("/workspace/:collection/:id", async (req, res): Promise<void> => {
  const params = UpdateWorkspaceRecordParams.safeParse(req.params);
  const body = UpdateWorkspaceRecordBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Data perubahan tidak valid." });
    return;
  }
  const access = res.locals.projectAccess as ProjectAccess;
  if (!canMutate(access.membership.role, params.data.collection, "update")) {
    res.status(403).json({ error: "Peran Anda tidak memiliki izin mengubah data ini." });
    return;
  }
  const result = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(qaqcRecordsTable).where(and(
      eq(qaqcRecordsTable.id, params.data.id),
      eq(qaqcRecordsTable.projectId, access.project.id),
      eq(qaqcRecordsTable.type, params.data.collection),
    )).limit(1);
    if (!existing) return null;
    const data = { ...existing.data, ...body.data };
    delete data.id;
    return executeAuditedMutation(
      tx,
      async (transaction) => {
        const [updated] = await transaction.update(qaqcRecordsTable).set({
          data,
          updatedBy: access.user.id,
        }).where(eq(qaqcRecordsTable.id, existing.id)).returning();
        return { ...updated.data, id: updated.id };
      },
      async (transaction) => {
        await transaction.insert(auditEventsTable).values(updatedRecordAudit({
          projectId: access.project.id,
          actorUserId: access.user.id,
          recordType: params.data.collection,
          recordId: existing.id,
        }, existing.data, data));
      },
    );
  });
  if (!result) {
    res.status(404).json({ error: "Record tidak ditemukan." });
    return;
  }
  res.json(UpdateWorkspaceRecordResponse.parse(result));
});

router.delete("/workspace/:collection/:id", async (req, res): Promise<void> => {
  const params = DeleteWorkspaceRecordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Parameter tidak valid." });
    return;
  }
  const access = res.locals.projectAccess as ProjectAccess;
  if (!canMutate(access.membership.role, params.data.collection, "delete")) {
    res.status(403).json({ error: "Peran Anda tidak memiliki izin menghapus data ini." });
    return;
  }
  const deleted = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(qaqcRecordsTable).where(and(
      eq(qaqcRecordsTable.id, params.data.id),
      eq(qaqcRecordsTable.projectId, access.project.id),
      eq(qaqcRecordsTable.type, params.data.collection),
    )).limit(1);
    if (!existing) return false;
    return executeAuditedMutation(
      tx,
      async (transaction) => {
        await transaction.delete(qaqcRecordsTable).where(eq(qaqcRecordsTable.id, existing.id));
        return true;
      },
      async (transaction) => {
        await transaction.insert(auditEventsTable).values(deletedRecordAudit({
          projectId: access.project.id,
          actorUserId: access.user.id,
          recordType: params.data.collection,
          recordId: existing.id,
        }, existing.data));
      },
    );
  });
  if (!deleted) {
    res.status(404).json({ error: "Record tidak ditemukan." });
    return;
  }
  res.sendStatus(204);
});

export default router;