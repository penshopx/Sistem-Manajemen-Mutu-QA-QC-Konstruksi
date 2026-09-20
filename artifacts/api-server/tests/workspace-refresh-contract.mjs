import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const directory = await mkdtemp(path.join(tmpdir(), "qaqc-refresh-"));
const entry = path.join(directory, "entry.ts");
const output = path.join(directory, "entry.mjs");

await writeFile(entry, `
  export {
    refreshWorkspace,
    workspaceMutationOptions,
    WORKSPACE_QUERY_OPTIONS,
  } from "${path.resolve("../qa-qc-konstruksi/src/lib/workspace-cache.ts").replaceAll("\\", "/")}";
`);

await build({
  entryPoints: [entry],
  outfile: output,
  bundle: true,
  format: "esm",
  platform: "node",
});

const {
  refreshWorkspace,
  workspaceMutationOptions,
  WORKSPACE_QUERY_OPTIONS,
} = await import(pathToFileURL(output).href);

assert.ok(
  WORKSPACE_QUERY_OPTIONS.refetchInterval > 0,
  "a second session must periodically refetch shared workspace data",
);
assert.ok(
  WORKSPACE_QUERY_OPTIONS.staleTime < WORKSPACE_QUERY_OPTIONS.refetchInterval,
  "workspace data must become stale before the next cross-session refresh",
);
assert.equal(
  WORKSPACE_QUERY_OPTIONS.refetchOnWindowFocus,
  "always",
  "returning to a session must refresh shared workspace data",
);

const invalidations = [];
await refreshWorkspace({
  invalidateQueries(filter) {
    invalidations.push(filter);
    return Promise.resolve();
  },
});
assert.deepEqual(invalidations, [{ queryKey: WORKSPACE_QUERY_OPTIONS.queryKey }]);

let refreshCount = 0;
const mutations = workspaceMutationOptions(
  () => { refreshCount += 1; },
  () => {},
);
mutations.create.mutation.onSuccess();
mutations.update.mutation.onSuccess();
mutations.remove.mutation.onSuccess();
assert.equal(
  refreshCount,
  3,
  "create, update, and delete must each invalidate workspace data after success",
);

console.info("Cross-session workspace refresh checks passed.");