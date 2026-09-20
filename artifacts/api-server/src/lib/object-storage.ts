import { randomUUID } from "node:crypto";
import { Storage, type File } from "@google-cloud/storage";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import {
  attachmentUploadsTable,
  db,
  recordAttachmentsTable,
} from "@workspace/db";
import { logger } from "./logger";

const sidecar = "http://127.0.0.1:1106";
export const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024;
export const ATTACHMENT_UPLOAD_GRACE_PERIOD_MS = 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
const CLEANUP_CLAIM_TIMEOUT_MS = 30 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 100;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
]);

const storage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${sidecar}/token`,
    type: "external_account",
    credential_source: {
      url: `${sidecar}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

function privateDir() {
  const value = process.env.PRIVATE_OBJECT_DIR;
  if (!value) throw new Error("PRIVATE_OBJECT_DIR is not configured");
  return value.replace(/\/$/, "");
}

function parsePath(path: string) {
  const parts = path.replace(/^\//, "").split("/");
  if (parts.length < 2) throw new Error("Invalid object storage path");
  return { bucketName: parts[0], objectName: parts.slice(1).join("/") };
}

export function attachmentObject(objectPath: string): File {
  if (!/^\/objects\/uploads\/[a-f0-9-]+$/.test(objectPath)) throw new Error("Invalid attachment object path");
  const { bucketName, objectName } = parsePath(`${privateDir()}/${objectPath.replace(/^\/objects\//, "")}`);
  return storage.bucket(bucketName).file(objectName);
}

export function isAllowedAttachmentType(contentType: string) {
  return ALLOWED_ATTACHMENT_TYPES.has(contentType.toLowerCase());
}

export async function createAttachmentUploadUrl() {
  const objectPath = `/objects/uploads/${randomUUID()}`;
  const file = attachmentObject(objectPath);
  const response = await fetch(`${sidecar}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: file.bucket.name,
      object_name: file.name,
      method: "PUT",
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Failed to sign upload URL (${response.status})`);
  const body = await response.json() as { signed_url: string };
  return { uploadURL: body.signed_url, objectPath };
}

export async function cleanupOrphanedAttachmentUploads(now = new Date()) {
  const staleClaimBefore = new Date(now.getTime() - CLEANUP_CLAIM_TIMEOUT_MS);
  const candidates = await db.select({
    id: attachmentUploadsTable.id,
    objectPath: attachmentUploadsTable.objectPath,
  }).from(attachmentUploadsTable).where(and(
    or(
      isNull(attachmentUploadsTable.cleanupStartedAt),
      lt(attachmentUploadsTable.cleanupStartedAt, staleClaimBefore),
    ),
    lt(attachmentUploadsTable.expiresAt, now),
  )).limit(CLEANUP_BATCH_SIZE);

  let deleted = 0;
  let preserved = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      const [claimed] = await db.update(attachmentUploadsTable)
        .set({ cleanupStartedAt: now })
        .where(and(
          eq(attachmentUploadsTable.id, candidate.id),
          or(
            isNull(attachmentUploadsTable.cleanupStartedAt),
            lt(attachmentUploadsTable.cleanupStartedAt, staleClaimBefore),
          ),
        ))
        .returning({ id: attachmentUploadsTable.id });
      if (!claimed) {
        preserved += 1;
        continue;
      }

      const [attachment] = await db.select({ id: recordAttachmentsTable.id })
        .from(recordAttachmentsTable)
        .where(eq(recordAttachmentsTable.objectPath, candidate.objectPath))
        .limit(1);

      if (attachment) {
        await db.delete(attachmentUploadsTable)
          .where(eq(attachmentUploadsTable.id, candidate.id));
        preserved += 1;
        continue;
      }

      await attachmentObject(candidate.objectPath).delete({ ignoreNotFound: true });
      await db.delete(attachmentUploadsTable)
        .where(eq(attachmentUploadsTable.id, candidate.id));
      deleted += 1;
    } catch (err) {
      failed += 1;
      await db.update(attachmentUploadsTable)
        .set({ cleanupStartedAt: null })
        .where(eq(attachmentUploadsTable.id, candidate.id))
        .catch((resetErr) => {
          logger.error({ err: resetErr, uploadId: candidate.id }, "Failed to release attachment cleanup claim");
        });
      logger.error({ err, uploadId: candidate.id }, "Failed to clean orphaned attachment upload");
    }
  }

  const result = { scanned: candidates.length, deleted, preserved, failed };
  logger.info(result, "Finished orphaned attachment upload cleanup");
  return result;
}

export function startAttachmentUploadCleanup() {
  const run = () => {
    cleanupOrphanedAttachmentUploads().catch((err) => {
      logger.error({ err }, "Orphaned attachment upload cleanup failed");
    });
  };
  run();
  const timer = setInterval(run, CLEANUP_INTERVAL_MS);
  timer.unref();
}

export async function streamAttachment(file: File, res: import("express").Response, fileName: string) {
  const [metadata] = await file.getMetadata();
  res.setHeader("Content-Type", metadata.contentType || "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, max-age=300");
  if (metadata.size) res.setHeader("Content-Length", String(metadata.size));
  file.createReadStream().pipe(res);
}