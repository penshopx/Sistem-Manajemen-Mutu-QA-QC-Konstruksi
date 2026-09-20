import { useState } from "react";
import { useStore, ITP } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Modal } from "@/components/ui/core";
import { Plus, Search, FileText } from "lucide-react";

export function QualityPlan() {
  const { state, addRecord, updateRecord, deleteRecord } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<ITP>>({
    activity: "", holdPoint: false, method: "", acceptanceCriteria: "", status: "Active"
  });

  const filteredITPs = state.itps.filter(itp => 
    itp.activity.toLowerCase().includes(searchTerm.toLowerCase()) ||
    itp.method.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = () => {
    if (!formData.activity || !formData.method) return;
    addRecord('itps', {
      id: crypto.randomUUID(),
      activity: formData.activity,
      holdPoint: Boolean(formData.holdPoint),
      method: formData.method,
      acceptanceCriteria: formData.acceptanceCriteria || "-",
      status: formData.status || "Active"
    } as ITP);
    setIsAddModalOpen(false);
    setFormData({ activity: "", holdPoint: false, method: "", acceptanceCriteria: "", status: "Active" });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-display uppercase tracking-tight">Quality Plan & ITP</h1>
          <p className="text-muted-foreground text-sm">Inspection and Test Plan Control</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="gap-2" data-testid="button-add-itp">
          <Plus className="w-4 h-4" /> Add ITP Item
        </Button>
      </div>

      {state.qualityPlans.length > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <FileText className="text-primary h-8 w-8" />
              <div>
                <div className="font-mono text-xs text-primary uppercase mb-1">Active Quality Plan</div>
                <div className="font-bold">{state.qualityPlans[0].title} <span className="text-muted-foreground ml-2">{state.qualityPlans[0].revision}</span></div>
              </div>
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary">{state.qualityPlans[0].status}</Badge>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <CardTitle>ITP Register</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search activity..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search-itp"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/50 border-b border-border font-mono text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Activity</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Method</th>
                  <th className="px-6 py-3 font-medium">Criteria</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredITPs.map(itp => (
                  <tr key={itp.id} className="hover:bg-muted/10">
                    <td className="px-6 py-4 font-medium">{itp.activity}</td>
                    <td className="px-6 py-4">
                      {itp.holdPoint ? (
                        <Badge variant="destructive" className="bg-destructive/20 text-destructive border-destructive/30 hover:bg-destructive/20">Hold Point</Badge>
                      ) : (
                        <Badge variant="outline">Witness</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4">{itp.method}</td>
                    <td className="px-6 py-4 text-muted-foreground">{itp.acceptanceCriteria}</td>
                    <td className="px-6 py-4">
                      <select 
                        className="bg-transparent border border-border rounded text-xs px-2 py-1 focus:ring-1 focus:ring-primary"
                        value={itp.status}
                        onChange={(e) => updateRecord('itps', itp.id, { status: e.target.value })}
                        data-testid={`select-status-${itp.id}`}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteRecord('itps', itp.id)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredITPs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No ITP items found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add ITP Item">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Activity Description</label>
            <Input value={formData.activity} onChange={e => setFormData({...formData, activity: e.target.value})} placeholder="e.g. Concrete Pouring" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="holdPoint" checked={formData.holdPoint} onChange={e => setFormData({...formData, holdPoint: e.target.checked})} className="rounded border-border bg-transparent text-primary focus:ring-primary" />
            <label htmlFor="holdPoint" className="text-sm">Is this a Hold Point?</label>
          </div>
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Inspection Method</label>
            <Input value={formData.method} onChange={e => setFormData({...formData, method: e.target.value})} placeholder="e.g. Visual Inspection" />
          </div>
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Acceptance Criteria</label>
            <Input value={formData.acceptanceCriteria} onChange={e => setFormData({...formData, acceptanceCriteria: e.target.value})} placeholder="e.g. Spec Sec 03300" />
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Item</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
