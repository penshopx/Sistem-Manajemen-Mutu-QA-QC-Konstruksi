import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const directory = await mkdtemp(path.join(tmpdir(), "qaqc-upload-cleanup-"));
const entry = path.join(directory, "entry.ts");
const output = path.join(directory, "entry.mjs");

await writeFile(entry, `
  export { runAttachmentUploadCleanup } from "${path.resolve("src/lib/attachment-upload-cleanup.ts").replaceAll("\\", "/")}";
`);
await build({
  entryPoints: [entry],
  outfile: output,
  bundle: true,
  format: "esm",
  platform: "node",
});

const { runAttachmentUploadCleanup } = await import(pathToFileURL(output).href);
const now = new Date("2026-09-20T12:00:00.000Z");

function createHarness({ uploads, attachments = [], objects, failDeletes = 0 }) {
  const state = {
    uploads: new Map(uploads.map((upload) => [upload.id, structuredClone(upload)])),
    attachments: new Set(attachments),
    objects: new Set(objects),
    deleteAttempts: new Map(),
    failDeletes,
  };

  const dependencies = {
    async listCandidates(cleanupNow, staleClaimBefore) {
      return [...state.uploads.values()]
        .filter((upload) => upload.expiresAt < cleanupNow
          && (!upload.cleanupStartedAt || upload.cleanupStartedAt < staleClaimBefore))
        .map(({ id, objectPath }) => ({ id, objectPath }));
    },
    async claimCandidate(id, cleanupNow, staleClaimBefore) {
      const upload = state.uploads.get(id);
      if (!upload || (upload.cleanupStartedAt && upload.cleanupStartedAt >= staleClaimBefore)) return false;
      upload.cleanupStartedAt = cleanupNow;
      return true;
    },
    async hasAttachment(objectPath) {
      return state.attachments.has(objectPath);
    },
    async deleteObject(objectPath) {
      state.deleteAttempts.set(objectPath, (state.deleteAttempts.get(objectPath) ?? 0) + 1);
      if (state.failDeletes > 0) {
        state.failDeletes -= 1;
        throw new Error("forced storage failure");
      }
      state.objects.delete(objectPath);
    },
    async deleteTrackingRow(id) {
      state.uploads.delete(id);
    },
    async releaseClaim(id) {
      const upload = state.uploads.get(id);
      if (upload) upload.cleanupStartedAt = null;
    },
  };
  return { state, dependencies };
}

function expiredUpload(id, objectPath) {
  return {
    id,
    objectPath,
    expiresAt: new Date(now.getTime() - 1),
    cleanupStartedAt: null,
  };
}

{
  const orphanPath = "/objects/uploads/00000000-0000-0000-0000-000000000001";
  const harness = createHarness({
    uploads: [expiredUpload("upload-orphan", orphanPath)],
    objects: [orphanPath],
  });
  const result = await runAttachmentUploadCleanup(harness.dependencies, now);
  assert.deepEqual(result, { scanned: 1, deleted: 1, preserved: 0, failed: 0 });
  assert.equal(harness.state.objects.has(orphanPath), false, "expired orphan object must be deleted");
  assert.equal(harness.state.uploads.has("upload-orphan"), false, "expired orphan tracking row must be deleted");
}

{
  const attachedPath = "/objects/uploads/00000000-0000-0000-0000-000000000002";
  const harness = createHarness({
    uploads: [expiredUpload("upload-attached", attachedPath)],
    attachments: [attachedPath],
    objects: [attachedPath],
  });
  const result = await runAttachmentUploadCleanup(harness.dependencies, now);
  assert.deepEqual(result, { scanned: 1, deleted: 0, preserved: 1, failed: 0 });
  assert.equal(harness.state.objects.has(attachedPath), true, "attached object must never be deleted");
  assert.equal(harness.state.uploads.has("upload-attached"), false, "obsolete tracking row may be removed");
  assert.equal(harness.state.deleteAttempts.get(attachedPath), undefined, "storage deletion must not be attempted");
}

{
  const retryPath = "/objects/uploads/00000000-0000-0000-0000-000000000003";
  const harness = createHarness({
    uploads: [expiredUpload("upload-retry", retryPath)],
    objects: [retryPath],
    failDeletes: 1,
  });
  const first = await runAttachmentUploadCleanup(harness.dependencies, now);
  assert.deepEqual(first, { scanned: 1, deleted: 0, preserved: 0, failed: 1 });
  assert.equal(harness.state.uploads.get("upload-retry").cleanupStartedAt, null, "storage failure must release claim");
  const second = await runAttachmentUploadCleanup(harness.dependencies, new Date(now.getTime() + 1));
  assert.deepEqual(second, { scanned: 1, deleted: 1, preserved: 0, failed: 0 });
  assert.equal(harness.state.deleteAttempts.get(retryPath), 2, "released upload must be retried");
}

{
  const parallelPath = "/objects/uploads/00000000-0000-0000-0000-000000000004";
  const harness = createHarness({
    uploads: [expiredUpload("upload-parallel", parallelPath)],
    objects: [parallelPath],
  });
  const [first, second] = await Promise.all([
    runAttachmentUploadCleanup(harness.dependencies, now),
    runAttachmentUploadCleanup(harness.dependencies, now),
  ]);
  assert.equal(first.deleted + second.deleted, 1, "only one cleaner may delete the object");
  assert.equal(harness.state.deleteAttempts.get(parallelPath), 1, "parallel cleaners must not process object twice");
  assert.equal(harness.state.uploads.has("upload-parallel"), false);
}

console.info("Attachment upload cleanup integration checks passed.");