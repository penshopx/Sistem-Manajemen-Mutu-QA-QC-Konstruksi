import pg from "pg";

const tenantTables = [
  "project_memberships",
  "project_invitations",
  "qaqc_records",
  "qaqc_record_attachments",
  "qaqc_attachment_uploads",
  "qaqc_attachment_cleanup_events",
  "audit_events",
  "material_types",
  "material_storage_locations",
  "material_batches",
  "material_inventory",
  "material_usage",
];

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("begin");
  await client.query(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'qaqc_app') then
        create role qaqc_app nologin nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
      end if;
    end
    $$
  `);
  await client.query("grant usage on schema public to qaqc_app");
  await client.query("grant select, insert, update, delete on all tables in schema public to qaqc_app");
  await client.query("grant usage, select on all sequences in schema public to qaqc_app");
  for (const table of tenantTables) {
    await client.query(`drop policy if exists "project_isolation" on "${table}"`);
    await client.query(`
      create policy "project_isolation" on "${table}"
      as permissive for all to public
      using (
        project_id = nullif(current_setting('app.current_project_id', true), '')::uuid
        or current_setting('app.tenant_bootstrap', true) = 'on'
      )
      with check (
        project_id = nullif(current_setting('app.current_project_id', true), '')::uuid
        or current_setting('app.tenant_bootstrap', true) = 'on'
      )
    `);
    await client.query(`alter table "${table}" force row level security`);
  }
  await client.query("commit");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}

console.info(`Applied and forced tenant row-level security on ${tenantTables.length} tables.`);