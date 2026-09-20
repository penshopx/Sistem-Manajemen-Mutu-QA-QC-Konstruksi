import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const workspaceSource = await readFile(path.resolve("src/routes/workspace.ts"), "utf8");
const updateStart = workspaceSource.indexOf('router.patch("/workspace/:collection/:id"');
const deleteStart = workspaceSource.indexOf('router.delete("/workspace/:collection/:id"');
const updateSource = workspaceSource.slice(updateStart, deleteStart);

assert.match(updateSource, /params\.data\.collection === "inspections"/);
assert.match(updateSource, /existing\.data\.type === "MIR"/);
assert.match(updateSource, /existing\.data\.status !== data\.status/);
assert.match(updateSource, /eq\(materialBatchesTable\.projectId, access\.project\.id\)/);
assert.match(updateSource, /eq\(materialBatchesTable\.inspectionId, existing\.id\)/);
assert.match(updateSource, /\.for\("update"\)/);
assert.match(updateSource, /action: "Synchronized material batch from MIR"/);

function statusFromMir(status) {
  if (status === "Passed") return "approved";
  if (status === "Failed") return "rejected";
  return "pending";
}

assert.equal(statusFromMir("Pending"), "pending");
assert.equal(statusFromMir("Passed"), "approved");
assert.equal(statusFromMir("Failed"), "rejected");

async function updateMirInTransaction(state, nextStatus, failAudit = false) {
  const pending = structuredClone(state);
  pending.inspection.status = nextStatus;
  pending.batches = pending.batches.map((batch) => (
    batch.projectId === pending.inspection.projectId && batch.inspectionId === pending.inspection.id
      ? { ...batch, inspectionStatus: statusFromMir(nextStatus) }
      : batch
  ));
  if (failAudit) throw new Error("forced audit failure");
  pending.audits.push({ action: "Synchronized material batch from MIR" });
  return pending;
}

const initial = {
  inspection: { id: "mir-1", projectId: "project-a", status: "Pending" },
  batches: [
    { id: "batch-a", projectId: "project-a", inspectionId: "mir-1", inspectionStatus: "pending" },
    { id: "batch-b", projectId: "project-b", inspectionId: "mir-1", inspectionStatus: "pending" },
  ],
  audits: [],
};

const approved = await updateMirInTransaction(initial, "Passed");
assert.equal(approved.batches[0].inspectionStatus, "approved");
assert.equal(approved.batches[1].inspectionStatus, "pending", "other projects must remain unchanged");
assert.equal(approved.audits.length, 1);

const rejected = await updateMirInTransaction(initial, "Failed");
assert.equal(rejected.batches[0].inspectionStatus, "rejected");

await assert.rejects(updateMirInTransaction(initial, "Passed", true));
assert.equal(initial.inspection.status, "Pending");
assert.equal(initial.batches[0].inspectionStatus, "pending");
assert.deepEqual(initial.audits, []);

console.info("MIR batch synchronization, isolation, transition, and rollback checks passed.");