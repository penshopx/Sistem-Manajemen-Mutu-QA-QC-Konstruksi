import { useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui/core";
import { useStore, type ProjectRole } from "@/lib/store";

const roleLabels: Record<ProjectRole, string> = {
  QA_ENGINEER: "QA Engineer",
  QC_INSPECTOR: "QC Inspector",
  SITE_MANAGER: "Site Manager",
  PROJECT_MANAGER: "Project Manager",
};

export function TeamPage() {
  const { state, inviteMember } = useStore();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ProjectRole>("QC_INSPECTOR");
  const canInvite = state.currentUser?.role === "QA_ENGINEER";

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    inviteMember(email.trim(), role);
    setEmail("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-bold">Tim Proyek</h1>
        <p className="mt-1 text-muted-foreground">Keanggotaan dan akses berbasis peran untuk proyek aktif.</p>
      </div>

      {canInvite && (
        <Card>
          <CardHeader><CardTitle>Undang anggota</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
              <Input type="email" required placeholder="nama@perusahaan.com" value={email} onChange={(event) => setEmail(event.target.value)} />
              <select className="h-10 rounded border border-input bg-background px-3 text-sm" value={role} onChange={(event) => setRole(event.target.value as ProjectRole)}>
                {Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <Button type="submit">Kirim undangan</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Anggota dan undangan</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {state.members.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="truncate font-bold">{member.name}</div>
                  <div className="truncate text-sm text-muted-foreground">{member.email}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground">{roleLabels[member.role]}</span>
                  <Badge variant={member.status === "active" ? "default" : "outline"}>
                    {member.status === "active" ? "Aktif" : "Diundang"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}