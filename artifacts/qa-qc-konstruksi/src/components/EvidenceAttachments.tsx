import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetWorkspaceQueryKey } from "@workspace/api-client-react";
import { AlertTriangle, ChevronLeft, ChevronRight, Download, FileText, Loader2, Paperclip, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/core";

export type EvidenceAttachment = {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
  downloadUrl: string;
  previewUrl?: string | null;
  previewStatus: "original" | "processing" | "ready" | "failed";
  previewError?: string | null;
};

type Props = {
  collection: "inspections" | "ncrs";
  recordId: string;
  attachments?: EvidenceAttachment[];
};

async function responseError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error || `Permintaan gagal (${response.status})`;
}

function isImage(attachment: EvidenceAttachment) {
  return attachment.contentType.startsWith("image/")
    || /\.(avif|gif|heic|heif|jpe?g|png|webp)$/i.test(attachment.fileName);
}

function isPendingPreview(attachment: EvidenceAttachment) {
  return attachment.previewStatus === "processing"
    || (
      attachment.previewStatus === "original"
      && (
        attachment.contentType === "image/heic"
        || attachment.contentType === "image/heif"
        || /\.(heic|heif)$/i.test(attachment.fileName)
      )
    );
}

function fileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.ceil(size / 1024))} KB`;
}

export function EvidenceAttachments({ collection, recordId, attachments = [] }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [activePhoto, setActivePhoto] = useState<number | null>(null);
  const [removedAttachmentIds, setRemovedAttachmentIds] = useState<Set<string>>(() => new Set());
  const visibleAttachments = attachments.filter((attachment) => !removedAttachmentIds.has(attachment.id));
  const photos = visibleAttachments.filter(isImage);
  const documents = visibleAttachments.filter((attachment) => !isImage(attachment));
  const hasProcessingPreview = visibleAttachments.some(isPendingPreview);

  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetWorkspaceQueryKey() });

  useEffect(() => {
    if (!hasProcessingPreview) return;
    const interval = window.setInterval(() => {
      void refresh();
    }, 2_000);
    return () => window.clearInterval(interval);
  }, [hasProcessingPreview]);

  useEffect(() => {
    setRemovedAttachmentIds(new Set());
  }, [collection, recordId]);

  useEffect(() => {
    if (activePhoto === null) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActivePhoto(null);
      if (event.key === "ArrowLeft") {
        setActivePhoto((current) => current === null ? null : (current - 1 + photos.length) % photos.length);
      }
      if (event.key === "ArrowRight") {
        setActivePhoto((current) => current === null ? null : (current + 1) % photos.length);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activePhoto, photos.length]);

  useEffect(() => {
    if (activePhoto !== null && activePhoto >= photos.length) {
      setActivePhoto(photos.length ? photos.length - 1 : null);
    }
  }, [activePhoto, photos.length]);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const metadata = {
        fileName: file.name,
        contentType: file.type || (/\.(heic|heif)$/i.test(file.name) ? "image/heic" : "application/octet-stream"),
        size: file.size,
      };
      const request = await fetch(`/api/workspace/${collection}/${recordId}/attachments/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(metadata),
      });
      if (!request.ok) throw new Error(await responseError(request));
      const { uploadURL, objectPath } = await request.json() as { uploadURL: string; objectPath: string };
      const storageUpload = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": metadata.contentType },
        body: file,
      });
      if (!storageUpload.ok) throw new Error("Unggahan ke App Storage gagal.");
      const save = await fetch(`/api/workspace/${collection}/${recordId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...metadata, objectPath }),
      });
      if (!save.ok) throw new Error(await responseError(save));
      await refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Gagal mengunggah bukti.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async (attachment: EvidenceAttachment) => {
    if (!window.confirm(`Hapus bukti "${attachment.fileName}"?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/workspace/${collection}/${recordId}/attachments/${attachment.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error(await responseError(response));
      const removedPhotoIndex = photos.findIndex((photo) => photo.id === attachment.id);
      if (removedPhotoIndex >= 0) {
        setActivePhoto((current) => {
          if (current === null) return null;
          if (current > removedPhotoIndex) return current - 1;
          if (current === removedPhotoIndex) {
            const remainingPhotoCount = photos.length - 1;
            return remainingPhotoCount ? Math.min(current, remainingPhotoCount - 1) : null;
          }
          return current;
        });
      }
      setRemovedAttachmentIds((current) => new Set(current).add(attachment.id));
      await refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Gagal menghapus bukti.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 min-w-56 space-y-2">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Paperclip className="h-3 w-3" />
        <span>{visibleAttachments.length} bukti tersimpan</span>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-2 text-[10px] text-primary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          Unggah
        </Button>
      </div>
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((attachment, index) => (
            <div key={attachment.id} className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted">
              {isPendingPreview(attachment) ? (
                <div
                  className="flex h-full flex-col items-center justify-center gap-2 px-2 text-center text-[10px] text-muted-foreground"
                  role="status"
                >
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span>Pratinjau sedang diproses</span>
                  <a
                    href={attachment.downloadUrl}
                    download={attachment.fileName}
                    className="pointer-events-auto inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Download className="h-3 w-3" />
                    Unduh asli
                  </a>
                </div>
              ) : attachment.previewStatus === "failed" || !attachment.previewUrl ? (
                <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-[9px] text-destructive">
                  <AlertTriangle className="h-5 w-5" />
                  <span>Pratinjau gagal dibuat</span>
                  <span className="line-clamp-2 text-muted-foreground">{attachment.previewError || "File asli tetap dapat diunduh."}</span>
                  <a
                    href={attachment.downloadUrl}
                    download={attachment.fileName}
                    className="pointer-events-auto mt-1 inline-flex items-center gap-1 rounded bg-background/90 px-2 py-1 text-primary hover:underline"
                  >
                    <Download className="h-3 w-3" />
                    Unduh asli
                  </a>
                </div>
              ) : (
                <button
                  type="button"
                  className="h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                  onClick={() => setActivePhoto(index)}
                  aria-label={`Buka foto ${attachment.fileName}`}
                >
                  <img
                    src={attachment.previewUrl}
                    alt={attachment.fileName}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                </button>
              )}
              <button
                type="button"
                aria-label={`Hapus ${attachment.fileName}`}
                className="absolute right-1 top-1 rounded bg-background/85 p-1 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100"
                disabled={busy}
                onClick={() => void remove(attachment)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-4 text-[9px] text-white">
                {attachment.fileName}
              </div>
            </div>
          ))}
        </div>
      )}
      {documents.map((attachment) => (
        <div key={attachment.id} className="flex items-center gap-2 rounded border border-border bg-muted/20 px-2 py-1.5">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <a
            href={attachment.downloadUrl}
            download={attachment.fileName}
            className="flex min-w-0 flex-1 items-center gap-1 text-[11px] text-primary hover:underline"
            title={`Unduh ${attachment.fileName}`}
          >
            <span className="truncate">{attachment.fileName}</span>
            <Download className="h-3 w-3 shrink-0" />
          </a>
          <span className="whitespace-nowrap text-[9px] text-muted-foreground">{fileSize(attachment.size)}</span>
          <button
            type="button"
            aria-label={`Hapus ${attachment.fileName}`}
            className="p-1 text-muted-foreground hover:text-destructive"
            disabled={busy}
            onClick={() => void remove(attachment)}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      {activePhoto !== null && photos[activePhoto] && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label="Galeri foto bukti"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActivePhoto(null);
          }}
        >
          <div className="flex items-center justify-between gap-4 px-4 py-3 text-white">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{photos[activePhoto].fileName}</div>
              <div className="text-xs text-white/60">{activePhoto + 1} dari {photos.length}</div>
            </div>
            <div className="flex items-center gap-1">
              <a
                href={photos[activePhoto].downloadUrl}
                download={photos[activePhoto].fileName}
                className="rounded-md p-2 text-white/80 hover:bg-white/10 hover:text-white"
                aria-label={`Unduh ${photos[activePhoto].fileName}`}
              >
                <Download className="h-5 w-5" />
              </a>
              <button
                type="button"
                className="rounded-md p-2 text-white/80 hover:bg-white/10 hover:text-white"
                onClick={() => setActivePhoto(null)}
                aria-label="Tutup galeri"
                autoFocus
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-14 pb-4">
            <img
              src={photos[activePhoto].previewUrl || undefined}
              alt={photos[activePhoto].fileName}
              className="max-h-full max-w-full object-contain"
            />
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  className="absolute left-2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:left-4"
                  onClick={() => setActivePhoto((activePhoto - 1 + photos.length) % photos.length)}
                  aria-label="Foto sebelumnya"
                >
                  <ChevronLeft className="h-7 w-7" />
                </button>
                <button
                  type="button"
                  className="absolute right-2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 sm:right-4"
                  onClick={() => setActivePhoto((activePhoto + 1) % photos.length)}
                  aria-label="Foto berikutnya"
                >
                  <ChevronRight className="h-7 w-7" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}