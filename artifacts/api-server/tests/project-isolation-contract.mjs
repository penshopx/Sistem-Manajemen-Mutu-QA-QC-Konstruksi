import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const directory = await mkdtemp(path.join(tmpdir(), "qaqc-project-isolation-"));
const entry = path.join(directory, "entry.ts");
const output = path.join(directory, "entry.mjs");

await writeFile(entry, `
  export {
    invitationMembership,
    onlyProjectRows,
  } from "${path.resolve("src/lib/project-scope.ts").replaceAll("\\", "/")}";
`);

await build({
  entryPoints: [entry],
  outfile: output,
  bundle: true,
  format: "esm",
  platform: "node",
});

const { invitationMembership, onlyProjectRows } = await import(pathToFileURL(output).href);

const projects = [{ id: "project-a" }, { id: "project-b" }];
const users = [{ id: "user-a" }, { id: "user-b" }];
const memberships = [
  { id: "membership-a", projectId: projects[0].id, userId: users[0].id },
  { id: "membership-b", projectId: projects[1].id, userId: users[1].id },
];
const records = [
  { id: "record-a", projectId: projects[0].id },
  { id: "record-b", projectId: projects[1].id },
];
const attachments = [
  { id: "attachment-a", projectId: projects[0].id, recordId: records[0].id },
  { id: "attachment-b", projectId: projects[1].id, recordId: records[1].id },
];
const audits = [
  { id: "audit-a", projectId: projects[0].id },
  { id: "audit-b", projectId: projects[1].id },
];
const invitations = [
  { id: "invitation-a", projectId: projects[0].id, email: "a@example.com", role: "QC_INSPECTOR" },
  { id: "invitation-b", projectId: projects[1].id, email: "b@example.com", role: "SITE_MANAGER" },
];

for (const [index, project] of projects.entries()) {
  assert.deepEqual(onlyProjectRows(project.id, records).map(({ id }) => id), [`record-${index ? "b" : "a"}`]);
  assert.deepEqual(onlyProjectRows(project.id, attachments).map(({ id }) => id), [`attachment-${index ? "b" : "a"}`]);
  assert.deepEqual(onlyProjectRows(project.id, memberships).map(({ id }) => id), [`membership-${index ? "b" : "a"}`]);
  assert.deepEqual(onlyProjectRows(project.id, audits).map(({ id }) => id), [`audit-${index ? "b" : "a"}`]);
  assert.deepEqual(onlyProjectRows(project.id, invitations).map(({ id }) => id), [`invitation-${index ? "b" : "a"}`]);
}

assert.deepEqual(invitationMembership(invitations[1], users[1].id), {
  projectId: projects[1].id,
  userId: users[1].id,
  role: "SITE_MANAGER",
});

const workspaceSource = await readFile(path.resolve("src/routes/workspace.ts"), "utf8");
for (const table of ["qaqcRecordsTable", "recordAttachmentsTable"]) {
  assert.match(
    workspaceSource,
    new RegExp(`eq\\(${table}\\.id, params\\.data\\.(?:id|attachmentId)\\)[\\s\\S]{0,240}eq\\(${table}\\.projectId, access\\.project\\.id\\)`),
    `${table} lookup by ID must also require the current project`,
  );
}

for (const route of ["workspace.ts", "materials.ts", "operations.ts"]) {
  const source = await readFile(path.resolve("src/routes", route), "utf8");
  assert.doesNotMatch(
    source,
    /import\s*\{[^}]*\bdb\b[^}]*\}\s*from\s*["']@workspace\/db["']/s,
    `${route} must not use the global database connection for tenant data`,
  );
  assert.match(source, /tenantDatabase as db/, `${route} must use the tenant-scoped database`);
}

console.info("Cross-project workspace isolation checks passed.");