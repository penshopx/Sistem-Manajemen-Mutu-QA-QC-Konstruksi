import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { build } from "esbuild";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const directory = await mkdtemp(path.join(tmpdir(), "qaqc-postgres-rollback-"));
const entry = path.join(directory, "entry.ts");
const output = path.join(directory, "entry.cjs");

await writeFile(entry, `
  export { db, pool } from "${path.resolve("../../lib/db/src/index.ts").replaceAll("\\", "/")}";
  export { sql } from "${path.resolve("node_modules/drizzle-orm/index.js").replaceAll("\\", "/")}";
  export { executeAuditedMutation } from "${path.resolve("src/lib/record-transaction.ts").replaceAll("\\", "/")}";
`);
await build({
  entryPoints: [entry],
  outfile: output,
  bundle: true,
  format: "cjs",
  platform: "node",
});

const { db, executeAuditedMutation, pool, sql } = await import(pathToFileURL(output).href);
const fixture = {
  projectId: randomUUID(),
  userId: randomUUID(),
  recordId: `rollback-${randomUUID()}`,
  createRecordId: `rollback-create-${randomUUID()}`,
};

async function snapshot() {
  const [records, audits] = await Promise.all([
    pool.query(
      "select id, data from qaqc_records where project_id = $1 order by id",
      [fixture.projectId],
    ),
    pool.query(
      `select action, subject, record_id, before, after
       from audit_events where project_id = $1
       order by action, subject, record_id`,
      [fixture.projectId],
    ),
  ]);
  return { records: records.rows, audits: audits.rows };
}

async function expectRollback(label, operation) {
  const before = await snapshot();
  await assert.rejects(
    () => db.transaction((transaction) => operation(transaction)),
    undefined,
    `${label} must reject the production transaction`,
  );
  assert.deepEqual(await snapshot(), before, `${label} must restore records and audit events`);
}

async function writeValidAudit(transaction, action) {
  await transaction.execute(sql`
    insert into audit_events
      (project_id, actor_user_id, record_type, record_id, action, subject)
    values (
      ${fixture.projectId},
      ${fixture.userId},
      'ncrs',
      ${fixture.recordId},
      ${action},
      'Rollback fixture'
    )
  `);
}

async function writeInvalidAudit(transaction) {
  await transaction.execute(sql`
    insert into audit_events
      (project_id, actor_user_id, record_type, record_id, action, subject)
    values (${fixture.projectId}, ${fixture.userId}, 'ncrs', ${fixture.recordId}, null, 'Must fail')
  `);
}

try {
  await pool.query(
    `insert into projects (id, name, code, client, contractor)
     values ($1, 'Rollback integration fixture', $2, 'Test', 'Test')`,
    [fixture.projectId, `ROLLBACK-${randomUUID()}`],
  );
  await pool.query(
    `insert into users (id, clerk_user_id, name)
     values ($1, $2, 'Rollback integration fixture')`,
    [fixture.userId, `rollback-${randomUUID()}`],
  );
  await pool.query(
    `insert into qaqc_records (id, project_id, type, data, created_by, updated_by)
     values ($1, $2, 'ncrs', '{"status":"Open"}', $3, $3)`,
    [fixture.recordId, fixture.projectId, fixture.userId],
  );
  await pool.query(
    `insert into audit_events
      (project_id, actor_user_id, record_type, record_id, action, subject)
     values ($1, $2, 'ncrs', $3, 'Fixture created', 'Rollback fixture')`,
    [fixture.projectId, fixture.userId, fixture.recordId],
  );

  await expectRollback("create when the record write violates a constraint", async (transaction) => {
    let auditAttempted = false;
    try {
      await executeAuditedMutation(
      transaction,
      () => transaction.execute(sql`
        insert into qaqc_records (id, project_id, type, data, created_by, updated_by)
        values (
          ${fixture.createRecordId},
          ${fixture.projectId},
          'ncrs',
          null,
          ${fixture.userId},
          ${fixture.userId}
        )
      `),
      async () => {
        auditAttempted = true;
        await writeValidAudit(transaction, "Create should not audit");
      },
      );
    } finally {
      assert.equal(auditAttempted, false);
    }
  });

  await expectRollback("create when the audit write violates a constraint", (transaction) =>
    executeAuditedMutation(
      transaction,
      () => transaction.execute(sql`
        insert into qaqc_records (id, project_id, type, data, created_by, updated_by)
        values (
          ${fixture.createRecordId},
          ${fixture.projectId},
          'ncrs',
          '{"status":"Open"}',
          ${fixture.userId},
          ${fixture.userId}
        )
      `),
      () => writeInvalidAudit(transaction),
    ));

  await expectRollback("update when the record write violates a constraint", async (transaction) => {
    let auditAttempted = false;
    try {
      await executeAuditedMutation(
      transaction,
      () => transaction.execute(sql`
        update qaqc_records set data = null where id = ${fixture.recordId}
      `),
      async () => {
        auditAttempted = true;
        await writeValidAudit(transaction, "Update should not audit");
      },
      );
    } finally {
      assert.equal(auditAttempted, false);
    }
  });

  await expectRollback("update when the audit write violates a constraint", (transaction) =>
    executeAuditedMutation(
      transaction,
      () => transaction.execute(sql`
        update qaqc_records set data = '{"status":"Closed"}' where id = ${fixture.recordId}
      `),
      () => writeInvalidAudit(transaction),
    ));

  await expectRollback("delete when fault injection follows the record write", (transaction) =>
    executeAuditedMutation(
      transaction,
      async () => {
        await transaction.execute(sql`
          delete from qaqc_records where id = ${fixture.recordId}
        `);
        throw new Error("forced delete failure");
      },
      () => writeValidAudit(transaction, "Delete should not audit"),
    ));

  await expectRollback("delete when the audit write violates a constraint", (transaction) =>
    executeAuditedMutation(
      transaction,
      () => transaction.execute(sql`
        delete from qaqc_records where id = ${fixture.recordId}
      `),
      () => writeInvalidAudit(transaction),
    ));

  console.info("PostgreSQL create, update, and delete rollback checks passed.");
} finally {
  await pool.query("delete from projects where id = $1", [fixture.projectId]).catch(() => {});
  await pool.query("delete from users where id = $1", [fixture.userId]).catch(() => {});
  await pool.end();
}