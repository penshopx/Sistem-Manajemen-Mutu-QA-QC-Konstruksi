import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const directory = await mkdtemp(path.join(tmpdir(), "qaqc-contract-"));
const entry = path.join(directory, "entry.ts");
const output = path.join(directory, "entry.mjs");

await writeFile(entry, `
  export {
    CreateWorkspaceRecordBody,
    GetWorkspaceResponse,
  } from "${path.resolve("../../lib/api-zod/src/generated/api.ts").replaceAll("\\", "/")}";
  export { canMutate } from "${path.resolve("src/lib/rbac.ts").replaceAll("\\", "/")}";
`);

await build({
  entryPoints: [entry],
  outfile: output,
  bundle: true,
  format: "esm",
  platform: "node",
});

const {
  CreateWorkspaceRecordBody,
  GetWorkspaceResponse,
  canMutate,
} = await import(pathToFileURL(output).href);

const record = {
  id: "rmk-1",
  title: "RMK Struktur Utama",
  revision: "Rev 03",
  status: "Approved",
};
const parsedRecord = CreateWorkspaceRecordBody.parse(record);
assert.equal(parsedRecord.title, record.title, "create validation must preserve record fields");
assert.equal(parsedRecord.status, record.status, "create validation must preserve status");

const workspace = GetWorkspaceResponse.parse({
  projects: [{
    id: "project-1",
    name: "Gedung Pusat Inovasi",
    code: "PRJ-GPI-24",
    client: "PT Inovasi Mandiri",
    contractor: "Waskita Karya",
    progress: 78,
    qualityScore: 92,
    status: "Active",
  }],
  qualityPlans: [record],
  itps: [],
  inspections: [],
  ncrs: [],
  documents: [],
  audits: [],
  activities: [],
  members: [],
  currentUser: {
    id: "user-1",
    name: "QA Engineer",
    role: "QA_ENGINEER",
    permissions: ["read", "create"],
  },
});
assert.equal(workspace.qualityPlans[0].title, record.title, "response validation must preserve payload");

assert.equal(canMutate("QA_ENGINEER", "documents", "delete"), true);
assert.equal(canMutate("QC_INSPECTOR", "inspections", "create"), true);
assert.equal(canMutate("QC_INSPECTOR", "documents", "create"), false);
assert.equal(canMutate("SITE_MANAGER", "ncrs", "update"), true);
assert.equal(canMutate("PROJECT_MANAGER", "ncrs", "update"), false);

console.info("Workspace contract and RBAC checks passed.");