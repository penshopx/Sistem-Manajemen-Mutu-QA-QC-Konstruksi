import assert from "node:assert/strict";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  const { rows: protectedTables } = await client.query(`
    select c.relname, c.relrowsecurity, c.relforcerowsecurity,
      exists (
        select 1 from pg_policies p
        where p.schemaname = 'public'
          and p.tablename = c.relname
          and p.policyname = 'project_isolation'
      ) as has_policy
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and a.attname = 'project_id'
      and a.attnum > 0
      and not a.attisdropped
    order by c.relname
  `);

  assert.ok(protectedTables.length > 0, "the schema must contain project-scoped tables");
  for (const table of protectedTables) {
    assert.equal(table.relrowsecurity, true, `${table.relname} must enable RLS`);
    assert.equal(table.relforcerowsecurity, true, `${table.relname} must force RLS for its owner`);
    assert.equal(table.has_policy, true, `${table.relname} must have the tenant policy`);
  }

  await client.query("begin");
  await client.query("set local role qaqc_app");
  await client.query("select set_config('app.tenant_bootstrap', 'on', true)");
  const { rows: projects } = await client.query(`
    insert into projects (name, code, client, contractor)
    values
      ('RLS project A', 'RLS-A-' || gen_random_uuid(), 'Test', 'Test'),
      ('RLS project B', 'RLS-B-' || gen_random_uuid(), 'Test', 'Test')
    returning id
  `);
  const { rows: users } = await client.query(`
    insert into users (clerk_user_id, name)
    values ('rls-a-' || gen_random_uuid(), 'RLS A'), ('rls-b-' || gen_random_uuid(), 'RLS B')
    returning id
  `);
  await client.query(`
    insert into qaqc_records (id, project_id, type, data, created_by, updated_by)
    values
      ('rls-a-' || gen_random_uuid(), $1, 'inspections', '{"marker":"a"}', $3, $3),
      ('rls-b-' || gen_random_uuid(), $2, 'inspections', '{"marker":"b"}', $4, $4)
  `, [projects[0].id, projects[1].id, users[0].id, users[1].id]);
  const { rows: uploads } = await client.query(`
    insert into qaqc_attachment_uploads
      (project_id, record_id, record_type, object_path, requested_by, expires_at)
    values
      ($1, 'record-a', 'inspections', '/rls/a/' || gen_random_uuid(), $3, now()),
      ($2, 'record-b', 'inspections', '/rls/b/' || gen_random_uuid(), $4, now())
    returning id
  `, [projects[0].id, projects[1].id, users[0].id, users[1].id]);
  await client.query(`
    insert into qaqc_attachment_cleanup_events (project_id, upload_id, outcome)
    values ($1, $3, 'failed'), ($2, $4, 'failed')
  `, [projects[0].id, projects[1].id, uploads[0].id, uploads[1].id]);

  await client.query("select set_config('app.tenant_bootstrap', 'off', true)");
  await client.query("select set_config('app.current_project_id', $1, true)", [projects[0].id]);

  const { rows: visible } = await client.query("select project_id, data from qaqc_records where data ? 'marker'");
  assert.deepEqual(visible.map((row) => row.data.marker), ["a"]);
  const { rows: cleanupEvents } = await client.query(
    "select project_id from qaqc_attachment_cleanup_events",
  );
  assert.deepEqual(
    cleanupEvents.map((row) => row.project_id),
    [projects[0].id],
    "unfiltered operations queries must still see only the active project",
  );

  const update = await client.query(
    "update qaqc_records set data = '{\"marker\":\"changed\"}' where project_id = $1",
    [projects[1].id],
  );
  assert.equal(update.rowCount, 0, "project A must not update project B rows");

  const deletion = await client.query("delete from qaqc_records where project_id = $1", [projects[1].id]);
  assert.equal(deletion.rowCount, 0, "project A must not delete project B rows");

  await client.query("savepoint cross_project_insert");
  await assert.rejects(
    client.query(`
      insert into qaqc_records (id, project_id, type, data, created_by, updated_by)
      values ('rls-cross-' || gen_random_uuid(), $1, 'inspections', '{}', $2, $2)
    `, [projects[1].id, users[0].id]),
    /row-level security policy/,
  );
  await client.query("rollback to savepoint cross_project_insert");
  await client.query("rollback");
} finally {
  await client.end();
}

console.info("PostgreSQL tenant RLS read and write isolation checks passed.");