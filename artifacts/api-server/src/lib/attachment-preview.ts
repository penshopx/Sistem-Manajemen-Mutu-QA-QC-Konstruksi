import convert from "heic-convert";
import type { File } from "@google-cloud/storage";
import jpeg from "jpeg-js";

const HEIC_TYPES = new Set(["image/heic", "image/heif"]);
const EXIF_HEADER = Buffer.from("Exif\0\0", "binary");
const GRID_ITEM_TYPE = Buffer.from("grid", "ascii");
const IROT_BOX = Buffer.from([0, 0, 0, 9, 0x69, 0x72, 0x6f, 0x74]);

export type AttachmentPreviewResult =
  | { status: "original"; objectPath: null; error: null }
  | { status: "ready"; objectPath: string; error: null }
  | { status: "failed"; objectPath: null; error: string };

export const ATTACHMENT_PREVIEW_MAX_ATTEMPTS = 3;
export const ATTACHMENT_PREVIEW_RETRY_DELAY_MS = 1_000;

export function needsHeicPreview(contentType: string, fileName: string) {
  return HEIC_TYPES.has(contentType.toLowerCase()) || /\.(heic|heif)$/i.test(fileName);
}

function readExifOrientation(buffer: Buffer): number | null {
  let exifOffset = buffer.indexOf(EXIF_HEADER);

  while (exifOffset !== -1) {
    const tiffOffset = exifOffset + EXIF_HEADER.length;
    const byteOrder = buffer.subarray(tiffOffset, tiffOffset + 2).toString("ascii");
    const littleEndian = byteOrder === "II";
    if (littleEndian || byteOrder === "MM") {
      const readUInt16 = (offset: number) => littleEndian
        ? buffer.readUInt16LE(offset)
        : buffer.readUInt16BE(offset);
      const readUInt32 = (offset: number) => littleEndian
        ? buffer.readUInt32LE(offset)
        : buffer.readUInt32BE(offset);

      try {
        if (readUInt16(tiffOffset + 2) === 42) {
          const ifdOffset = tiffOffset + readUInt32(tiffOffset + 4);
          const entryCount = readUInt16(ifdOffset);
          for (let index = 0; index < entryCount; index += 1) {
            const entryOffset = ifdOffset + 2 + index * 12;
            if (readUInt16(entryOffset) === 0x0112) {
              const orientation = readUInt16(entryOffset + 8);
              return orientation >= 1 && orientation <= 8 ? orientation : null;
            }
          }
        }
      } catch {
        // Keep looking: "Exif" also appears in HEIF item metadata before its TIFF payload.
      }
    }
    exifOffset = buffer.indexOf(EXIF_HEADER, exifOffset + 1);
  }

  return null;
}

function needsExifOrientationFallback(buffer: Buffer) {
  const orientation = readExifOrientation(buffer);
  return orientation !== null
    && orientation !== 1
    && buffer.indexOf(GRID_ITEM_TYPE) !== -1
    && buffer.indexOf(IROT_BOX) === -1;
}

function applyExifOrientation(jpegBytes: Buffer, orientation: number) {
  const decoded = jpeg.decode(jpegBytes, {
    formatAsRGBA: true,
    useTArray: true,
  });
  const swapsAxes = orientation >= 5;
  const width = swapsAxes ? decoded.height : decoded.width;
  const height = swapsAxes ? decoded.width : decoded.height;
  const data = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let sourceX = x;
      let sourceY = y;
      switch (orientation) {
        case 2: sourceX = decoded.width - 1 - x; break;
        case 3:
          sourceX = decoded.width - 1 - x;
          sourceY = decoded.height - 1 - y;
          break;
        case 4: sourceY = decoded.height - 1 - y; break;
        case 5:
          sourceX = y;
          sourceY = x;
          break;
        case 6:
          sourceX = y;
          sourceY = decoded.height - 1 - x;
          break;
        case 7:
          sourceX = decoded.width - 1 - y;
          sourceY = decoded.height - 1 - x;
          break;
        case 8:
          sourceX = decoded.width - 1 - y;
          sourceY = x;
          break;
      }

      const sourceOffset = (sourceY * decoded.width + sourceX) * 4;
      const destinationOffset = (y * width + x) * 4;
      data.set(decoded.data.subarray(sourceOffset, sourceOffset + 4), destinationOffset);
    }
  }

  return jpeg.encode({ width, height, data }, 85).data;
}

export async function createHeicPreview(
  source: File,
  preview: File,
  previewObjectPath: string,
  convertImage: typeof convert = convert,
): Promise<AttachmentPreviewResult> {
  try {
    const [sourceBytes] = await source.download();
    const converted = Buffer.from(await convertImage({
      buffer: sourceBytes,
      format: "JPEG",
      quality: 0.85,
    }));
    const orientation = readExifOrientation(sourceBytes);
    const output = orientation !== null && needsExifOrientationFallback(sourceBytes)
      ? applyExifOrientation(converted, orientation)
      : converted;
    await preview.save(output, {
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