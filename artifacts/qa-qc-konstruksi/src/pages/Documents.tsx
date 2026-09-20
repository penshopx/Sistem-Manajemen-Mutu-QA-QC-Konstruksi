import { useState } from "react";
import { useStore, Document } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Modal } from "@/components/ui/core";
import { Plus, Search, FileText } from "lucide-react";

export function DocumentsPage() {
  const { state, addRecord, updateRecord, deleteRecord } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Document>>({
    title: "", category: "Manual", revision: "00", owner: "", status: "Draft"
  });

  const filtered = state.documents.filter(d => 
    d.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = () => {
    if (!formData.title || !formData.category) return;
    const catCode = formData.category.substring(0, 3).toUpperCase();
    const code = `DOC-${catCode}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
    
    addRecord('documents', {
      id: crypto.randomUUID(),
      code: code,
      title: formData.title,
      category: formData.category,
      revision: formData.revision || "00",
      owner: formData.owner || "QA Dept",
      status: formData.status || "Draft",
      updatedAt: new Date().toISOString()
    } as Document);
    
    setIsAddModalOpen(false);
    setFormData({ title: "", category: "Manual", revision: "00", owner: "", status: "Draft" });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-display uppercase tracking-tight">Controlled Documents</h1>
          <p className="text-muted-foreground text-sm">Document Control & Audit Register</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)} className="gap-2" data-testid="button-add-document">
          <Plus className="w-4 h-4" /> Add Document
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <CardTitle>Document Register</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search code, title..." 
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
                  <th className="px-6 py-3 font-medium">Document Code</th>
                  <th className="px-6 py-3 font-medium">Title</th>
                  <th className="px-6 py-3 font-medium">Rev</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Last Update</th>
                  <th className="px-6 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(doc => (
                  <tr key={doc.id} className="hover:bg-muted/10">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        <span className="font-mono font-bold text-primary">{doc.code}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium">{doc.title}</div>
                      <div className="text-xs text-muted-foreground">{doc.category} • {doc.owner}</div>
                    </td>
                    <td className="px-6 py-4 font-mono">{doc.revision}</td>
                    <td className="px-6 py-4">
                      <select 
                        className={`bg-transparent border border-border rounded text-xs px-2 py-1 focus:ring-1 focus:ring-primary ${doc.status === 'Published' ? 'text-green-500' : 'text-accent'}`}
                        value={doc.status}
                        onChange={(e) => updateRecord('documents', doc.id, { status: e.target.value })}
                      >
                        <option value="Draft" className="text-foreground">Draft</option>
                        <option value="In Review" className="text-foreground">In Review</option>
                        <option value="Published" className="text-green-500">Published</option>
                        <option value="Obsolete" className="text-muted-foreground">Obsolete</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">
                      {new Date(doc.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => deleteRecord('documents', doc.id)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">No documents found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add Controlled Document">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Document Title</label>
            <Input value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Concrete Pouring Manual" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Category</label>
              <select 
                className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
              >
                <option value="Manual">Manual</option>
                <option value="SOP">SOP</option>
                <option value="Form">Form / Checklist</option>
                <option value="Specification">Specification</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Initial Revision</label>
              <Input value={formData.revision} onChange={e => setFormData({...formData, revision: e.target.value})} placeholder="00" />
            </div>
          </div>
          <div>
            <label className="text-xs font-mono text-muted-foreground uppercase mb-1 block">Owner / Department</label>
            <Input value={formData.owner} onChange={e => setFormData({...formData, owner: e.target.value})} placeholder="QA Dept" />
          </div>
          <div className="pt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Add Document</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
