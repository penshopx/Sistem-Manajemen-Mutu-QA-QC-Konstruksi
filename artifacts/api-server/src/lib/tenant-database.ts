import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const tenantStorage = new AsyncLocalStorage<Transaction>();
const EXPECTED_TENANT_POLICY_EXPRESSION =
  "((project_id = (NULLIF(current_setting('app.current_project_id'::text, true), ''::text))::uuid) OR (current_setting('app.tenant_bootstrap'::text, true) = 'on'::text))";

type TenantProtectionStatus = {
  role_exists: boolean;
  role_is_safe: boolean | null;
  tenant_table_count: number;
  invalid_table_count: number;
};

export async function assertTenantProtectionIsReady(): Promise<void> {
  const result = await db.execute(sql`
    with application_role as (
      select not rolsuper and not rolbypassrls as role_is_safe
      from pg_roles
      where rolname = 'qaqc_app'
    ),
    tenant_tables as (
      select
        c.relname,
        c.relrowsecurity,
        c.relforcerowsecurity,
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
    )
    select
      exists(select 1 from application_role) as role_exists,
      (select role_is_safe from application_role) as role_is_safe,
      (select count(*)::int from tenant_tables) as tenant_table_count,
      (
        select count(*)::int
        from tenant_tables
        where not relrowsecurity
          or not relforcerowsecurity
          or policy_count <> 1
          or permissive is distinct from 'PERMISSIVE'
          or roles is distinct from array['qaqc_app']::name[]
          or cmd is distinct from 'ALL'
          or qual is distinct from ${EXPECTED_TENANT_POLICY_EXPRESSION}
          or with_check is distinct from ${EXPECTED_TENANT_POLICY_EXPRESSION}
      ) as invalid_table_count
  `);
  const status = result.rows[0] as TenantProtectionStatus | undefined;

  if (
    !status?.role_exists
    || status.role_is_safe !== true
    || status.tenant_table_count === 0
    || status.invalid_table_count !== 0
  ) {
    throw new Error(
      "Tenant database protection is incomplete. Apply tenant RLS enforcement before starting the API.",
    );
  }
}

export function tenantDb(): Transaction {
  const transaction = tenantStorage.getStore();
  if (!transaction) {
    throw new Error("Tenant database access requires an active project context");
  }
  return transaction;
}

export const tenantDatabase = new Proxy({} as Transaction, {
  get(_target, property) {
    const transaction = tenantDb();
    const value = Reflect.get(transaction, property);
    return typeof value === "function" ? value.bind(transaction) : value;
  },
});

export function withBootstrapContext<T>(operation: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role qaqc_app`);
    await tx.execute(sql`select set_config('app.tenant_bootstrap', 'on', true)`);
    return operation(tx);
  });
}

export function withProjectContext<T>(
  projectId: string,
  operation: () => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`set local role qaqc_app`);
    await tx.execute(sql`select set_config('app.current_project_id', ${projectId}, true)`);
    return tenantStorage.run(tx, operation);
  });
}