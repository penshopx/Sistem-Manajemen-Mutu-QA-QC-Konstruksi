import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const tenantStorage = new AsyncLocalStorage<Transaction>();

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