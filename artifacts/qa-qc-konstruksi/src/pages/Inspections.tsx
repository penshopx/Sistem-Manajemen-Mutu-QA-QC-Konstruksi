import { useState } from "react";
import { useStore, Inspection } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Modal } from "@/components/ui/core";
import { Plus, Search, MapPin } from "lucide-react";

export function Inspections() {
  const { state, addRecord, updateRecord, deleteRecord } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Inspection>>({
    type: "MIR", activity: "", location: "", testResult: "", status: "Pending"
  });

  const filtered = state.inspections.filter(i => 
    i.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.activity.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = () => {
    if (!formData.activity || !formData.location) return;
    const isMir = formData.type === "MIR";
    const ref = `${isMir ? 'MIR' : 'WIR'}-${new Date().getFullYear().toString().slice(2)}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    
    addRecord('inspections', {
      id: crypto.randomUUID(),
      type: formData.type || "MIR",
      reference: ref,
      activity: formData.activity,
      location: formData.location,
      inspector: "Andi Subroto",
      date: new Date().toISOString(),
      status: formData.status || "Pending",
      testResult: formData.testResult || "-",
      evidenceCount: Math.floor(Math.random() * 5)
    } as Inspection);
    
    setIsAddModalOpen(false);
    setFormData({ type: "MIR", activity: "", location: "", testResult: "", status: "Pending" });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-display uppercase tracking-tight">Inspections</h1>
          <p className="text-muted-foreground text-sm">Material & Work Inspection Requests</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="gap-2" data-testid="button-add-inspection">
          <Plus className="w-4 h-4" /> New Request
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <CardTitle>Field Records</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search ref, activity..." 
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/50 border-b border-border font-mono text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Ref & Type</th>
                  <th className="px-6 py-3 font-medium">Activity & Location</th>
                  <th className="px-6 py-3 font-medium">Result / Note</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(insp => (
                  <tr key={insp.id} className="hover:bg-muted/10">
                    <td className="px-6 py-4">
                      <div className="font-mono text-primary font-bold">{insp.reference}</div>
                      <Badge variant="outline" className="mt-1 text-[10px]">{insp.type}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{insp.activity}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" /> {insp.location}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-sm">
                      {insp.testResult}
                      {insp.evidenceCount > 0 && <div className="text-[10px] text-primary mt-1">{insp.evidenceCount} photos attached</div>}
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        className={`bg-transparent border border-border rounded text-xs px-2 py-1 focus:ring-1 focus:ring-primary ${insp.status === 'Passed' ? 'text-green-500' : insp.status === 'Failed' ? 'text-destructive' : ''}`}
                        value={insp.status}
                        onChange={(e) => updateRecord('inspections', insp.id, { status: e.target.value })}
                        data-testid={`select-status-${insp.id}`}
                      >
                        <option value="Pending" className="text-foreground">Pending</option>
                        <option value="Passed" className="text-green-500">Passed</option>
                        <option value="Failed" className="text-destructive">Failed</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteRecord('inspections', insp.id)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">No inspection records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="New Inspection Request">
        <div className="space-y-4">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="type" value="MIR" checked={formData.type === "MIR"} onChange={() => setFormData({...formData, type: "MIR"})} className="text-primary focus:ring-primary bg-transparent border-border" />
              MIR (Material)
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="radio" name="type" value="WIR" checked={formData.type === "WIR"} onChange={() => setFormData({...formData, type: "WIR"})} className="text-primary focus:ring-primary bg-transparent border-border" />
              WIR (Work)
            </label>
          </div>
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Activity / Material</label>
            <Input value={formData.activity} onChange={e => setFormData({...formData, activity: e.target.value})} placeholder="e.g. Rebar installation" />
          </div>
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Location</label>
            <Input value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="e.g. Zone B Level 2" />
          </div>
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Notes / Initial Results</label>
            <Input value={formData.testResult} onChange={e => setFormData({...formData, testResult: e.target.value})} placeholder="Optional notes" />
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Create Request</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
