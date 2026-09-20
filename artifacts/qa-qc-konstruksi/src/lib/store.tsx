import { createContext, useContext, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetWorkspaceQueryKey,
  useCreateWorkspaceRecord,
  useDeleteWorkspaceRecord,
  useGetWorkspace,
  useInviteProjectMember,
  useUpdateWorkspaceRecord,
} from "@workspace/api-client-react";

export type Project = { id: string; name: string; code: string; client: string; contractor: string; progress: number; qualityScore: number; status: string };
export type QualityPlan = { id: string; title: string; revision: string; status: string; approvedBy: string; updatedAt: string };
export type ITP = { id: string; activity: string; holdPoint: boolean; method: string; acceptanceCriteria: string; status: string };
export type Inspection = { id: string; type: string; reference: string; activity: string; location: string; inspector: string; date: string; status: string; testResult: string; evidenceCount: number };
export type NCR = { id: string; number: string; finding: string; severity: "Low" | "Medium" | "High" | "Critical"; owner: string; dueDate: string; status: "Open" | "In Review" | "Closed"; rootCause: string; correctiveAction: string };
export type Document = { id: string; code: string; title: string; category: string; revision: string; owner: string; status: string; updatedAt: string };
export type Audit = { id: string; title: string; date: string; auditor: string; findings: number; closed: number; status: string };
export type Activity = { id: string; action: string; subject: string; actor: string; timestamp: string };
export type ProjectRole = "QA_ENGINEER" | "QC_INSPECTOR" | "SITE_MANAGER" | "PROJECT_MANAGER";
export type ProjectMember = { id: string; name: string; email: string; role: ProjectRole; status: "active" | "invited" };

export type State = {
  projects: Project[];
  qualityPlans: QualityPlan[];
  itps: ITP[];
  inspections: Inspection[];
  ncrs: NCR[];
  documents: Document[];
  audits: Audit[];
  activities: Activity[];
  members: ProjectMember[];
  currentUser: { id: string; name: string; role: ProjectRole; permissions: string[] } | null;
};

type MutableCollection = "qualityPlans" | "itps" | "inspections" | "ncrs" | "documents" | "audits";
type StoreContextType = {
  state: State;
  isLoading: boolean;
  error: Error | null;
  addRecord: <K extends MutableCollection>(collection: K, record: State[K][0]) => void;
  updateRecord: <K extends MutableCollection>(collection: K, id: string, record: Partial<State[K][0]>) => void;
  deleteRecord: <K extends MutableCollection>(collection: K, id: string) => void;
  inviteMember: (email: string, role: ProjectRole) => void;
};

const emptyState: State = {
  projects: [], qualityPlans: [], itps: [], inspections: [], ncrs: [],
  documents: [], audits: [], activities: [], members: [], currentUser: null,
};

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const workspace = useGetWorkspace({
    query: {
      queryKey: getGetWorkspaceQueryKey(),
      refetchInterval: 15_000,
      staleTime: 5_000,
    },
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetWorkspaceQueryKey() });
  const onError = (error: Error) => window.alert(error.message);
  const create = useCreateWorkspaceRecord({ mutation: { onSuccess: refresh, onError } });
  const update = useUpdateWorkspaceRecord({ mutation: { onSuccess: refresh, onError } });
  const remove = useDeleteWorkspaceRecord({ mutation: { onSuccess: refresh, onError } });
  const invite = useInviteProjectMember({ mutation: { onSuccess: refresh, onError } });

  const data = workspace.data;
  const state: State = data ? {
    projects: data.projects as Project[],
    qualityPlans: data.qualityPlans as unknown as QualityPlan[],
    itps: data.itps as unknown as ITP[],
    inspections: data.inspections as unknown as Inspection[],
    ncrs: data.ncrs as unknown as NCR[],
    documents: data.documents as unknown as Document[],
    audits: data.audits as unknown as Audit[],
    activities: data.activities,
    members: data.members as ProjectMember[],
    currentUser: data.currentUser as State["currentUser"],
  } : emptyState;

  const addRecord: StoreContextType["addRecord"] = (collection, record) => {
    create.mutate({ collection, data: record });
  };
  const updateRecord: StoreContextType["updateRecord"] = (collection, id, record) => {
    update.mutate({ collection, id, data: record });
  };
  const deleteRecord: StoreContextType["deleteRecord"] = (collection, id) => {
    remove.mutate({ collection, id });
  };
  const inviteMember: StoreContextType["inviteMember"] = (email, role) => {
    invite.mutate({ data: { email, role } });
  };

  return (
    <StoreContext.Provider value={{
      state,
      isLoading: workspace.isLoading,
      error: workspace.error as Error | null,
      addRecord,
      updateRecord,
      deleteRecord,
      inviteMember,
    }}>
      {workspace.isLoading ? (
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground font-mono">Memuat ruang kerja tim…</div>
      ) : workspace.error ? (
        <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center text-destructive">
          Gagal memuat data proyek. Silakan muat ulang halaman.
        </div>
      ) : children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used within a StoreProvider");
  return context;
}