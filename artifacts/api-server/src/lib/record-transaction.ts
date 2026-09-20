export async function executeAuditedMutation<TTransaction, TResult>(
  transaction: TTransaction,
  mutate: (transaction: TTransaction) => Promise<TResult>,
  writeAudit: (transaction: TTransaction, result: TResult) => Promise<void>,
): Promise<TResult> {
  const result = await mutate(transaction);
  await writeAudit(transaction, result);
  return result;
}