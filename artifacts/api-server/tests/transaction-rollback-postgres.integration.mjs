import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { build } from "esbuild";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const directory = await mkdtemp(path.join(tmpdir(), "qaqc-postgres-rollback-"));
const entry = path.join(directory, "entry.ts");
const output = path.join(directory, "entry.cjs");
const authStub = path.join(directory, "auth-stub.ts");
const accessStub = path.join(directory, "project-access-stub.ts");

await writeFile(authStub, `
  export function requireAuth(_req, res, next) {
    res.locals.clerkUserId = "postgres-integration-user";
    next();
  }
`);
await writeFile(accessStub, `
  export { canManageAttachment, canMutate } from "${path.resolve("src/lib/rbac.ts").replaceAll("\\", "/")}";
  export class ProjectAccessError extends Error {}
  export async function ensureProjectAccess() {
    return {
      user: { id: process.env.QAQC_TEST_USER_ID, name: "PostgreSQL integration user" },
      membership: { role: "QA_ENGINEER" },
      project: { id: process.env.QAQC_TEST_PROJECT_ID },
      permissions: ["read", "create", "update", "delete"],
    };
  }
`);

await writeFile(entry, `
  import express from "${path.resolve("node_modules/express/index.js").replaceAll("\\", "/")}";
  import workspaceRouter from "${path.resolve("src/routes/workspace.ts").replaceAll("\\", "/")}";
  import { apiErrorHandler } from "${path.resolve("src/middlewares/apiErrorHandler.ts").replaceAll("\\", "/")}";
  export function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.log = { error() {} };
      next();
    });
    app.use("/api", workspaceRouter);
    app.use("/api", apiErrorHandler);
    return app;
  }
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
  plugins: [{
    name: "postgres-endpoint-test-stubs",
    setup(buildApi) {
      buildApi.onResolve({ filter: /middlewares\/auth$/ }, () => ({ path: authStub }));
      buildApi.onResolve({ filter: /lib\/project-access$/ }, () => ({ path: accessStub }));
    },
  }],
});

process.env.NODE_ENV = "production";
const { createTestApp, db, executeAuditedMutation, pool, sql } = await import(pathToFileURL(output).href);
const fixture = {
  projectId: randomUUID(),
  userId: randomUUID(),
  recordId: `rollback-${randomUUID()}`,
  createRecordId: `rollback-create-${randomUUID()}`,
};
process.env.QAQC_TEST_PROJECT_ID = fixture.projectId;
process.env.QAQC_TEST_USER_ID = fixture.userId;
const databaseMarker = `sensitive-postgres-${randomUUID()}`;
const objectSuffix = randomUUID().replaceAll("-", "");
const faultTable = `qaqc_test_fault_${objectSuffix}`;
const recordFaultFunction = `qaqc_test_record_fault_${objectSuffix}`;
const auditFaultFunction = `qaqc_test_audit_fault_${objectSuffix}`;
const recordTrigger = `qaqc_test_record_trigger_${objectSuffix}`;
const auditTrigger = `qaqc_test_audit_trigger_${objectSuffix}`;

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

async function setEndpointFault(stage, operation) {
  await pool.query(`delete from ${faultTable}`);
  await pool.query(
    `insert into ${faultTable} (project_id, stage, operation) values ($1, $2, $3)`,
    [fixture.projectId, stage, operation],
  );
}

async function request(appUrl, method, route, body) {
  const response = await fetch(`${appUrl}${route}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, text, body: text ? JSON.parse(text) : undefined };
}

async function expectSafeEndpointFailure(appUrl, {
  label,
  method,
  route,
  body,
  stage,
  operation,
}) {
  await setEndpointFault(stage, operation);
  const before = await snapshot();
  const response = await request(appUrl, method, route, body);
  assert.equal(response.status, 500, `${label} must return HTTP 500`);
  assert.deepEqual(
    response.body,
    { error: "Permintaan gagal diproses. Silakan coba lagi." },
    `${label} must return the generic API error`,
  );
  assert.equal(response.text.includes(databaseMarker), false, `${label} must not leak the database error`);
  assert.equal(response.text.toLowerCase().includes("postgres"), false, `${label} must not identify PostgreSQL`);
  assert.deepEqual(await snapshot(), before, `${label} must roll back records and audit events`);
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

  await pool.query(`
    create table ${faultTable} (
      project_id uuid primary key,
      stage text not null,
      operation text not null
    )
  `);
  await pool.query(`
    create function ${recordFaultFunction}() returns trigger
    language plpgsql security definer
    set search_path = pg_catalog, public
    as $$
    declare target_project uuid;
    begin
      target_project := case when TG_OP = 'DELETE' then OLD.project_id else NEW.project_id end;
      if exists (
        select 1 from public.${faultTable}
        where project_id = target_project
          and stage = 'record'
          and operation = lower(TG_OP)
      ) then
        raise exception '${databaseMarker}' using errcode = '23514';
      end if;
      return case when TG_OP = 'DELETE' then OLD else NEW end;
    end
    $$
  `);
  await pool.query(`
    create function ${auditFaultFunction}() returns trigger
    language plpgsql security definer
    set search_path = pg_catalog, public
    as $$
    begin
      if exists (
        select 1 from public.${faultTable}
        where project_id = NEW.project_id and stage = 'audit'
      ) then
        raise exception '${databaseMarker}' using errcode = '23514';
      end if;
      return NEW;
    end
    $$
  `);
  await pool.query(`
    create trigger ${recordTrigger}
    before insert or update or delete on qaqc_records
    for each row execute function ${recordFaultFunction}()
  `);
  await pool.query(`
    create trigger ${auditTrigger}
    before insert on audit_events
    for each row execute function ${auditFaultFunction}()
  `);

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

  const server = createTestApp().listen(0, "127.0.0.1");
  try {
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const address = server.address();
    assert(address && typeof address === "object");
    const appUrl = `http://127.0.0.1:${address.port}`;
    const endpointCases = [
      {
        label: "create record constraint failure",
        method: "POST",
        route: "/api/workspace/ncrs",
        body: { id: fixture.createRecordId, status: "Open" },
        operation: "insert",
      },
      {
        label: "update record constraint failure",
        method: "PATCH",
        route: `/api/workspace/ncrs/${fixture.recordId}`,
        body: { status: "Closed" },
        operation: "update",
      },
      {
        label: "delete record constraint failure",
        method: "DELETE",
        route: `/api/workspace/ncrs/${fixture.recordId}`,
        operation: "delete",
      },
    ];
    for (const endpointCase of endpointCases) {
      await expectSafeEndpointFailure(appUrl, { ...endpointCase, stage: "record" });
      await expectSafeEndpointFailure(appUrl, { ...endpointCase, stage: "audit" });
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.info("PostgreSQL create, update, and delete rollback and safe endpoint checks passed.");
} finally {
  await pool.query(`drop trigger if exists ${recordTrigger} on qaqc_records`).catch(() => {});
  await pool.query(`drop trigger if exists ${auditTrigger} on audit_events`).catch(() => {});
  await pool.query(`drop function if exists ${recordFaultFunction}()`).catch(() => {});
  await pool.query(`drop function if exists ${auditFaultFunction}()`).catch(() => {});
  await pool.query(`drop table if exists ${faultTable}`).catch(() => {});
  await pool.query("delete from projects where id = $1", [fixture.projectId]).catch(() => {});
  await pool.query("delete from users where id = $1", [fixture.userId]).catch(() => {});
  await pool.end();
  await rm(directory, { recursive: true, force: true });
}