import convert from "heic-convert";
import type { File } from "@google-cloud/storage";

const HEIC_TYPES = new Set(["image/heic", "image/heif"]);

export type AttachmentPreviewResult =
  | { status: "original"; objectPath: null; error: null }
  | { status: "ready"; objectPath: string; error: null }
  | { status: "failed"; objectPath: null; error: string };

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