const CLEANUP_CLAIM_TIMEOUT_MS = 30 * 60 * 1000;
export const CLEANUP_HISTORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

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
) {
  const cleanup = await dependencies.cleanup();
  const retention = await runCleanupHistoryRetention(dependencies, now);
  return { cleanup, retention };
}

export async function runCleanupHistoryRetention(
  dependencies: CleanupHistoryRetentionDependencies,
  now = new Date(),
) {
  const cutoff = new Date(now.getTime() - CLEANUP_HISTORY_RETENTION_MS);
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