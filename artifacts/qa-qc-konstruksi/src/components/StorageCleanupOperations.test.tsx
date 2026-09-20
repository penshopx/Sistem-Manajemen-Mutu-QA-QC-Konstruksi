import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { useGetStorageCleanupOperations } from "@workspace/api-client-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "@/hooks/use-toast";
import { useStore } from "@/lib/store";
import { StorageCleanupNotifier, StorageCleanupOperations } from "./StorageCleanupOperations";

vi.mock("@workspace/api-client-react", () => ({
  useGetStorageCleanupOperations: vi.fn(),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@/lib/store", () => ({ useStore: vi.fn() }));

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(useStore).mockReturnValue({
    state: { currentUser: { role: "QA_ENGINEER" } },
  } as unknown as ReturnType<typeof useStore>);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockUseOperations = vi.mocked(useGetStorageCleanupOperations);

function setOperationsData(
  warning: { level: "notice" | "warning"; message: string } | null,
  repeatedFailures: Array<{ uploadId: string; failureCount: number }> = [],
) {
  mockUseOperations.mockReturnValue({
    data: {
      windowHours: 24,
      pending: 4,
      deleted: 12,
      preserved: 3,
      failed: warning ? 2 : 0,
      warning,
      repeatedFailures,
      recentFailures: [],
    },
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useGetStorageCleanupOperations>);
}

describe("StorageCleanupOperations", () => {
  it("menampilkan ringkasan, peringatan berulang, dan tindak lanjut", () => {
    setOperationsData(
      { level: "warning", message: "Dua upload terus gagal dibersihkan." },
      [
        { uploadId: "11111111-1111-1111-1111-111111111111", failureCount: 3 },
        { uploadId: "22222222-2222-2222-2222-222222222222", failureCount: 4 },
      ],
    );

    render(<StorageCleanupOperations />);

    expect(screen.getByTestId("value-storage-cleanup-pending").textContent).toBe("4");
    expect(screen.getByTestId("value-storage-cleanup-deleted").textContent).toBe("12");
    expect(screen.getByTestId("value-storage-cleanup-preserved").textContent).toBe("3");
    expect(screen.getByTestId("value-storage-cleanup-failed").textContent).toBe("2");
    expect(screen.getByText("Kegagalan pembersihan berulang")).toBeTruthy();
    expect(screen.getByText("2 upload mengalami kegagalan berulang.")).toBeTruthy();
    expect(screen.getByText("Tindak lanjut")).toBeTruthy();
  });

  it("menampilkan status sehat saat tidak ada kegagalan", () => {
    setOperationsData(null);

    render(<StorageCleanupOperations />);

    expect(screen.getByTestId("status-storage-cleanup-healthy")).toBeTruthy();
    expect(screen.queryByTestId("alert-storage-cleanup-warning")).toBeNull();
  });
});

describe("StorageCleanupNotifier", () => {
  it("memberi tahu QA Engineer sekali selama kegagalan yang sama tetap aktif", async () => {
    setOperationsData(
      { level: "warning", message: "Satu upload terus gagal dibersihkan." },
      [{ uploadId: "11111111-1111-1111-1111-111111111111", failureCount: 3 }],
    );

    const view = render(<StorageCleanupNotifier />);

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(vi.mocked(toast).mock.calls[0]?.[0].description).toContain("1 upload baru");

    view.rerender(<StorageCleanupNotifier />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it("mengizinkan notifikasi baru setelah masalah pulih lalu berulang", async () => {
    setOperationsData(
      { level: "warning", message: "Satu upload terus gagal dibersihkan." },
      [{ uploadId: "11111111-1111-1111-1111-111111111111", failureCount: 3 }],
    );
    const view = render(<StorageCleanupNotifier />);
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));

    setOperationsData(null);
    view.rerender(<StorageCleanupNotifier />);
    await waitFor(() => expect(window.localStorage.getItem("storage-cleanup-notified-failures")).toBe("[]"));

    setOperationsData(
      { level: "warning", message: "Satu upload kembali gagal dibersihkan." },
      [{ uploadId: "11111111-1111-1111-1111-111111111111", failureCount: 3 }],
    );
    view.rerender(<StorageCleanupNotifier />);
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(2));
  });

  it("tidak meminta status pembersihan untuk peran selain QA Engineer", () => {
    vi.mocked(useStore).mockReturnValue({
      state: { currentUser: { role: "SITE_MANAGER" } },
    } as unknown as ReturnType<typeof useStore>);
    setOperationsData(null);

    render(<StorageCleanupNotifier />);

    expect(mockUseOperations).toHaveBeenCalledWith(expect.objectContaining({
      query: expect.objectContaining({ enabled: false }),
    }));
    expect(toast).not.toHaveBeenCalled();
  });
});
