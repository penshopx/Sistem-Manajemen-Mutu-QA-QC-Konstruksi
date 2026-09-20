import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetWorkspaceQueryKey } from "@workspace/api-client-react";
import { Download, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/core";

export type EvidenceAttachment = {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
  downloadUrl: string;
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

export function EvidenceAttachments({ collection, recordId, attachments = [] }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetWorkspaceQueryKey() });

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const metadata = {
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
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
        <span>{attachments.length} bukti tersimpan</span>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".jpg,.jpeg,.png,.webp,.heic,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
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
      {attachments.map((attachment) => (
        <div key={attachment.id} className="flex items-center gap-1 rounded border border-border bg-muted/20 px-2 py-1">
          <a
            href={attachment.downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-w-0 flex-1 items-center gap-1 text-[11px] text-primary hover:underline"
            title={attachment.fileName}
          >
            <Download className="h-3 w-3 shrink-0" />
            <span className="truncate">{attachment.fileName}</span>
          </a>
          <span className="text-[9px] text-muted-foreground">{Math.max(1, Math.ceil(attachment.size / 1024))} KB</span>
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
    </div>
  );
}