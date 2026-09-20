import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import jpeg from "jpeg-js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));

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

const iphonePortrait = await readFile(
  path.join(testDirectory, "fixtures", "iphone-portrait.heic"),
);
assert.notEqual(
  iphonePortrait.indexOf(Buffer.from("irot")),
  -1,
  "Fixture harus mempertahankan properti rotasi HEIF dari iPhone",
);

const realSource = fakeFile(iphonePortrait);
const realPreview = fakeFile();
const realConversion = await createHeicPreview(
  realSource,
  realPreview,
  "/objects/uploads/iphone-portrait-preview",
);
assert.equal(realConversion.status, "ready");

const jpegBytes = realPreview.state.saved.outputBytes;
assert.deepEqual(jpegBytes.subarray(0, 2), Buffer.from([0xff, 0xd8]));
assert.deepEqual(jpegBytes.subarray(-2), Buffer.from([0xff, 0xd9]));

const decodedPreview = jpeg.decode(jpegBytes, {
  formatAsRGBA: true,
  useTArray: true,
});
assert.equal(decodedPreview.width, 3024);
assert.equal(decodedPreview.height, 4032);

function averageRgb(image, centerX, centerY, radius = 80) {
  const totals = [0, 0, 0];
  let pixels = 0;
  for (let y = centerY - radius; y < centerY + radius; y += 1) {
    for (let x = centerX - radius; x < centerX + radius; x += 1) {
      const offset = (y * image.width + x) * 4;
      totals[0] += image.data[offset];
      totals[1] += image.data[offset + 1];
      totals[2] += image.data[offset + 2];
      pixels += 1;
    }
  }
  return totals.map((value) => value / pixels);
}

const uprightSubject = averageRgb(
  decodedPreview,
  Math.floor(decodedPreview.width * 0.5),
  Math.floor(decodedPreview.height * 0.72),
);
assert.ok(
  uprightSubject[0] > uprightSubject[1] * 1.7
    && uprightSubject[1] > uprightSubject[2] * 1.8,
  "Subjek berwarna cokelat harus tetap berada di bagian bawah foto potret",
);

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