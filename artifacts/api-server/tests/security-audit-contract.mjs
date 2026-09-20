import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const directory = await mkdtemp(path.join(tmpdir(), "qaqc-security-audit-"));
const entry = path.join(directory, "entry.ts");
const output = path.join(directory, "entry.mjs");

await writeFile(entry, `
  export { createRequireAuth } from "${path.resolve("src/middlewares/auth.ts").replaceAll("\\", "/")}";
  export { canMutate } from "${path.resolve("src/lib/rbac.ts").replaceAll("\\", "/")}";
  export {
    createdRecordAudit,
    updatedRecordAudit,
    deletedRecordAudit,
  } from "${path.resolve("src/lib/record-audit.ts").replaceAll("\\", "/")}";
`);

await build({
  entryPoints: [entry],
  outfile: output,
  bundle: true,
  format: "esm",
  platform: "node",
});

const {
  createRequireAuth,
  canMutate,
  createdRecordAudit,
  updatedRecordAudit,
  deletedRecordAudit,
} = await import(pathToFileURL(output).href);

{
  let statusCode;
  let responseBody;
  let nextCalled = false;
  const response = {
    locals: {},
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };
  createRequireAuth(() => ({ userId: null }))({}, response, () => {
    nextCalled = true;
  });
  assert.equal(statusCode, 401);
  assert.deepEqual(responseBody, { error: "Silakan masuk untuk mengakses proyek." });
  assert.equal(nextCalled, false, "anonymous requests must never reach a workspace handler");
}

{
  const response = { locals: {} };
  let nextCalled = false;
  createRequireAuth(() => ({ sessionClaims: { userId: "clerk-user-1" } }))(
    {},
    response,
    () => { nextCalled = true; },
  );
  assert.equal(response.locals.clerkUserId, "clerk-user-1");
  assert.equal(nextCalled, true);
}

const collections = ["qualityPlans", "itps", "inspections", "ncrs", "documents", "audits"];
const actions = ["create", "update", "delete"];
const expected = {
  QA_ENGINEER: () => true,
  QC_INSPECTOR: (collection, action) =>
    (collection === "inspections" || collection === "ncrs") && action !== "delete",
  SITE_MANAGER: (_collection, action) => action === "update",
  PROJECT_MANAGER: () => false,
};

for (const [role, isAllowed] of Object.entries(expected)) {
  for (const collection of collections) {
    for (const action of actions) {
      assert.equal(
        canMutate(role, collection, action),
        isAllowed(collection, action),
        `${role} ${action} ${collection}`,
      );
    }
  }
}

const context = {
  projectId: "project-1",
  actorUserId: "actor-1",
  recordType: "ncrs",
  recordId: "ncr-1",
};
const before = { id: "ncr-1", number: "NCR-001", status: "Open", owner: "Site Team" };
const after = { ...before, status: "Closed" };

assert.deepEqual(createdRecordAudit(context, before), {
  ...context,
  action: "Created",
  subject: "NCR-001",
  after: before,
});
assert.deepEqual(updatedRecordAudit(context, before, after), {
  ...context,
  action: "Updated",
  subject: "NCR-001",
  before,
  after,
});
assert.deepEqual(deletedRecordAudit(context, after), {
  ...context,
  action: "Deleted",
  subject: "NCR-001",
  before: after,
});

const workspaceSource = await readFile(path.resolve("src/routes/workspace.ts"), "utf8");
const auditContracts = [
  {
    action: "Invited member",
    requiredFields: [
      "projectId: access.project.id",
      "actorUserId: access.user.id",
      "subject: email",
      "after: { email, role: body.data.role }",
    ],
  },
  {
    action: "Added evidence",
    requiredFields: [
      "projectId: access.project.id",
      "actorUserId: access.user.id",
      "recordType: params.data.collection",
      "recordId: params.data.id",
      "subject: body.data.fileName",
      "after: { attachmentId: inserted[0].id, fileName: body.data.fileName, size: body.data.size }",
    ],
  },
  {
    action: "Deleted evidence",
    requiredFields: [
      "projectId: access.project.id",
      "actorUserId: access.user.id",
      "recordType: params.data.collection",
      "recordId: params.data.id",
      "subject: existing.fileName",
      "before: { attachmentId: existing.id, fileName: existing.fileName, size: existing.size }",
    ],
  },
];

for (const contract of auditContracts) {
  const actionIndex = workspaceSource.indexOf(`action: "${contract.action}"`);
  assert.notEqual(actionIndex, -1, `${contract.action} must create an audit event`);
  const auditBlock = workspaceSource.slice(Math.max(0, actionIndex - 220), actionIndex + 320);
  for (const field of contract.requiredFields) {
    assert.ok(
      auditBlock.includes(field),
      `${contract.action} audit must preserve ${field}`,
    );
  }
}

console.info("Authentication, role matrix, and record audit checks passed.");