import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  auditEventsTable,
  db,
  projectInvitationsTable,
  projectMembershipsTable,
  qaqcRecordsTable,
  usersTable,
} from "@workspace/db";
import {
  CreateWorkspaceRecordBody,
  CreateWorkspaceRecordParams,
  DeleteWorkspaceRecordParams,
  GetWorkspaceResponse,
  InviteProjectMemberBody,
  InviteProjectMemberResponse,
  UpdateWorkspaceRecordBody,
  UpdateWorkspaceRecordParams,
  UpdateWorkspaceRecordResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import {
  canMutate,
  ensureProjectAccess,
  ProjectAccessError,
  type ProjectAccess,
} from "../lib/project-access";

const router: IRouter = Router();
router.use("/workspace", requireAuth, async (_req, res, next): Promise<void> => {
  try {
    res.locals.projectAccess = await ensureProjectAccess(res.locals.clerkUserId);
    next();
  } catch (error) {
    if (error instanceof ProjectAccessError) {
      res.status(403).json({ error: error.message });
      return;
    }
    next(error);
  }
});

function subjectFor(record: Record<string, unknown>) {
  return String(record.title ?? record.name ?? record.number ?? record.reference ?? record.activity ?? record.id ?? "Record");
}

router.get("/workspace", async (req, res): Promise<void> => {
  const access = res.locals.projectAccess as ProjectAccess;
  const records = await db.select().from(qaqcRecordsTable)
    .where(eq(qaqcRecordsTable.projectId, access.project.id))
    .orderBy(desc(qaqcRecordsTable.updatedAt));
  const events = await db.select({
    id: auditEventsTable.id,
    action: auditEventsTable.action,
    subject: auditEventsTable.subject,
    timestamp: auditEventsTable.createdAt,
    actor: usersTable.name,
  }).from(auditEventsTable)
    .innerJoin(usersTable, eq(auditEventsTable.actorUserId, usersTable.id))
    .where(eq(auditEventsTable.projectId, access.project.id))
    .orderBy(desc(auditEventsTable.createdAt))
    .limit(100);
  const activeMembers = await db.select({
    id: projectMembershipsTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: projectMembershipsTable.role,
  }).from(projectMembershipsTable)
    .innerJoin(usersTable, eq(projectMembershipsTable.userId, usersTable.id))
    .where(eq(projectMembershipsTable.projectId, access.project.id));
  const invitations = await db.select().from(projectInvitationsTable).where(and(
    eq(projectInvitationsTable.projectId, access.project.id),
    isNull(projectInvitationsTable.acceptedAt),
  ));

  const grouped: Record<string, Record<string, unknown>[]> = {
    qualityPlans: [], itps: [], inspections: [], ncrs: [], documents: [], audits: [],
  };
  for (const record of records) grouped[record.type].push({ ...record.data, id: record.id });

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
    const inserted = await tx.insert(qaqcRecordsTable).values({
      id,
      projectId: access.project.id,
      type: params.data.collection,
      data,
      createdBy: access.user.id,
      updatedBy: access.user.id,
    }).returning();
    await tx.insert(auditEventsTable).values({
      projectId: access.project.id,
      actorUserId: access.user.id,
      recordType: params.data.collection,
      recordId: id,
      action: "Created",
      subject: subjectFor(body.data),
      after: body.data,
    });
    return inserted;
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
    const [updated] = await tx.update(qaqcRecordsTable).set({
      data,
      updatedBy: access.user.id,
    }).where(eq(qaqcRecordsTable.id, existing.id)).returning();
    await tx.insert(auditEventsTable).values({
      projectId: access.project.id,
      actorUserId: access.user.id,
      recordType: params.data.collection,
      recordId: existing.id,
      action: "Updated",
      subject: subjectFor(data),
      before: existing.data,
      after: data,
    });
    return { ...updated.data, id: updated.id };
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
    await tx.delete(qaqcRecordsTable).where(eq(qaqcRecordsTable.id, existing.id));
    await tx.insert(auditEventsTable).values({
      projectId: access.project.id,
      actorUserId: access.user.id,
      recordType: params.data.collection,
      recordId: existing.id,
      action: "Deleted",
      subject: subjectFor(existing.data),
      before: existing.data,
    });
    return true;
  });
  if (!deleted) {
    res.status(404).json({ error: "Record tidak ditemukan." });
    return;
  }
  res.sendStatus(204);
});

export default router;