import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";
import { index, integer, pgPolicy, pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { projectsTable, usersTable, qaqcRecordsTable } from "./qaqc";

const tenantPolicy = () => pgPolicy("project_isolation", {
  for: "all",
  using: sql`project_id = nullif(current_setting('app.current_project_id', true), '')::uuid OR current_setting('app.tenant_bootstrap', true) = 'on'`,
  withCheck: sql`project_id = nullif(current_setting('app.current_project_id', true), '')::uuid OR current_setting('app.tenant_bootstrap', true) = 'on'`,
});

export const materialTypesTable = pgTable("material_types", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  specification: text("specification"),
  unit: text("unit").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("material_types_project_idx").on(table.projectId), tenantPolicy()]).enableRLS();

export const materialStorageLocationsTable = pgTable("material_storage_locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("material_storage_locations_project_idx").on(table.projectId), tenantPolicy()]).enableRLS();

export const materialBatchesTable = pgTable("material_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  materialTypeId: uuid("material_type_id").notNull().references(() => materialTypesTable.id),
  batchNumber: text("batch_number").notNull(),
  supplier: text("supplier").notNull(),
  deliveryDate: timestamp("delivery_date", { withTimezone: true }).notNull(),
  quantity: integer("quantity").notNull(),
  unit: text("unit").notNull(),
  certificateReference: text("certificate_reference"),
  inspectionId: text("inspection_id").references(() => qaqcRecordsTable.id),
  inspectionStatus: text("inspection_status").notNull().default("pending"),
  receivedBy: uuid("received_by").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("material_batches_project_idx").on(table.projectId),
  uniqueIndex("material_batches_project_number_unique").on(table.projectId, table.batchNumber),
  tenantPolicy(),
]).enableRLS();

export const materialInventoryTable = pgTable("material_inventory", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  batchId: uuid("batch_id").notNull().references(() => materialBatchesTable.id, { onDelete: "cascade" }),
  storageLocationId: uuid("storage_location_id").notNull().references(() => materialStorageLocationsTable.id),
  quantity: integer("quantity").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [uniqueIndex("material_inventory_batch_location_unique").on(table.batchId, table.storageLocationId), tenantPolicy()]).enableRLS();

export const materialUsageTable = pgTable("material_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  batchId: uuid("batch_id").notNull().references(() => materialBatchesTable.id),
  location: text("location").notNull(),
  quantity: integer("quantity").notNull(),
  installedDate: timestamp("installed_date", { withTimezone: true }).notNull(),
  installedBy: uuid("installed_by").notNull().references(() => usersTable.id),
  inspectionId: text("inspection_id").references(() => qaqcRecordsTable.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("material_usage_project_batch_idx").on(table.projectId, table.batchId), tenantPolicy()]).enableRLS();

export const insertMaterialTypeSchema = createInsertSchema(materialTypesTable);
export const insertMaterialStorageLocationSchema = createInsertSchema(materialStorageLocationsTable);
export const insertMaterialBatchSchema = createInsertSchema(materialBatchesTable);
export const insertMaterialInventorySchema = createInsertSchema(materialInventoryTable);
export const insertMaterialUsageSchema = createInsertSchema(materialUsageTable);
export type MaterialType = typeof materialTypesTable.$inferSelect;
export type MaterialStorageLocation = typeof materialStorageLocationsTable.$inferSelect;
export type MaterialBatch = typeof materialBatchesTable.$inferSelect;
export type MaterialInventory = typeof materialInventoryTable.$inferSelect;
export type MaterialUsage = typeof materialUsageTable.$inferSelect;
export type InsertMaterialType = z.infer<typeof insertMaterialTypeSchema>;