import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  ClipboardCheck, 
  SearchCheck, 
  AlertOctagon, 
  FileStack, 
  BarChart4,
  ActivitySquare
} from "lucide-react";

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/quality-plan", label: "Quality Plan", icon: ClipboardCheck },
    { href: "/inspections", label: "Inspections", icon: SearchCheck },
    { href: "/ncr", label: "NCR & CAPA", icon: AlertOctagon },
    { href: "/documents", label: "Documents", icon: FileStack },
    { href: "/reports", label: "Reports", icon: BarChart4 },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-border bg-sidebar flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <div className="flex items-center gap-3 text-primary">
            <ActivitySquare className="h-6 w-6" />
            <span className="font-display font-bold text-xl tracking-wide text-foreground">
              QA/QC<span className="text-primary">CORE</span>
            </span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto py-6">
          <div className="px-4 mb-2">
            <h2 className="text-xs uppercase tracking-[0.2em] font-mono text-muted-foreground mb-4 px-2">Control Room</h2>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = location === item.href;
                return (
                  <Link key={item.href} href={item.href}>
                    <div 
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-sm cursor-pointer transition-colors ${
                        isActive 
                          ? "bg-primary/10 text-primary border border-primary/20" 
                          : "text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
                      }`}
                      data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="font-medium text-sm">{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
        
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-2">
            <div className="h-8 w-8 rounded-sm bg-muted flex items-center justify-center border border-border">
              <span className="font-display text-sm font-bold text-foreground">AS</span>
            </div>
            <div>
              <div className="text-sm font-bold">Andi Subroto</div>
              <div className="text-xs font-mono text-muted-foreground">QA Engineer</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Decorative Grid overlay */}
        <div className="absolute inset-0 grid-surface pointer-events-none opacity-20 z-0"></div>
        
        <header className="h-16 flex-shrink-0 border-b border-border bg-card/80 backdrop-blur-md flex items-center px-6 justify-between z-10 relative">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-primary bg-primary/10 px-2 py-1 rounded border border-primary/20 uppercase">
              Live Control
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              PRJ-GPI-24 // Gedung Pusat Inovasi
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              System Online
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto z-10 relative">
          <div className="p-6 md:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
