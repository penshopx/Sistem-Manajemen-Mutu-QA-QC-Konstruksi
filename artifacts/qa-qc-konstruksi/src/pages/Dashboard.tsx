import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/core";
import { Link } from "wouter";
import { ActivitySquare, AlertTriangle, CheckCircle2, ClipboardList } from "lucide-react";

export function Dashboard() {
  const { state } = useStore();
  
  const project = state.projects[0];
  const openNCRs = state.ncrs.filter(n => n.status === 'Open').length;
  const recentInspections = state.inspections.slice(0, 3);
  const recentActivities = state.activities.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-bold font-display mb-1">{project.name}</h1>
          <p className="font-mono text-muted-foreground text-sm uppercase tracking-wider">{project.code} // {project.contractor}</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-mono text-muted-foreground mb-1 uppercase">Quality Index</div>
          <div className="text-4xl font-bold font-display text-primary">{project.qualityScore}<span className="text-lg text-muted-foreground">/100</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 border-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="text-accent h-5 w-5" />
              <div className="font-mono text-xs text-muted-foreground uppercase">Open NCRs</div>
            </div>
            <div className="text-3xl font-display font-bold">{openNCRs}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 border-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <ClipboardList className="text-primary h-5 w-5" />
              <div className="font-mono text-xs text-muted-foreground uppercase">Inspections</div>
            </div>
            <div className="text-3xl font-display font-bold">{state.inspections.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle2 className="text-green-500 h-5 w-5" />
              <div className="font-mono text-xs text-muted-foreground uppercase">ITP Active</div>
            </div>
            <div className="text-3xl font-display font-bold">{state.itps.filter(i => i.status === 'Active').length}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 border-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <ActivitySquare className="text-secondary h-5 w-5" />
              <div className="font-mono text-xs text-muted-foreground uppercase">Doc Published</div>
            </div>
            <div className="text-3xl font-display font-bold">{state.documents.filter(d => d.status === 'Published').length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="border-b border-border bg-muted/20">
            <CardTitle>Recent Inspections (MIR/WIR)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {recentInspections.map(insp => (
                <div key={insp.id} className="p-4 flex items-center justify-between hover:bg-muted/10 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-primary">{insp.reference}</span>
                      <Badge variant={insp.status === 'Passed' ? 'success' : 'destructive'} className="text-[10px] px-1.5 py-0">
                        {insp.status}
                      </Badge>
                    </div>
                    <div className="text-sm font-medium">{insp.activity}</div>
                    <div className="text-xs text-muted-foreground">{insp.location}</div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <div>{new Date(insp.date).toLocaleDateString()}</div>
                    <div className="text-xs">{insp.inspector}</div>
                  </div>
                </div>
              ))}
              {recentInspections.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">No recent inspections.</div>
              )}
            </div>
            <div className="p-3 border-t border-border bg-muted/20 text-center">
              <Link href="/inspections" className="text-sm text-primary hover:underline font-medium">View all inspections</Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border bg-muted/20">
            <CardTitle>Activity Log</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border h-[280px] overflow-y-auto">
              {recentActivities.map(act => (
                <div key={act.id} className="p-4 flex gap-4">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div>
                    <div className="text-sm">
                      <span className="font-bold">{act.actor}</span> {act.action.toLowerCase()} <span className="font-medium text-primary">{act.subject}</span>
                    </div>
                    <div className="text-xs font-mono text-muted-foreground mt-1">
                      {new Date(act.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
