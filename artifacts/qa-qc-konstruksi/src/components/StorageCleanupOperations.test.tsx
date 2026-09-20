import { cleanup, render, screen } from "@testing-library/react";
import { useGetStorageCleanupOperations } from "@workspace/api-client-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StorageCleanupOperations } from "./StorageCleanupOperations";

vi.mock("@workspace/api-client-react", () => ({
  useGetStorageCleanupOperations: vi.fn(),
}));

afterEach(cleanup);

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