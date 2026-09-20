import { Router, type IRouter } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  auditEventsTable, db, materialBatchesTable, materialInventoryTable,
  materialStorageLocationsTable, materialTypesTable, materialUsageTable,
} from "@workspace/db";
import {
  CreateMaterialBatchBody, CreateMaterialBatchResponse, CreateMaterialLocationBody,
  CreateMaterialLocationResponse, CreateMaterialTypeBody, CreateMaterialTypeResponse,
  GetMaterialBatchRecallParams, GetMaterialBatchRecallResponse, GetMaterialBatchTraceParams,
  GetMaterialBatchTraceResponse, ListMaterialBatchesResponse, ListMaterialLocationsResponse,
  ListMaterialTypesResponse, PlaceMaterialInventoryBody, PlaceMaterialInventoryResponse,
  RecordMaterialUsageBody, RecordMaterialUsageResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/auth";
import { canMutate, ensureProjectAccess, ProjectAccessError, type ProjectAccess } from "../lib/project-access";

const router: IRouter = Router();
router.use("/materials", requireAuth, async (_req, res, next): Promise<void> => {
  try {
    res.locals.projectAccess = await ensureProjectAccess(res.locals.clerkUserId);
    next();
  } catch (error) {
    if (error instanceof ProjectAccessError) { res.status(403).json({ error: error.message }); return; }
    next(error);
  }
});

function access(res: Parameters<Parameters<IRouter["get"]>[1]>[1]) {
  return res.locals.projectAccess as ProjectAccess;
}
function writable(res: Parameters<Parameters<IRouter["get"]>[1]>[1]) {
  const a = access(res);
  return canMutate(a.membership.role, "materials", "create");
}

router.get("/materials/types", async (_req, res): Promise<void> => {
  const a = access(res);
  const rows = await db.select().from(materialTypesTable).where(eq(materialTypesTable.projectId, a.project.id)).orderBy(desc(materialTypesTable.createdAt));
  res.json(ListMaterialTypesResponse.parse(rows));
});
router.post("/materials/types", async (req, res): Promise<void> => {
  const body = CreateMaterialTypeBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  if (!writable(res)) { res.status(403).json({ error: "Peran Anda tidak memiliki izin mengelola material." }); return; }
  const a = access(res);
  const row = await db.transaction(async (tx) => {
    const [created] = await tx.insert(materialTypesTable).values({ ...body.data, projectId: a.project.id }).returning();
    await tx.insert(auditEventsTable).values({ projectId: a.project.id, actorUserId: a.user.id, action: "Created material type", subject: created.name, after: created });
    return created;
  });
  res.status(201).json(CreateMaterialTypeResponse.parse(row));
});

router.get("/materials/locations", async (_req, res): Promise<void> => {
  const a = access(res);
  const rows = await db.select().from(materialStorageLocationsTable).where(eq(materialStorageLocationsTable.projectId, a.project.id)).orderBy(desc(materialStorageLocationsTable.createdAt));
  res.json(ListMaterialLocationsResponse.parse(rows));
});
router.post("/materials/locations", async (req, res): Promise<void> => {
  const body = CreateMaterialLocationBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  if (!writable(res)) { res.status(403).json({ error: "Peran Anda tidak memiliki izin mengelola material." }); return; }
  const a = access(res);
  const row = await db.transaction(async (tx) => {
    const [created] = await tx.insert(materialStorageLocationsTable).values({ ...body.data, projectId: a.project.id }).returning();
    await tx.insert(auditEventsTable).values({ projectId: a.project.id, actorUserId: a.user.id, action: "Created material location", subject: created.name, after: created });
    return created;
  });
  res.status(201).json(CreateMaterialLocationResponse.parse(row));
});

router.get("/materials/batches", async (_req, res): Promise<void> => {
  const a = access(res);
  const rows = await db.select().from(materialBatchesTable).where(eq(materialBatchesTable.projectId, a.project.id)).orderBy(desc(materialBatchesTable.createdAt));
  res.json(ListMaterialBatchesResponse.parse(rows));
});
router.post("/materials/batches", async (req, res): Promise<void> => {
  const body = CreateMaterialBatchBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  if (!writable(res)) { res.status(403).json({ error: "Peran Anda tidak memiliki izin mengelola material." }); return; }
  const a = access(res);
  const [type] = await db.select({ id: materialTypesTable.id }).from(materialTypesTable).where(and(eq(materialTypesTable.id, body.data.materialTypeId), eq(materialTypesTable.projectId, a.project.id)));
  if (!type) { res.status(404).json({ error: "Jenis material tidak ditemukan." }); return; }
  const row = await db.transaction(async (tx) => {
    const [created] = await tx.insert(materialBatchesTable).values({ ...body.data, projectId: a.project.id, receivedBy: a.user.id }).returning();
    await tx.insert(auditEventsTable).values({ projectId: a.project.id, actorUserId: a.user.id, action: "Created material batch", subject: created.batchNumber, after: created });
    return created;
  });
  res.status(201).json(CreateMaterialBatchResponse.parse(row));
});

router.post("/materials/inventory", async (req, res): Promise<void> => {
  const body = PlaceMaterialInventoryBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  if (!writable(res)) { res.status(403).json({ error: "Peran Anda tidak memiliki izin mengelola stok." }); return; }
  const a = access(res);
  const row = await db.transaction(async (tx) => {
    const [batch] = await tx.select({ id: materialBatchesTable.id }).from(materialBatchesTable).where(and(eq(materialBatchesTable.id, body.data.batchId), eq(materialBatchesTable.projectId, a.project.id)));
    const [location] = await tx.select({ id: materialStorageLocationsTable.id }).from(materialStorageLocationsTable).where(and(eq(materialStorageLocationsTable.id, body.data.storageLocationId), eq(materialStorageLocationsTable.projectId, a.project.id)));
    if (!batch || !location) return null;
    const [existing] = await tx.select().from(materialInventoryTable).where(and(eq(materialInventoryTable.projectId, a.project.id), eq(materialInventoryTable.batchId, body.data.batchId), eq(materialInventoryTable.storageLocationId, body.data.storageLocationId))).for("update");
    const result = existing
      ? await tx.update(materialInventoryTable).set({ quantity: sql`${materialInventoryTable.quantity} + ${body.data.quantity}` }).where(eq(materialInventoryTable.id, existing.id)).returning()
      : await tx.insert(materialInventoryTable).values({ ...body.data, projectId: a.project.id }).returning();
    await tx.insert(auditEventsTable).values({ projectId: a.project.id, actorUserId: a.user.id, action: "Placed material inventory", subject: body.data.batchId, after: result[0] });
    return result[0];
  });
  if (!row) { res.status(404).json({ error: "Batch atau lokasi penyimpanan tidak ditemukan." }); return; }
  res.status(201).json(PlaceMaterialInventoryResponse.parse(row));
});

router.post("/materials/usage", async (req, res): Promise<void> => {
  const body = RecordMaterialUsageBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  if (!writable(res)) { res.status(403).json({ error: "Peran Anda tidak memiliki izin mencatat penggunaan." }); return; }
  const a = access(res);
  const result = await db.transaction(async (tx) => {
    const [batch] = await tx.select({ id: materialBatchesTable.id }).from(materialBatchesTable).where(and(eq(materialBatchesTable.id, body.data.batchId), eq(materialBatchesTable.projectId, a.project.id)));
    if (!batch) return { kind: "missing" as const };
    const [stock] = await tx.select().from(materialInventoryTable).where(and(eq(materialInventoryTable.projectId, a.project.id), eq(materialInventoryTable.batchId, body.data.batchId))).for("update");
    if (!stock || stock.quantity < body.data.quantity) return { kind: "insufficient" as const };
    await tx.update(materialInventoryTable).set({ quantity: sql`${materialInventoryTable.quantity} - ${body.data.quantity}` }).where(eq(materialInventoryTable.id, stock.id));
    const [usage] = await tx.insert(materialUsageTable).values({ ...body.data, projectId: a.project.id, installedBy: a.user.id }).returning();
    await tx.insert(auditEventsTable).values({ projectId: a.project.id, actorUserId: a.user.id, action: "Recorded material usage", subject: usage.location, after: usage });
    return { kind: "ok" as const, usage };
  });
  if (result.kind === "missing") { res.status(404).json({ error: "Batch material tidak ditemukan." }); return; }
  if (result.kind === "insufficient") { res.status(409).json({ error: "Stok material tidak mencukupi." }); return; }
  res.status(201).json(RecordMaterialUsageResponse.parse(result.usage));
});

async function batchTrace(batchId: string, a: ProjectAccess) {
  const [batch] = await db.select().from(materialBatchesTable).where(and(eq(materialBatchesTable.id, batchId), eq(materialBatchesTable.projectId, a.project.id)));
  if (!batch) return null;
  const inventory = await db.select().from(materialInventoryTable).where(and(eq(materialInventoryTable.batchId, batchId), eq(materialInventoryTable.projectId, a.project.id)));
  const usage = await db.select().from(materialUsageTable).where(and(eq(materialUsageTable.batchId, batchId), eq(materialUsageTable.projectId, a.project.id)));
  return { batch, inventory, usage };
}
router.get("/materials/batches/:batchId/trace", async (req, res): Promise<void> => {
  const params = GetMaterialBatchTraceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const row = await batchTrace(params.data.batchId, access(res));
  if (!row) { res.status(404).json({ error: "Batch material tidak ditemukan." }); return; }
  res.json(GetMaterialBatchTraceResponse.parse(row));
});
router.get("/materials/batches/:batchId/recall", async (req, res): Promise<void> => {
  const params = GetMaterialBatchRecallParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const row = await batchTrace(params.data.batchId, access(res));
  if (!row) { res.status(404).json({ error: "Batch material tidak ditemukan." }); return; }
  res.json(GetMaterialBatchRecallResponse.parse({ batchId: params.data.batchId, totalAffectedLocations: row.usage.length, locations: row.usage }));
});

export default router;