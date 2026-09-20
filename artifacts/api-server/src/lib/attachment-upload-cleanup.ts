const CLEANUP_CLAIM_TIMEOUT_MS = 30 * 60 * 1000;

type CleanupCandidate = { id: string; objectPath: string };

export type AttachmentUploadCleanupDependencies = {
  listCandidates(now: Date, staleClaimBefore: Date): Promise<CleanupCandidate[]>;
  claimCandidate(id: string, now: Date, staleClaimBefore: Date): Promise<boolean>;
  hasAttachment(objectPath: string): Promise<boolean>;
  deleteObject(objectPath: string): Promise<void>;
  deleteTrackingRow(id: string): Promise<void>;
  releaseClaim(id: string): Promise<void>;
  reportCleanupError?(error: unknown, uploadId: string): void;
  reportReleaseError?(error: unknown, uploadId: string): void;
};

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
        continue;
      }

      if (await dependencies.hasAttachment(candidate.objectPath)) {
        await dependencies.deleteTrackingRow(candidate.id);
        preserved += 1;
        continue;
      }

      await dependencies.deleteObject(candidate.objectPath);
      await dependencies.deleteTrackingRow(candidate.id);
      deleted += 1;
    } catch (error) {
      failed += 1;
      await dependencies.releaseClaim(candidate.id).catch((releaseError) => {
        dependencies.reportReleaseError?.(releaseError, candidate.id);
      });
      dependencies.reportCleanupError?.(error, candidate.id);
    }
  }

  return { scanned: candidates.length, deleted, preserved, failed };
}