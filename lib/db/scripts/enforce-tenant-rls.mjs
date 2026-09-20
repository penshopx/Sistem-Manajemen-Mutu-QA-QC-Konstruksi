import pg from "pg";

const quoteIdentifier = (identifier) => `"${identifier.replaceAll('"', '""')}"`;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
let tenantTableCount = 0;
try {
  await client.query("begin");
  const { rows: tenantTables } = await client.query(`
    select c.relname
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
  tenantTableCount = tenantTables.length;
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
  for (const { relname } of tenantTables) {
    const table = quoteIdentifier(relname);
    await client.query(`drop policy if exists "project_isolation" on ${table}`);
    await client.query(`
      create policy "project_isolation" on ${table}
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
    await client.query(`alter table ${table} enable row level security`);
    await client.query(`alter table ${table} force row level security`);
  }
  await client.query("commit");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}

console.info(`Applied and forced tenant row-level security on ${tenantTableCount} tables.`);