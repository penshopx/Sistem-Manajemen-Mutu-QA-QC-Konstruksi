import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import {
  EvidenceAttachments,
  type EvidenceAttachment,
} from "./EvidenceAttachments";

afterEach(cleanup);

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

function renderAttachments(collection: "inspections" | "ncrs") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <EvidenceAttachments
        collection={collection}
        recordId={`${collection}-record`}
        attachments={attachments}
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
});