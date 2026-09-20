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

const directory = await mkdtemp(path.join(tmpdir(), "qaqc-retention-postgres-"));
const entry = path.join(directory, "entry.ts");
const output = path.join(directory, "entry.cjs");

await writeFile(entry, `
  export { pool } from "${path.resolve("../../lib/db/src/index.ts").replaceAll("\\", "/")}";
  export { sql } from "${path.resolve("node_modules/drizzle-orm/index.js").replaceAll("\\", "/")}";
  export { runAttachmentCleanupCycle } from "${path.resolve("src/lib/attachment-upload-cleanup.ts").replaceAll("\\", "/")}";
  export {
    CLEANUP_HISTORY_RETENTION_BATCH_SIZE,
    deleteExpiredAttachmentCleanupEvents,
  } from "${path.resolve("src/lib/object-storage.ts").replaceAll("\\", "/")}";
  export { withBootstrapContext } from "${path.resolve("src/lib/tenant-database.ts").replaceAll("\\", "/")}";
`);
await build({
  entryPoints: [entry],
  outfile: output,
  bundle: true,
  format: "cjs",
  platform: "node",
});

process.env.NODE_ENV = "production";
const {
  CLEANUP_HISTORY_RETENTION_BATCH_SIZE,
  deleteExpiredAttachmentCleanupEvents,
  pool,
  runAttachmentCleanupCycle,
  sql,
  withBootstrapContext,
} = await import(pathToFileURL(output).href);
const fixture = {
  projectId: randomUUID(),
  uploadId: randomUUID(),
};

async function cleanupSummary24Hours() {
  const result = await pool.query(
    `select
       count(*) filter (where outcome = 'deleted')::int as deleted,
       count(*) filter (where outcome = 'preserved')::int as preserved,
       count(*) filter (where outcome = 'failed')::int as failed
     from qaqc_attachment_cleanup_events
     where project_id = $1 and created_at >= $2::timestamptz - interval '24 hours'`,
    [fixture.projectId, now.toISOString()],
  );
  return result.rows[0];
}

async function countEvents(predicate = "true") {
  const result = await pool.query(
    `select count(*)::int as count
     from qaqc_attachment_cleanup_events
     where project_id = $1 and ${predicate}`,
    [fixture.projectId],
  );
  return result.rows[0].count;
}

const now = new Date("2026-09-20T12:00:00.000Z");

try {
  await pool.query(
    `insert into projects (id, name, code, client, contractor)
     values ($1, 'Retention transaction fixture', $2, 'Test', 'Test')`,
    [fixture.projectId, `RETENTION-${randomUUID()}`],
  );

  const errors = [];
  const result = await runAttachmentCleanupCycle({
    cleanup: () => withBootstrapContext(async (transaction) => {
      await transaction.execute(sql`
        insert into qaqc_attachment_cleanup_events
          (project_id, upload_id, outcome, created_at)
        values (
          ${fixture.projectId},
          ${fixture.uploadId},
          'deleted',
          now() - interval '31 days'
        )
      `);
      return { deleted: 1 };
    }),
    deleteEventsBefore: (cutoff) => withBootstrapContext(async (transaction) => {
      await transaction.execute(sql`
        delete from qaqc_attachment_cleanup_events
        where upload_id = ${fixture.uploadId} and created_at < ${cutoff}
      `);
      await transaction.execute(sql`select 1 / 0`);
      return 1;
    }),
    reportRetentionError(error) {
      errors.push(error);
    },
  }, new Date());

  assert.deepEqual(result.cleanup, { deleted: 1 });
  assert.equal(result.retention.failed, true);
  assert.equal(errors.length, 1);

  const remaining = await pool.query(
    "select count(*)::int as count from qaqc_attachment_cleanup_events where upload_id = $1",
    [fixture.uploadId],
  );
  assert.equal(
    remaining.rows[0].count,
    1,
    "retention rollback must not undo the already committed cleanup transaction",
  );

  await pool.query(
    `insert into qaqc_attachment_cleanup_events
       (project_id, upload_id, outcome, created_at)
     select $1, gen_random_uuid(), 'deleted', $2::timestamptz - interval '31 days'
     from generate_series(1, $3)`,
    [fixture.projectId, now.toISOString(), CLEANUP_HISTORY_RETENTION_BATCH_SIZE + 3],
  );
  await pool.query(
    `insert into qaqc_attachment_cleanup_events
       (project_id, upload_id, outcome, created_at)
     values
       ($1, gen_random_uuid(), 'preserved', $2::timestamptz - interval '30 days'),
       ($1, gen_random_uuid(), 'deleted', $2::timestamptz - interval '2 hours'),
       ($1, gen_random_uuid(), 'preserved', $2::timestamptz - interval '1 hour'),
       ($1, gen_random_uuid(), 'failed', $2::timestamptz - interval '30 minutes')`,
    [fixture.projectId, now.toISOString()],
  );

  const summaryBefore = await cleanupSummary24Hours();
  const deletedPerCycle = [];
  const retentionDependencies = {
    deleteEventsBefore: deleteExpiredAttachmentCleanupEvents,
  };

  for (let cycle = 0; cycle < 3; cycle += 1) {
    const result = await runAttachmentCleanupCycle({
      cleanup: async () => ({ deleted: 0 }),
      ...retentionDependencies,
    }, now);
    deletedPerCycle.push(result.retention.deleted);
    assert.equal(result.retention.failed, false);
  }

  assert.deepEqual(
    deletedPerCycle,
    [CLEANUP_HISTORY_RETENTION_BATCH_SIZE, 4, 0],
    "each cycle must remove at most one batch and later cycles must drain the backlog",
  );
  assert.equal(
    await countEvents(`created_at = '${new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()}'::timestamptz`),
    1,
    "an event exactly at the retention cutoff must be preserved",
  );
  assert.equal(
    await countEvents(`created_at >= '${new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()}'::timestamptz`),
    3,
    "events in the current 24-hour window must be preserved",
  );
  assert.deepEqual(
    await cleanupSummary24Hours(),
    summaryBefore,
    "draining old history must not change the 24-hour operations summary",
  );

  console.info("PostgreSQL cleanup history retention checks passed.");
} finally {
  await pool.query("delete from projects where id = $1", [fixture.projectId]).catch(() => {});
  await pool.end();
}