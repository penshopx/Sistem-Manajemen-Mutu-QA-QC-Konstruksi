import assert from "node:assert/strict";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  const { rows: roles } = await client.query(`
    select rolsuper, rolbypassrls
    from pg_roles
    where rolname = 'qaqc_app'
  `);
  assert.equal(roles.length, 1, "qaqc_app role must exist");
  assert.equal(roles[0].rolsuper, false, "qaqc_app must not be a superuser");
  assert.equal(roles[0].rolbypassrls, false, "qaqc_app must not bypass RLS");

  const { rows: protectedTables } = await client.query(`
    select c.relname, c.relrowsecurity, c.relforcerowsecurity,
      (select count(*)::int
       from pg_policies all_policies
       where all_policies.schemaname = n.nspname
         and all_policies.tablename = c.relname) as policy_count,
      p.permissive,
      p.roles,
      p.cmd,
      p.qual,
      p.with_check
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid
    left join pg_policies p
      on p.schemaname = n.nspname
      and p.tablename = c.relname
      and p.policyname = 'project_isolation'
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and a.attname = 'project_id'
      and a.attnum > 0
      and not a.attisdropped
    order by c.relname
  `);

  assert.ok(protectedTables.length > 0, "the schema must contain project-scoped tables");
  const expectedPolicyExpression =
    "((project_id = (NULLIF(current_setting('app.current_project_id'::text, true), ''::text))::uuid) OR (current_setting('app.tenant_bootstrap'::text, true) = 'on'::text))";
  for (const table of protectedTables) {
    assert.equal(table.relrowsecurity, true, `${table.relname} must enable RLS`);
    assert.equal(table.relforcerowsecurity, true, `${table.relname} must force RLS for its owner`);
    assert.equal(table.policy_count, 1, `${table.relname} must have no unexpected policies`);
    assert.equal(table.permissive, "PERMISSIVE", `${table.relname} policy must be permissive`);
    assert.equal(table.roles, "{qaqc_app}", `${table.relname} policy must target qaqc_app`);
    assert.equal(table.cmd, "ALL", `${table.relname} policy must cover all commands`);
    assert.equal(table.qual, expectedPolicyExpression, `${table.relname} must have the expected USING policy`);
    assert.equal(
      table.with_check,
      expectedPolicyExpression,
      `${table.relname} must have the expected WITH CHECK policy`,
    );
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

  const [{ relname: policyTestTable }] = protectedTables;
  const quotedPolicyTestTable = `"${policyTestTable.replaceAll('"', '""')}"`;

  await client.query("begin");
  await client.query(`
    create policy "unexpected_allow_all" on ${quotedPolicyTestTable}
    as permissive for all to qaqc_app
    using (true)
    with check (true)
  `);
  const { rows: extraPolicyCheck } = await client.query(`
    select count(*)::int as policy_count
    from pg_policies
    where schemaname = 'public' and tablename = $1
  `, [policyTestTable]);
  assert.equal(
    extraPolicyCheck[0].policy_count,
    2,
    "startup catalog check must be able to reject an extra permissive policy",
  );
  await client.query("rollback");

  await client.query("begin");
  await client.query(`
    alter policy "project_isolation" on ${quotedPolicyTestTable} to public
  `);
  const { rows: wrongRoleCheck } = await client.query(`
    select roles = array['qaqc_app']::name[] as targets_application_role
    from pg_policies
    where schemaname = 'public'
      and tablename = $1
      and policyname = 'project_isolation'
  `, [policyTestTable]);
  assert.equal(
    wrongRoleCheck[0].targets_application_role,
    false,
    "startup catalog check must reject a tenant policy assigned to the wrong role",
  );
  await client.query("rollback");
} finally {
  await client.end();
}

console.info("PostgreSQL tenant RLS read and write isolation checks passed.");