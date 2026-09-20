import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectRoleEnum = pgEnum("project_role", [
  "QA_ENGINEER",
  "QC_INSPECTOR",
  "SITE_MANAGER",
  "PROJECT_MANAGER",
]);

export const recordTypeEnum = pgEnum("qaqc_record_type", [
  "qualityPlans",
  "itps",
  "inspections",
  "ncrs",
  "documents",
  "audits",
]);

export const projectsTable = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  client: text("client").notNull(),
  contractor: text("contractor").notNull(),
  progress: integer("progress").notNull().default(0),
  qualityScore: integer("quality_score").notNull().default(0),
  status: text("status").notNull().default("Active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const projectMembershipsTable = pgTable(
  "project_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    role: projectRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("project_memberships_project_user_unique").on(table.projectId, table.userId),
    index("project_memberships_user_idx").on(table.userId),
  ],
);

export const projectInvitationsTable = pgTable(
  "project_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: projectRoleEnum("role").notNull(),
    invitedBy: uuid("invited_by").notNull().references(() => usersTable.id),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("project_invitations_project_email_unique").on(table.projectId, table.email),
    index("project_invitations_email_idx").on(table.email),
  ],
);

export const qaqcRecordsTable = pgTable(
  "qaqc_records",
  {
    id: text("id").primaryKey(),
    projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    type: recordTypeEnum("type").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    createdBy: uuid("created_by").notNull().references(() => usersTable.id),
    updatedBy: uuid("updated_by").notNull().references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => [
    index("qaqc_records_project_type_idx").on(table.projectId, table.type),
  ],
);

export const recordAttachmentsTable = pgTable(
  "qaqc_record_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    recordId: text("record_id").notNull().references(() => qaqcRecordsTable.id, { onDelete: "cascade" }),
    recordType: recordTypeEnum("record_type").notNull(),
    objectPath: text("object_path").notNull().unique(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    uploadedBy: uuid("uploaded_by").notNull().references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("qaqc_attachments_project_record_idx").on(table.projectId, table.recordType, table.recordId),
  ],
);

export const attachmentUploadsTable = pgTable(
  "qaqc_attachment_uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull(),
    recordId: text("record_id").notNull(),
    recordType: recordTypeEnum("record_type").notNull(),
    objectPath: text("object_path").notNull().unique(),
    requestedBy: uuid("requested_by").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    cleanupStartedAt: timestamp("cleanup_started_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("qaqc_attachment_uploads_cleanup_idx").on(table.cleanupStartedAt, table.expiresAt),
  ],
);

export const auditEventsTable = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").notNull().references(() => usersTable.id),
    recordType: recordTypeEnum("record_type"),
    recordId: text("record_id"),
    action: text("action").notNull(),
    subject: text("subject").notNull(),
    before: jsonb("before").$type<Record<string, unknown> | null>(),
    after: jsonb("after").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("audit_events_project_created_idx").on(table.projectId, table.createdAt)],
);

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQaqcRecordSchema = createInsertSchema(qaqcRecordsTable).omit({ createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
export type QaqcRecord = typeof qaqcRecordsTable.$inferSelect;
export type RecordAttachment = typeof recordAttachmentsTable.$inferSelect;