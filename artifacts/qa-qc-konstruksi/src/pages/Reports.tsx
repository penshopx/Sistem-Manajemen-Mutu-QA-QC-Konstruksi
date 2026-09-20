import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, Button } from "@/components/ui/core";
import { Download, BarChart4, TrendingUp, AlertOctagon } from "lucide-react";

export function ReportsPage() {
  const { state } = useStore();

  const totalInspections = state.inspections.length;
  const passedInspections = state.inspections.filter(i => i.status === 'Passed').length;
  const failedInspections = state.inspections.filter(i => i.status === 'Failed').length;
  const pendingInspections = state.inspections.filter(i => i.status === 'Pending').length;

  const passRate = totalInspections ? Math.round((passedInspections / totalInspections) * 100) : 0;

  const ncrTotal = state.ncrs.length;
  const ncrOpen = state.ncrs.filter(n => n.status === 'Open').length;
  const ncrClosed = state.ncrs.filter(n => n.status === 'Closed').length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-display uppercase tracking-tight">Quality Reports</h1>
          <p className="text-muted-foreground text-sm">Metrics & Performance Summaries</p>
        </div>
        <Button className="gap-2" onClick={() => window.print()}>
          <Download className="w-4 h-4" /> Export PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="col-span-1 md:col-span-2 bg-gradient-to-br from-card to-card/50">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="text-primary h-5 w-5" /> 
              Project Quality Score
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <div className="flex flex-col items-center">
              <div className="text-7xl font-display font-bold text-primary mb-2">
                {state.projects[0]?.qualityScore || 0}
              </div>
              <div className="text-sm font-mono text-muted-foreground uppercase tracking-widest">
                Target: 90.0
              </div>
              <div className="w-full max-w-2xl mt-8">
                <div className="flex justify-between text-xs font-mono text-muted-foreground mb-2">
                  <span>0</span>
                  <span>50</span>
                  <span>100</span>
                </div>
                <div className="h-4 w-full bg-muted/50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-accent to-primary" 
                    style={{ width: `${state.projects[0]?.qualityScore || 0}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <BarChart4 className="text-primary h-5 w-5" />
              Inspection Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex justify-between items-end mb-6">
              <div>
                <div className="text-sm font-mono text-muted-foreground mb-1 uppercase">First-Time Pass Rate</div>
                <div className="text-4xl font-display font-bold">{passRate}%</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Total Inspections</div>
                <div className="text-xl font-bold">{totalInspections}</div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-green-500 font-medium">Passed</span>
                  <span>{passedInspections}</span>
                </div>
                <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: `${totalInspections ? (passedInspections/totalInspections)*100 : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-destructive font-medium">Failed</span>
                  <span>{failedInspections}</span>
                </div>
                <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden">
                  <div className="h-full bg-destructive" style={{ width: `${totalInspections ? (failedInspections/totalInspections)*100 : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground font-medium">Pending</span>
                  <span>{pendingInspections}</span>
                </div>
                <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden">
                  <div className="h-full bg-muted-foreground/50" style={{ width: `${totalInspections ? (pendingInspections/totalInspections)*100 : 0}%` }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <AlertOctagon className="text-accent h-5 w-5" />
              NCR Resolution
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex justify-between items-end mb-6">
              <div>
                <div className="text-sm font-mono text-muted-foreground mb-1 uppercase">Resolution Rate</div>
                <div className="text-4xl font-display font-bold">{ncrTotal ? Math.round((ncrClosed/ncrTotal)*100) : 0}%</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Total Issued</div>
                <div className="text-xl font-bold">{ncrTotal}</div>
              </div>
            </div>

            <div className="relative h-32 flex items-end gap-2 mt-8 px-4">
              <div className="flex-1 flex flex-col items-center gap-2 group">
                <div className="text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity">{ncrOpen}</div>
                <div className="w-full bg-accent/80 hover:bg-accent transition-colors rounded-t-sm" style={{ height: `${ncrTotal ? Math.max((ncrOpen/ncrTotal)*100, 5) : 5}%` }}></div>
                <div className="text-xs font-mono text-muted-foreground">OPEN</div>
              </div>
              <div className="flex-1 flex flex-col items-center gap-2 group">
                <div className="text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity">{ncrTotal - ncrOpen - ncrClosed}</div>
                <div className="w-full bg-primary/80 hover:bg-primary transition-colors rounded-t-sm" style={{ height: `${ncrTotal ? Math.max(((ncrTotal - ncrOpen - ncrClosed)/ncrTotal)*100, 5) : 5}%` }}></div>
                <div className="text-xs font-mono text-muted-foreground">REVIEW</div>
              </div>
              <div className="flex-1 flex flex-col items-center gap-2 group">
                <div className="text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity">{ncrClosed}</div>
                <div className="w-full bg-green-500/80 hover:bg-green-500 transition-colors rounded-t-sm" style={{ height: `${ncrTotal ? Math.max((ncrClosed/ncrTotal)*100, 5) : 5}%` }}></div>
                <div className="text-xs font-mono text-muted-foreground">CLOSED</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
