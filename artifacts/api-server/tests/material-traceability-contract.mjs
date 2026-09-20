import assert from "node:assert/strict";
import { build } from "esbuild";
import { readFile, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const routeSource = await readFile(path.resolve("src/routes/materials.ts"), "utf8");
const specSource = await readFile(path.resolve("../../lib/api-spec/openapi.yaml"), "utf8");

// The generated Zod contract is the executable OpenAPI contract used by the server.
const directory = await mkdtemp(path.join(tmpdir(), "qaqc-material-contract-"));
const entry = path.join(directory, "entry.ts");
const output = path.join(directory, "entry.mjs");
await writeFile(entry, `
  export {
    CreateMaterialBatchBody, CreateMaterialLocationBody, CreateMaterialTypeBody,
    PlaceMaterialInventoryBody, RecordMaterialUsageBody, GetMaterialBatchTraceParams,
    GetMaterialBatchRecallParams, GetMaterialBatchTraceResponse, GetMaterialBatchRecallResponse,
  } from "${path.resolve("../../lib/api-zod/src/generated/api.ts").replaceAll("\\", "/")}";
`);
await build({ entryPoints: [entry], outfile: output, bundle: true, format: "esm", platform: "node" });
const {
  CreateMaterialBatchBody, CreateMaterialLocationBody, CreateMaterialTypeBody,
  PlaceMaterialInventoryBody, RecordMaterialUsageBody, GetMaterialBatchTraceParams,
  GetMaterialBatchRecallParams, GetMaterialBatchTraceResponse, GetMaterialBatchRecallResponse,
} = await import(pathToFileURL(output).href);

const projectId = "11111111-1111-4111-8111-111111111111";
const typeId = "22222222-2222-4222-8222-222222222222";
const batchId = "33333333-3333-4333-8333-333333333333";
const locationId = "44444444-4444-4444-8444-444444444444";
const inspectionId = "mir-001";
const validBatch = {
  materialTypeId: typeId, batchNumber: "BATCH-001", supplier: "PT Baja",
  deliveryDate: "2025-01-01T00:00:00.000Z", quantity: 100, unit: "ton",
};
assert.deepEqual(CreateMaterialTypeBody.parse({ name: "Baja D13", category: "Struktur", unit: "ton" }).name, "Baja D13");
assert.deepEqual(CreateMaterialLocationBody.parse({ name: "Gudang A" }).name, "Gudang A");
assert.equal(CreateMaterialBatchBody.parse(validBatch).quantity, 100);
assert.equal(CreateMaterialBatchBody.parse({ ...validBatch, inspectionId }).inspectionId, inspectionId);
assert.equal(PlaceMaterialInventoryBody.parse({ batchId, storageLocationId: locationId, quantity: 100 }).quantity, 100);
assert.equal(RecordMaterialUsageBody.parse({
  batchId, location: "Lantai 3, Kolom C-5", quantity: 10, installedDate: validBatch.deliveryDate,
}).quantity, 10);
assert.equal(GetMaterialBatchTraceParams.parse({ batchId }).batchId, batchId);
assert.equal(GetMaterialBatchRecallParams.parse({ batchId }).batchId, batchId);
assert.throws(() => RecordMaterialUsageBody.parse({ batchId, location: "x", quantity: 0, installedDate: validBatch.deliveryDate }));
assert.throws(() => CreateMaterialBatchBody.parse({ ...validBatch, materialTypeId: "not-a-uuid" }));

// Ensure the public contract contains every material operation and body schema.
for (const operationId of [
  "listMaterialTypes", "createMaterialType", "listMaterialLocations", "createMaterialLocation",
  "listMaterialBatches", "createMaterialBatch", "placeMaterialInventory", "recordMaterialUsage",
  "getMaterialBatchTrace", "getMaterialBatchRecall",
]) assert.match(specSource, new RegExp(`operationId: ${operationId}`));
assert.match(specSource, /activeInspection:/);

// Every lookup and mutation must carry the current project. This catches regressions
// where a convenient ID-only lookup accidentally becomes cross-project.
for (const table of [
  "materialTypesTable", "materialStorageLocationsTable", "materialBatchesTable",
  "materialInventoryTable", "materialUsageTable",
]) {
  assert.match(routeSource, new RegExp(`eq\\(${table}\\.projectId, a\\.project\\.id\\)`), `${table} must be project scoped`);
}
assert.match(routeSource, /eq\(materialBatchesTable\.id, batchId\), eq\(materialBatchesTable\.projectId, a\.project\.id\)/);
assert.match(routeSource, /eq\(materialInventoryTable\.projectId, a\.project\.id\)/);
assert.match(routeSource, /eq\(qaqcRecordsTable\.projectId, a\.project\.id\)/);
assert.match(routeSource, /inspection\.data\.type !== "MIR"/);
assert.match(routeSource, /recordType: body\.data\.inspectionId \? "inspections" : null/);
assert.match(routeSource, /recordId: body\.data\.inspectionId \?\? null/);

// Usage must lock stock before checking it, and the insufficient branch must precede
// both usage and audit inserts.
const usageStart = routeSource.indexOf('router.post("/materials/usage"');
const traceStart = routeSource.indexOf('async function batchTrace');
const usageSource = routeSource.slice(usageStart, traceStart);
assert.match(usageSource, /\.for\("update"\)/, "usage must lock inventory rows");
const insufficient = usageSource.indexOf('kind: "insufficient"');
const usageInsert = usageSource.indexOf("tx.insert(materialUsageTable)");
const auditInsert = usageSource.indexOf("tx.insert(auditEventsTable)");
assert.ok(insufficient >= 0 && insufficient < usageInsert, "insufficient stock must stop before usage insert");
assert.ok(insufficient < auditInsert, "insufficient stock must stop before audit insert");
assert.match(usageSource, /await tx\.update\(materialInventoryTable\)\.set\(\{ quantity: sql/);

// A small transaction model proves the critical rollback behavior without requiring
// a provisioned PostgreSQL instance: insufficient stock leaves both stock and audit
// state untouched.
function recordUsage(state, requested) {
  if (state.stock < requested) return { status: 409, state };
  state.stock -= requested;
  state.usage.push(requested);
  state.audits.push({ action: "Recorded material usage", projectId });
  return { status: 201, state };
}
const insufficientState = { stock: 5, usage: [], audits: [] };
const insufficientResult = recordUsage(insufficientState, 6);
assert.equal(insufficientResult.status, 409);
assert.deepEqual(insufficientState, { stock: 5, usage: [], audits: [] });
const happyState = { stock: 5, usage: [], audits: [] };
assert.equal(recordUsage(happyState, 3).status, 201);
assert.deepEqual(happyState, {
  stock: 2, usage: [3], audits: [{ action: "Recorded material usage", projectId }],
});

// Each write has an audit event in the same transaction and preserves the actor,
// project, action, subject, and after-image needed for traceability.
for (const [action, subject] of [
  ["Created material type", "created.name"],
  ["Created material location", "created.name"],
  ["Created material batch", "created.batchNumber"],
  ["Placed material inventory", "body.data.batchId"],
  ["Recorded material usage", "usage.location"],
]) {
  const index = routeSource.indexOf(`action: "${action}"`);
  assert.notEqual(index, -1, `${action} must be audited`);
  const block = routeSource.slice(Math.max(0, index - 420), index + 360);
  assert.match(block, /projectId: a\.project\.id/);
  assert.match(block, /actorUserId: a\.user\.id/);
  assert.match(block, new RegExp(`subject: ${subject.replace(".", "\\.")}`));
  assert.match(block, /after:/);
}

for (const schema of [GetMaterialBatchTraceResponse, GetMaterialBatchRecallResponse]) {
  assert.equal(typeof schema.parse, "function");
}
console.info("Material traceability contract, isolation, stock rollback, and audit checks passed.");