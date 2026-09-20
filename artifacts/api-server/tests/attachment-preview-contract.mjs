import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const directory = await mkdtemp(path.join(tmpdir(), "attachment-preview-"));
const output = path.join(directory, "attachment-preview.cjs");

await build({
  entryPoints: [path.resolve("src/lib/attachment-preview.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: output,
  external: ["@google-cloud/storage"],
});

const { createHeicPreview, needsHeicPreview } = await import(pathToFileURL(output).href);

assert.equal(needsHeicPreview("image/heic", "photo"), true);
assert.equal(needsHeicPreview("application/octet-stream", "photo.HEIF"), true);
assert.equal(needsHeicPreview("image/jpeg", "photo.jpg"), false);

function fakeFile(bytes = Buffer.from("heic")) {
  const state = { saved: null, deleted: false };
  return {
    state,
    async download() {
      return [bytes];
    },
    async save(outputBytes, options) {
      state.saved = { outputBytes, options };
    },
    async delete() {
      state.deleted = true;
    },
  };
}

const source = fakeFile();
const preview = fakeFile();
const converted = await createHeicPreview(
  source,
  preview,
  "/objects/uploads/test-preview",
  async ({ buffer, format, quality }) => {
    assert.deepEqual(buffer, Buffer.from("heic"));
    assert.equal(format, "JPEG");
    assert.equal(quality, 0.85);
    return Buffer.from("jpeg");
  },
);
assert.deepEqual(converted, {
  status: "ready",
  objectPath: "/objects/uploads/test-preview",
  error: null,
});
assert.deepEqual(preview.state.saved.outputBytes, Buffer.from("jpeg"));
assert.equal(preview.state.saved.options.metadata.contentType, "image/jpeg");

const failedPreview = fakeFile();
const failed = await createHeicPreview(
  source,
  failedPreview,
  "/objects/uploads/failed-preview",
  async () => {
    throw new Error("invalid HEIC");
  },
);
assert.equal(failed.status, "failed");
assert.match(failed.error, /invalid HEIC/);
assert.equal(failedPreview.state.deleted, true);

await readFile(output);
await rm(directory, { recursive: true, force: true });
console.info("Attachment preview contract checks passed.");