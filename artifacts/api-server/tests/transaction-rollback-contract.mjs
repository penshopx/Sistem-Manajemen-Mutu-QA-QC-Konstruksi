import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const directory = await mkdtemp(path.join(tmpdir(), "qaqc-transaction-rollback-"));
const entry = path.join(directory, "entry.ts");
const output = path.join(directory, "entry.mjs");

await writeFile(entry, `
  export { executeAuditedMutation } from "${path.resolve("src/lib/record-transaction.ts").replaceAll("\\", "/")}";
  export { apiErrorHandler } from "${path.resolve("src/middlewares/apiErrorHandler.ts").replaceAll("\\", "/")}";
`);

await build({
  entryPoints: [entry],
  outfile: output,
  bundle: true,
  format: "esm",
  platform: "node",
});

const { executeAuditedMutation, apiErrorHandler } = await import(pathToFileURL(output).href);

function createDatabase(initialRecords = []) {
  const state = {
    records: new Map(initialRecords.map((record) => [record.id, structuredClone(record)])),
    audits: [],
  };

  return {
    state,
    async transaction(operation) {
      const pending = {
        records: new Map([...state.records].map(([id, record]) => [id, structuredClone(record)])),
        audits: structuredClone(state.audits),
      };
      const result = await operation(pending);
      state.records = pending.records;
      state.audits = pending.audits;
      return result;
    },
  };
}

async function expectAuditFailureRollback({ initialRecords, mutate, expectedRecords }) {
  const database = createDatabase(initialRecords);
  let response;

  try {
    const result = await database.transaction((tx) => executeAuditedMutation(
      tx,
      mutate,
      async () => {
        throw new Error("forced audit write failure");
      },
    ));
    response = { status: 200, body: result };
  } catch (error) {
    let status;
    let body;
    apiErrorHandler(
      error,
      { log: { error() {} } },
      {
        status(code) {
          status = code;
          return this;
        },
        json(value) {
          body = value;
          return this;
        },
      },
      () => {},
    );
    response = { status, body };
  }

  assert.deepEqual([...database.state.records.values()], expectedRecords);
  assert.deepEqual(database.state.audits, [], "rollback must not leave a partial audit event");
  assert.equal(response.status, 500, "failed mutation must return an API error");
  assert.deepEqual(response.body, { error: "Permintaan gagal diproses. Silakan coba lagi." });
}

async function expectMutationFailureRollback({ initialRecords, mutate, expectedRecords }) {
  const database = createDatabase(initialRecords);
  let auditAttempted = false;
  let response;

  try {
    const result = await database.transaction((tx) => executeAuditedMutation(
      tx,
      mutate,
      async () => {
        auditAttempted = true;
        tx.audits.push({ action: "should-not-exist" });
      },
    ));
    response = { status: 200, body: result };
  } catch (error) {
    let status;
    let body;
    apiErrorHandler(
      error,
      { log: { error() {} } },
      {
        status(code) {
          status = code;
          return this;
        },
        json(value) {
          body = value;
          return this;
        },
      },
      () => {},
    );
    response = { status, body };
  }

  assert.deepEqual([...database.state.records.values()], expectedRecords);
  assert.equal(auditAttempted, false, "audit must not run after a failed record write");
  assert.deepEqual(database.state.audits, []);
  assert.equal(response.status, 500, "failed mutation must return an API error");
  assert.deepEqual(response.body, { error: "Permintaan gagal diproses. Silakan coba lagi." });
}

const original = { id: "ncr-1", status: "Open" };

await expectAuditFailureRollback({
  initialRecords: [],
  mutate: async (tx) => {
    tx.records.set(original.id, original);
    return original;
  },
  expectedRecords: [],
});

await expectAuditFailureRollback({
  initialRecords: [original],
  mutate: async (tx) => {
    const updated = { ...tx.records.get(original.id), status: "Closed" };
    tx.records.set(original.id, updated);
    return updated;
  },
  expectedRecords: [original],
});

await expectAuditFailureRollback({
  initialRecords: [original],
  mutate: async (tx) => {
    tx.records.delete(original.id);
    return true;
  },
  expectedRecords: [original],
});

await expectMutationFailureRollback({
  initialRecords: [],
  mutate: async (tx) => {
    tx.records.set(original.id, original);
    throw new Error("forced create failure");
  },
  expectedRecords: [],
});

await expectMutationFailureRollback({
  initialRecords: [original],
  mutate: async (tx) => {
    tx.records.set(original.id, { ...original, status: "Closed" });
    throw new Error("forced update failure");
  },
  expectedRecords: [original],
});

await expectMutationFailureRollback({
  initialRecords: [original],
  mutate: async (tx) => {
    tx.records.delete(original.id);
    throw new Error("forced delete failure");
  },
  expectedRecords: [original],
});

console.info("Create, update, and delete rollback checks passed.");