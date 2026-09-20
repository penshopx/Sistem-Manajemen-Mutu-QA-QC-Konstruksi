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
  export { withBootstrapContext } from "${path.resolve("src/lib/tenant-database.ts").replaceAll("\\", "/")}";
`);
await build({
  entryPoints: [entry],
  outfile: output,
  bundle: true,
  format: "cjs",
  platform: "node",
});

const {
  pool,
  runAttachmentCleanupCycle,
  sql,
  withBootstrapContext,
} = await import(pathToFileURL(output).href);
const fixture = {
  projectId: randomUUID(),
  uploadId: randomUUID(),
};

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

  console.info("PostgreSQL cleanup history retention transaction checks passed.");
} finally {
  await pool.query("delete from projects where id = $1", [fixture.projectId]).catch(() => {});
  await pool.end();
}