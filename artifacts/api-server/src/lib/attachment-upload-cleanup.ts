const CLEANUP_CLAIM_TIMEOUT_MS = 30 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_CLEANUP_HISTORY_RETENTION_DAYS = 30;
export const MIN_CLEANUP_HISTORY_RETENTION_DAYS = 1;
export const MAX_CLEANUP_HISTORY_RETENTION_DAYS = 3_650;
export const CLEANUP_HISTORY_RETENTION_MS = DEFAULT_CLEANUP_HISTORY_RETENTION_DAYS * DAY_MS;

export function parseCleanupHistoryRetentionMs(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return CLEANUP_HISTORY_RETENTION_MS;

  const days = Number(value);
  if (
    !Number.isInteger(days)
    || days < MIN_CLEANUP_HISTORY_RETENTION_DAYS
    || days > MAX_CLEANUP_HISTORY_RETENTION_DAYS
  ) {
    throw new Error(
      `CLEANUP_HISTORY_RETENTION_DAYS must be an integer between ${MIN_CLEANUP_HISTORY_RETENTION_DAYS} and ${MAX_CLEANUP_HISTORY_RETENTION_DAYS}`,
    );
  }
  return days * DAY_MS;
}

type CleanupCandidate = { id: string; objectPath: string; projectId?: string };
export type CleanupOutcome = "deleted" | "preserved" | "failed";

export type AttachmentUploadCleanupDependencies = {
  listCandidates(now: Date, staleClaimBefore: Date): Promise<CleanupCandidate[]>;
  claimCandidate(id: string, now: Date, staleClaimBefore: Date): Promise<boolean>;
  hasAttachment(objectPath: string): Promise<boolean>;
  deleteObject(objectPath: string): Promise<void>;
  deleteTrackingRow(id: string): Promise<void>;
  releaseClaim(id: string): Promise<void>;
  recordOutcome?(candidate: CleanupCandidate, outcome: CleanupOutcome, error?: unknown): Promise<void>;
  reportCleanupError?(error: unknown, uploadId: string): void;
  reportReleaseError?(error: unknown, uploadId: string): void;
};

export type CleanupHistoryRetentionDependencies = {
  deleteEventsBefore(cutoff: Date): Promise<number>;
  reportRetentionError?(error: unknown, cutoff: Date): void;
};

export async function runAttachmentCleanupCycle<T>(
  dependencies: CleanupHistoryRetentionDependencies & {
    cleanup(): Promise<T>;
  },
  now = new Date(),
  retentionMs = CLEANUP_HISTORY_RETENTION_MS,
) {
  const cleanup = await dependencies.cleanup();
  const retention = await runCleanupHistoryRetention(dependencies, now, retentionMs);
  return { cleanup, retention };
}

export async function runCleanupHistoryRetention(
  dependencies: CleanupHistoryRetentionDependencies,
  now = new Date(),
  retentionMs = CLEANUP_HISTORY_RETENTION_MS,
) {
  if (
    !Number.isFinite(retentionMs)
    || retentionMs < MIN_CLEANUP_HISTORY_RETENTION_DAYS * DAY_MS
    || retentionMs > MAX_CLEANUP_HISTORY_RETENTION_DAYS * DAY_MS
  ) {
    throw new Error("Cleanup history retention must preserve at least the latest 24 hours");
  }
  const cutoff = new Date(now.getTime() - retentionMs);
  try {
    return {
      cutoff,
      deleted: await dependencies.deleteEventsBefore(cutoff),
      failed: false,
    };
  } catch (error) {
    dependencies.reportRetentionError?.(error, cutoff);
    return { cutoff, deleted: 0, failed: true };
  }
}

export async function runAttachmentUploadCleanup(
  dependencies: AttachmentUploadCleanupDependencies,
  now = new Date(),
) {
  const staleClaimBefore = new Date(now.getTime() - CLEANUP_CLAIM_TIMEOUT_MS);
  const candidates = await dependencies.listCandidates(now, staleClaimBefore);
  let deleted = 0;
  let preserved = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      if (!await dependencies.claimCandidate(candidate.id, now, staleClaimBefore)) {
        preserved += 1;
        await dependencies.recordOutcome?.(candidate, "preserved");
        continue;
      }

      if (await dependencies.hasAttachment(candidate.objectPath)) {
        await dependencies.deleteTrackingRow(candidate.id);
        preserved += 1;
        await dependencies.recordOutcome?.(candidate, "preserved");
        continue;
      }

      await dependencies.deleteObject(candidate.objectPath);
      await dependencies.deleteTrackingRow(candidate.id);
      deleted += 1;
      await dependencies.recordOutcome?.(candidate, "deleted");
    } catch (error) {
      failed += 1;
      await dependencies.releaseClaim(candidate.id).catch((releaseError) => {
        dependencies.reportReleaseError?.(releaseError, candidate.id);
      });
      dependencies.reportCleanupError?.(error, candidate.id);
      await dependencies.recordOutcome?.(candidate, "failed", error).catch((reportError) => {
        dependencies.reportCleanupError?.(reportError, candidate.id);
      });
    }
  }

  return { scanned: candidates.length, deleted, preserved, failed };
}