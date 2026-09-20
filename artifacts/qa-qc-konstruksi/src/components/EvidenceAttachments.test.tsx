import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EvidenceAttachments,
  type EvidenceAttachment,
} from "./EvidenceAttachments";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const attachments: EvidenceAttachment[] = [
  {
    id: "photo-1",
    fileName: "pondasi.jpg",
    contentType: "image/jpeg",
    size: 120_000,
    createdAt: "2026-09-20T08:00:00.000Z",
    downloadUrl: "/download/pondasi.jpg",
    previewUrl: "/preview/pondasi.jpg",
    previewStatus: "ready",
  },
  {
    id: "document-1",
    fileName: "laporan.pdf",
    contentType: "application/pdf",
    size: 350_000,
    createdAt: "2026-09-20T08:01:00.000Z",
    downloadUrl: "/download/laporan.pdf",
    previewStatus: "original",
  },
  {
    id: "photo-2",
    fileName: "bekisting.png",
    contentType: "image/png",
    size: 240_000,
    createdAt: "2026-09-20T08:02:00.000Z",
    downloadUrl: "/download/bekisting.png",
    previewUrl: "/preview/bekisting.png",
    previewStatus: "ready",
  },
  {
    id: "photo-3",
    fileName: "pengecoran.webp",
    contentType: "image/webp",
    size: 180_000,
    createdAt: "2026-09-20T08:03:00.000Z",
    downloadUrl: "/download/pengecoran.webp",
    previewUrl: "/preview/pengecoran.webp",
    previewStatus: "ready",
  },
];

const processingAttachment: EvidenceAttachment = {
  id: "photo-processing",
  fileName: "lapangan.heic",
  contentType: "image/heic",
  size: 2_400_000,
  createdAt: "2026-09-20T08:04:00.000Z",
  downloadUrl: "/download/lapangan.heic",
  previewUrl: null,
  previewStatus: "processing",
};

const failedAttachment: EvidenceAttachment = {
  id: "photo-failed",
  fileName: "retak-struktur.heic",
  contentType: "image/heic",
  size: 2_800_000,
  createdAt: "2026-09-20T08:05:00.000Z",
  downloadUrl: "/download/retak-struktur.heic",
  previewUrl: null,
  previewStatus: "failed",
  previewError: "Format pratinjau tidak didukung.",
};

function renderAttachments(
  collection: "inspections" | "ncrs",
  evidence: EvidenceAttachment[] = attachments,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <EvidenceAttachments
        collection={collection}
        recordId={`${collection}-record`}
        attachments={evidence}
      />
    </QueryClientProvider>,
  );
}

