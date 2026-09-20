import { cleanup, render, screen } from "@testing-library/react";
import { useGetStorageCleanupOperations } from "@workspace/api-client-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStore, type ProjectRole, type State } from "@/lib/store";
import { Dashboard } from "./Dashboard";

vi.mock("@workspace/api-client-react", () => ({
  useGetStorageCleanupOperations: vi.fn(),
}));
vi.mock("@/lib/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/store")>();
  return { ...actual, useStore: vi.fn() };
});

const mockUseOperations = vi.mocked(useGetStorageCleanupOperations);
const mockUseStore = vi.mocked(useStore);

let currentRole: ProjectRole = "QA_ENGINEER";

const dashboardState: State = {
  projects: [{
    id: "project-1",
    name: "Proyek Uji",
    code: "QA-001",
    client: "Klien",
    contractor: "Kontraktor",
    progress: 50,
    qualityScore: 95,
    status: "Active",
  }],
  qualityPlans: [],
  itps: [],
  inspections: [],
  ncrs: [],
  documents: [],
  audits: [],
  activities: [],
  members: [],
  currentUser: null,
};

beforeEach(() => {
  currentRole = "QA_ENGINEER";
  mockUseStore.mockImplementation(() => ({
    state: {
      ...dashboardState,
      currentUser: {
        id: "user-1",
        name: "Pengguna Uji",
        role: currentRole,
        permissions: [],
      },
    },
  }) as ReturnType<typeof useStore>);
  mockUseOperations.mockReturnValue({
    data: {
      windowHours: 24,
      pending: 0,
      deleted: 4,
      preserved: 1,
      failed: 0,
      warning: null,
      repeatedFailures: [],
      recentFailures: [],
    },
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useGetStorageCleanupOperations>);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("akses panel operasional di Dashboard", () => {
  it("menampilkan panel dan meminta status operasional untuk QA Engineer", () => {
    render(<Dashboard />);

    expect(screen.getByTestId("panel-storage-cleanup")).toBeTruthy();
    expect(screen.getByText("Operasional Pembersihan Storage")).toBeTruthy();
    expect(mockUseOperations).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["QC Inspector", "QC_INSPECTOR"],
    ["Site Manager", "SITE_MANAGER"],
    ["Project Manager", "PROJECT_MANAGER"],
  ] as const)("menyembunyikan panel dan tidak meminta status untuk %s", (_label, role) => {
    currentRole = role;

    render(<Dashboard />);

    expect(screen.queryByTestId("panel-storage-cleanup")).toBeNull();
    expect(screen.queryByText("Operasional Pembersihan Storage")).toBeNull();
    expect(mockUseOperations).not.toHaveBeenCalled();
  });

  it("memperbarui panel dan permintaan saat role berubah selama sesi berjalan", () => {
    currentRole = "QC_INSPECTOR";
    const view = render(<Dashboard />);

    expect(screen.queryByTestId("panel-storage-cleanup")).toBeNull();
    expect(mockUseOperations).not.toHaveBeenCalled();

    currentRole = "QA_ENGINEER";
    view.rerender(<Dashboard />);

    expect(screen.getByTestId("panel-storage-cleanup")).toBeTruthy();
    expect(mockUseOperations).toHaveBeenCalledTimes(1);

    currentRole = "PROJECT_MANAGER";
    view.rerender(<Dashboard />);

    expect(screen.queryByTestId("panel-storage-cleanup")).toBeNull();
    expect(mockUseOperations).toHaveBeenCalledTimes(1);
  });
});