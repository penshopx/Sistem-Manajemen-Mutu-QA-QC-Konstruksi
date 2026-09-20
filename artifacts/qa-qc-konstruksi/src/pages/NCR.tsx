import { useState } from "react";
import { useStore, NCR } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Modal } from "@/components/ui/core";
import { Plus, Search, AlertOctagon } from "lucide-react";

export function NCRPage() {
  const { state, addRecord, updateRecord, deleteRecord } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  const [formData, setFormData] = useState<Partial<NCR>>({
    finding: "", severity: "Medium", owner: "", rootCause: "", correctiveAction: ""
  });

  const filtered = state.ncrs.filter(n => 
    n.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.finding.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.owner.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = () => {
    if (!formData.finding || !formData.owner) return;
    const num = `NCR-${new Date().getFullYear().toString().slice(2)}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    
    addRecord('ncrs', {
      id: crypto.randomUUID(),
      number: num,
      finding: formData.finding,
      severity: formData.severity || "Medium",
      owner: formData.owner,
      dueDate: new Date(Date.now() + 86400000 * 7).toISOString(),
      status: "Open",
      rootCause: formData.rootCause || "TBD",
      correctiveAction: formData.correctiveAction || "TBD"
    } as NCR);
    
    setIsAddModalOpen(false);
    setFormData({ finding: "", severity: "Medium", owner: "", rootCause: "", correctiveAction: "" });
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'Critical': return <Badge variant="destructive" className="bg-red-600">CRITICAL</Badge>;
      case 'High': return <Badge variant="destructive">HIGH</Badge>;
      case 'Medium': return <Badge variant="warning">MED</Badge>;
      case 'Low': return <Badge variant="outline">LOW</Badge>;
      default: return <Badge variant="outline">{sev}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-display uppercase tracking-tight text-accent">Non-Conformance</h1>
          <p className="text-muted-foreground text-sm">NCR & Corrective/Preventive Actions</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} variant="accent" className="gap-2" data-testid="button-add-ncr">
          <Plus className="w-4 h-4" /> Issue NCR
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-l-4 border-l-destructive bg-card/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-mono text-muted-foreground uppercase">Critical / High</div>
              <div className="text-2xl font-display font-bold">
                {state.ncrs.filter(n => n.status === 'Open' && (n.severity === 'Critical' || n.severity === 'High')).length}
              </div>
            </div>
            <AlertOctagon className="text-destructive h-8 w-8 opacity-50" />
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-warning bg-card/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-mono text-muted-foreground uppercase">Open Actions</div>
              <div className="text-2xl font-display font-bold">
                {state.ncrs.filter(n => n.status === 'Open').length}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-success bg-card/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-mono text-muted-foreground uppercase">Closed</div>
              <div className="text-2xl font-display font-bold">
                {state.ncrs.filter(n => n.status === 'Closed').length}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <CardTitle>NCR Register</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search NCR..." 
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
                  <th className="px-6 py-3 font-medium">Number</th>
                  <th className="px-6 py-3 font-medium w-1/3">Finding</th>
                  <th className="px-6 py-3 font-medium">Owner & Due</th>
                  <th className="px-6 py-3 font-medium">Severity</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(ncr => (
                  <tr key={ncr.id} className="hover:bg-muted/10">
                    <td className="px-6 py-4 font-mono font-bold text-accent">{ncr.number}</td>
                    <td className="px-6 py-4">
                      <div className="font-medium line-clamp-2">{ncr.finding}</div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-1">CAPA: {ncr.correctiveAction}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div>{ncr.owner}</div>
                      <div className={`text-xs mt-1 ${new Date(ncr.dueDate) < new Date() && ncr.status === 'Open' ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
                        Due: {new Date(ncr.dueDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getSeverityBadge(ncr.severity)}
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        className={`bg-transparent border border-border rounded text-xs px-2 py-1 focus:ring-1 focus:ring-accent ${ncr.status === 'Closed' ? 'text-green-500' : 'text-accent'}`}
                        value={ncr.status}
                        onChange={(e) => updateRecord('ncrs', ncr.id, { status: e.target.value as NCR['status'] })}
                        data-testid={`select-status-${ncr.id}`}
                      >
                        <option value="Open" className="text-foreground">Open</option>
                        <option value="In Review" className="text-foreground">In Review</option>
                        <option value="Closed" className="text-green-500">Closed</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteRecord('ncrs', ncr.id)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No NCR records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Issue Non-Conformance Report">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Finding / Description</label>
            <textarea 
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
              rows={3}
              value={formData.finding} 
              onChange={e => setFormData({...formData, finding: e.target.value})} 
              placeholder="Describe the non-conformance..." 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Severity</label>
              <select 
                className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                value={formData.severity}
                onChange={e => setFormData({...formData, severity: e.target.value as NCR['severity']})}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Responsible Party</label>
              <Input value={formData.owner} onChange={e => setFormData({...formData, owner: e.target.value})} placeholder="e.g. Subcon A" />
            </div>
          </div>
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Initial Root Cause Analysis</label>
            <Input value={formData.rootCause} onChange={e => setFormData({...formData, rootCause: e.target.value})} placeholder="Optional" />
          </div>
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Proposed Corrective Action (CAPA)</label>
            <Input value={formData.correctiveAction} onChange={e => setFormData({...formData, correctiveAction: e.target.value})} placeholder="Optional" />
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button variant="accent" onClick={handleSave}>Issue NCR</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
