import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Project = { id: string; name: string; code: string; client: string; contractor: string; progress: number; qualityScore: number; status: string };
export type QualityPlan = { id: string; title: string; revision: string; status: string; approvedBy: string; updatedAt: string };
export type ITP = { id: string; activity: string; holdPoint: boolean; method: string; acceptanceCriteria: string; status: string };
export type Inspection = { id: string; type: string; reference: string; activity: string; location: string; inspector: string; date: string; status: string; testResult: string; evidenceCount: number };
export type NCR = { id: string; number: string; finding: string; severity: 'Low' | 'Medium' | 'High' | 'Critical'; owner: string; dueDate: string; status: 'Open' | 'In Review' | 'Closed'; rootCause: string; correctiveAction: string };
export type Document = { id: string; code: string; title: string; category: string; revision: string; owner: string; status: string; updatedAt: string };
export type Audit = { id: string; title: string; date: string; auditor: string; findings: number; closed: number; status: string };
export type Activity = { id: string; action: string; subject: string; actor: string; timestamp: string };

type State = {
  projects: Project[];
  qualityPlans: QualityPlan[];
  itps: ITP[];
  inspections: Inspection[];
  ncrs: NCR[];
  documents: Document[];
  audits: Audit[];
  activities: Activity[];
};

const initialData: State = {
  projects: [
    { id: '1', name: 'Gedung Pusat Inovasi', code: 'PRJ-GPI-24', client: 'PT Inovasi Mandiri', contractor: 'Waskita Karya', progress: 78, qualityScore: 92, status: 'Active' }
  ],
  qualityPlans: [
    { id: '1', title: 'RMK Struktur Utama', revision: 'Rev 03', status: 'Approved', approvedBy: 'Andi S.', updatedAt: new Date().toISOString() }
  ],
  itps: [
    { id: '1', activity: 'Pengecoran Kolom Lt 3', holdPoint: true, method: 'Visual & Uji Tekan', acceptanceCriteria: 'K-300 / 28.4 MPa', status: 'Active' },
    { id: '2', activity: 'Instalasi Rebar', holdPoint: false, method: 'Visual', acceptanceCriteria: 'Sesuai shop drawing', status: 'Active' }
  ],
  inspections: [
    { id: '1', type: 'MIR', reference: 'MIR-24-081', activity: 'Besi Beton Ulir', location: 'Gudang Material', inspector: 'Budi H.', date: new Date().toISOString(), status: 'Passed', testResult: 'Sesuai Spec', evidenceCount: 3 },
    { id: '2', type: 'WIR', reference: 'WIR-24-102', activity: 'Bekisting Kolom', location: 'Zona A Lt 3', inspector: 'Siti M.', date: new Date(Date.now() - 86400000).toISOString(), status: 'Failed', testResult: 'Dimensi kurang 2cm', evidenceCount: 2 }
  ],
  ncrs: [
    { id: '1', number: 'NCR-24-015', finding: 'Mutu beton kolom K1 tidak tercapai (24 MPa dari target 30 MPa)', severity: 'High', owner: 'Subkon Struktur', dueDate: new Date(Date.now() + 86400000 * 3).toISOString(), status: 'Open', rootCause: 'Campuran air berlebih saat pengecoran', correctiveAction: 'Evaluasi struktur oleh konsultan independen, perkuatan FRP jika diperlukan' },
    { id: '2', number: 'NCR-24-012', finding: 'Elevasi lantai turun 1.5cm', severity: 'Medium', owner: 'Tim Surveyor', dueDate: new Date(Date.now() - 86400000 * 2).toISOString(), status: 'Closed', rootCause: 'Kesalahan kalibrasi alat ukur', correctiveAction: 'Leveling dengan grouting, kalibrasi alat ulang' }
  ],
  documents: [
    { id: '1', code: 'DOC-Q-001', title: 'Manual Mutu Proyek', category: 'Manual', revision: '02', owner: 'QA Dept', status: 'Published', updatedAt: new Date(Date.now() - 86400000 * 10).toISOString() },
    { id: '2', code: 'SOP-Q-015', title: 'SOP Penanganan NCR', category: 'SOP', revision: '01', owner: 'QA Dept', status: 'Published', updatedAt: new Date(Date.now() - 86400000 * 15).toISOString() }
  ],
  audits: [
    { id: '1', title: 'Audit Internal Q3', date: new Date(Date.now() - 86400000 * 5).toISOString(), auditor: 'Herman J.', findings: 4, closed: 1, status: 'In Progress' }
  ],
  activities: [
    { id: '1', action: 'Created NCR', subject: 'NCR-24-015', actor: 'Siti M.', timestamp: new Date().toISOString() },
    { id: '2', action: 'Approved', subject: 'RMK Struktur Utama Rev 03', actor: 'Andi S.', timestamp: new Date(Date.now() - 3600000).toISOString() }
  ]
};

type StoreContextType = {
  state: State;
  addRecord: <K extends keyof State>(collection: K, record: State[K][0]) => void;
  updateRecord: <K extends keyof State>(collection: K, id: string, record: Partial<State[K][0]>) => void;
  deleteRecord: <K extends keyof State>(collection: K, id: string) => void;
};

const StoreContext = createContext<StoreContextType | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(() => {
    try {
      const stored = localStorage.getItem('qaqc_store');
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return initialData;
  });

  useEffect(() => {
    localStorage.setItem('qaqc_store', JSON.stringify(state));
  }, [state]);

  const addRecord = <K extends keyof State>(collection: K, record: State[K][0]) => {
    setState(prev => {
      const activities = [{ id: crypto.randomUUID(), action: 'Added record', subject: (record as any).title || (record as any).name || (record as any).number || (record as any).reference || (record as any).activity, actor: 'System User', timestamp: new Date().toISOString() }, ...prev.activities].slice(0, 50);
      return { ...prev, [collection]: [record, ...prev[collection]], activities };
    });
  };

  const updateRecord = <K extends keyof State>(collection: K, id: string, updates: Partial<State[K][0]>) => {
    setState(prev => {
      const activities = [{ id: crypto.randomUUID(), action: 'Updated record', subject: id, actor: 'System User', timestamp: new Date().toISOString() }, ...prev.activities].slice(0, 50);
      return {
        ...prev,
        [collection]: prev[collection].map((r: any) => (r.id === id ? { ...r, ...updates } : r)),
        activities
      };
    });
  };

  const deleteRecord = <K extends keyof State>(collection: K, id: string) => {
    setState(prev => {
      const activities = [{ id: crypto.randomUUID(), action: 'Deleted record', subject: id, actor: 'System User', timestamp: new Date().toISOString() }, ...prev.activities].slice(0, 50);
      return {
        ...prev,
        [collection]: prev[collection].filter((r: any) => r.id !== id),
        activities
      };
    });
  };

  return (
    <StoreContext.Provider value={{ state, addRecord, updateRecord, deleteRecord }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within a StoreProvider');
  return context;
}