describe.each([
  ["Inspeksi", "inspections"],
  ["NCR", "ncrs"],
] as const)("galeri bukti %s", (_label, collection) => {
  it("membuka foto yang dipilih dan mempertahankan dokumen sebagai unduhan", () => {
    renderAttachments(collection);

    const documentLink = screen.getByTitle("Unduh laporan.pdf");
    expect(documentLink.getAttribute("href")).toBe("/download/laporan.pdf");
    expect(documentLink.getAttribute("download")).toBe("laporan.pdf");

    fireEvent.click(screen.getByRole("button", { name: "Buka foto bekisting.png" }));

    const dialog = screen.getByRole("dialog", { name: "Galeri foto bukti" });
    expect(within(dialog).getByText("bekisting.png")).toBeTruthy();
    expect(within(dialog).getByText("2 dari 3")).toBeTruthy();
    const activeImage = within(dialog).getByRole("img", { name: "bekisting.png" });
    expect(activeImage.getAttribute("src")).toBe("/preview/bekisting.png");
  });

  it("menavigasi dengan tombol, panah keyboard, dan Escape", () => {
    renderAttachments(collection);
    fireEvent.click(screen.getByRole("button", { name: "Buka foto pondasi.jpg" }));

    const dialog = screen.getByRole("dialog", { name: "Galeri foto bukti" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Foto berikutnya" }));
    expect(within(dialog).getByText("bekisting.png")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Foto sebelumnya" }));
    expect(within(dialog).getByText("pondasi.jpg")).toBeTruthy();

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(within(dialog).getByText("pengecoran.webp")).toBeTruthy();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(within(dialog).getByText("pondasi.jpg")).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Galeri foto bukti" })).toBeNull();
  });

  it("membatalkan penghapusan tanpa mengirim permintaan", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    renderAttachments(collection);

    fireEvent.click(screen.getByRole("button", { name: "Hapus pondasi.jpg" }));

    expect(confirm).toHaveBeenCalledWith('Hapus bukti "pondasi.jpg"?');
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Buka foto pondasi.jpg" })).toBeTruthy();
    expect(screen.getByText("4 bukti tersimpan")).toBeTruthy();
  });

  it("menghapus melalui endpoint rekaman yang tepat dan langsung menyegarkan galeri", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetch);
    renderAttachments(collection);
    fireEvent.click(screen.getByRole("button", { name: "Buka foto pengecoran.webp" }));

    fireEvent.click(screen.getByRole("button", { name: "Hapus pengecoran.webp" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        `/api/workspace/${collection}/${collection}-record/attachments/photo-3`,
        { method: "DELETE", credentials: "include" },
      );
      expect(screen.queryByRole("button", { name: "Buka foto pengecoran.webp" })).toBeNull();
    });
    const dialog = screen.getByRole("dialog", { name: "Galeri foto bukti" });
    expect(within(dialog).getByText("bekisting.png")).toBeTruthy();
    expect(within(dialog).getByText("2 dari 2")).toBeTruthy();
    expect(screen.getByText("3 bukti tersimpan")).toBeTruthy();
  });

  it("menampilkan kegagalan API tanpa mengubah daftar atau galeri", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const alert = vi.spyOn(window, "alert").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: vi.fn().mockResolvedValue({ error: "Layanan penghapusan tidak tersedia." }),
    }));
    renderAttachments(collection);

    fireEvent.click(screen.getByRole("button", { name: "Hapus pondasi.jpg" }));

    await waitFor(() => {
      expect(alert).toHaveBeenCalledWith("Layanan penghapusan tidak tersedia.");
    });
    expect(screen.getByRole("button", { name: "Buka foto pondasi.jpg" })).toBeTruthy();
    expect(screen.getByText("4 bukti tersimpan")).toBeTruthy();
  });

  it("menjaga foto tanpa pratinjau dapat diunduh tanpa memasukkannya ke galeri", () => {
    renderAttachments(collection, [
      attachments[0],
      failedAttachment,
      attachments[2],
    ]);

    expect(screen.getByText("Pratinjau gagal dibuat")).toBeTruthy();
    expect(screen.getByText("Format pratinjau tidak didukung.")).toBeTruthy();
    const originalDownload = screen.getByRole("link", { name: "Unduh asli" });
    expect(originalDownload.getAttribute("href")).toBe("/download/retak-struktur.heic");
    expect(originalDownload.getAttribute("download")).toBe("retak-struktur.heic");
    expect(screen.queryByRole("button", { name: "Buka foto retak-struktur.heic" })).toBeNull();
    expect(screen.queryByRole("dialog", { name: "Galeri foto bukti" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Buka foto pondasi.jpg" }));
    const dialog = screen.getByRole("dialog", { name: "Galeri foto bukti" });
    expect(within(dialog).getByText("1 dari 2")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Foto berikutnya" }));
    expect(within(dialog).getByText("bekisting.png")).toBeTruthy();
    expect(within(dialog).getByText("2 dari 2")).toBeTruthy();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(within(dialog).getByText("pondasi.jpg")).toBeTruthy();
    expect(within(dialog).queryByText("retak-struktur.heic")).toBeNull();
  });
});

describe("status pratinjau bukti", () => {
  it("menampilkan pemrosesan dan tetap menyediakan unduhan asli", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <EvidenceAttachments
          collection="inspections"
          recordId="inspection-record"
          attachments={[processingAttachment]}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("status").textContent).toContain("Pratinjau sedang diproses");
    const download = screen.getByRole("link", { name: "Unduh asli" });
    expect(download.getAttribute("href")).toBe("/download/lapangan.heic");
  });

  it("memperlakukan HEIC lama berstatus original sebagai sedang diproses", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <EvidenceAttachments
          collection="inspections"
          recordId="inspection-record"
          attachments={[{ ...processingAttachment, previewStatus: "original" }]}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByRole("status").textContent).toContain("Pratinjau sedang diproses");
    expect(screen.getByRole("link", { name: "Unduh asli" }).getAttribute("href"))
      .toBe("/download/lapangan.heic");
    expect(screen.queryByRole("button", { name: "Buka foto lapangan.heic" })).toBeNull();
  });
});