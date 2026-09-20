import convert from "heic-convert";
import type { File } from "@google-cloud/storage";

const HEIC_TYPES = new Set(["image/heic", "image/heif"]);

export type AttachmentPreviewResult =
  | { status: "original"; objectPath: null; error: null }
  | { status: "ready"; objectPath: string; error: null }
  | { status: "failed"; objectPath: null; error: string };

export const ATTACHMENT_PREVIEW_MAX_ATTEMPTS = 3;
export const ATTACHMENT_PREVIEW_RETRY_DELAY_MS = 1_000;

export function needsHeicPreview(contentType: string, fileName: string) {
  return HEIC_TYPES.has(contentType.toLowerCase()) || /\.(heic|heif)$/i.test(fileName);
}

export async function createHeicPreview(
  source: File,
  preview: File,
  previewObjectPath: string,
  convertImage: typeof convert = convert,
): Promise<AttachmentPreviewResult> {
  try {
    const [sourceBytes] = await source.download();
    const output = await convertImage({
      buffer: sourceBytes,
      format: "JPEG",
      quality: 0.85,
    });
    await preview.save(Buffer.from(output), {
      resumable: false,
      metadata: {
        contentType: "image/jpeg",
        cacheControl: "private, max-age=300",
      },
    });
    return { status: "ready", objectPath: previewObjectPath, error: null };
  } catch (error) {
    await preview.delete({ ignoreNotFound: true }).catch(() => undefined);
    return {
      status: "failed",
      objectPath: null,
      error: error instanceof Error
        ? `Konversi HEIC gagal: ${error.message}`.slice(0, 500)
        : "Konversi HEIC gagal karena kesalahan yang tidak diketahui.",
    };
  }
}

export async function createHeicPreviewWithRetry(
  source: File,
  preview: File,
  previewObjectPath: string,
  options: {
    maxAttempts?: number;
    retryDelayMs?: number;
    convertImage?: typeof convert;
    wait?: (delayMs: number) => Promise<void>;
  } = {},
): Promise<AttachmentPreviewResult> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? ATTACHMENT_PREVIEW_MAX_ATTEMPTS);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? ATTACHMENT_PREVIEW_RETRY_DELAY_MS);
  const wait = options.wait ?? ((delayMs: number) => new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  }));
  let result: AttachmentPreviewResult = {
    status: "failed",
    objectPath: null,
    error: "Konversi HEIC gagal.",
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    result = await createHeicPreview(
      source,
      preview,
      previewObjectPath,
      options.convertImage,
    );
    if (result.status === "ready") return result;
    if (attempt < maxAttempts) await wait(retryDelayMs);
  }

  return result;
}