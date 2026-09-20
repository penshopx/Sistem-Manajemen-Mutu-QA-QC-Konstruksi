import { useEffect, useRef, type ReactNode } from "react";
import { ClerkProvider, Show, SignIn, SignUp, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { dark } from "@clerk/themes";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Route, Switch, useLocation, Router as WouterRouter } from "wouter";
import { StoreProvider } from "@/lib/store";
import { Shell } from "@/components/layout/Shell";
import { Dashboard } from "@/pages/Dashboard";
import { QualityPlan } from "@/pages/QualityPlan";
import { Inspections } from "@/pages/Inspections";
import { NCRPage } from "@/pages/NCR";
import { DocumentsPage } from "@/pages/Documents";
import { ReportsPage } from "@/pages/Reports";
import { TeamPage } from "@/pages/Team";
import { MaterialsPage } from "@/pages/Materials";

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
}

const clerkAppearance = {
  theme: dark,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#38bdf8",
    colorForeground: "#f8fafc",
    colorMutedForeground: "#94a3b8",
    colorDanger: "#fb7185",
    colorBackground: "#111827",
    colorInput: "#0f172a",
    colorInputForeground: "#f8fafc",
    colorNeutral: "#334155",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    borderRadius: "0.375rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-slate-900 rounded-xl w-[440px] max-w-full overflow-hidden border border-slate-700",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-slate-50",
    headerSubtitle: "text-slate-300",
    socialButtonsBlockButtonText: "text-slate-100",
    formFieldLabel: "text-slate-100",
    footerActionLink: "text-sky-400",
    footerActionText: "text-slate-300",
    dividerText: "text-slate-400",
    identityPreviewEditButton: "text-sky-400",
    formFieldSuccessText: "text-emerald-400",
    alertText: "text-rose-100",
    logoBox: "h-12",
    logoImage: "h-10",
    socialButtonsBlockButton: "border-slate-600 bg-slate-800",
    formButtonPrimary: "bg-sky-500 text-slate-950 hover:bg-sky-400",
    formFieldInput: "border-slate-600 bg-slate-950 text-slate-50",
    footerAction: "bg-slate-950/50",
    dividerLine: "bg-slate-700",
    alert: "border-rose-800 bg-rose-950",
    otpCodeFieldInput: "border-slate-600 bg-slate-950 text-slate-50",
    formFieldRow: "text-slate-100",
    main: "text-slate-50",
  },
};

function CacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const id = user?.id ?? null;
    if (previous.current !== undefined && previous.current !== id) client.clear();
    previous.current = id;
  }), [addListener, client]);
  return null;
}

function Landing() {
  return (
    <>
      <Show when="signed-in"><AuthenticatedApp /></Show>
      <Show when="signed-out">
        <main className="min-h-screen bg-background grid-surface flex items-center justify-center px-6 text-foreground">
          <section className="max-w-3xl text-center">
            <img src={`${basePath}/logo.svg`} alt="QA/QC Core" className="mx-auto mb-8 h-16" />
            <p className="mb-3 font-mono text-sm uppercase tracking-[0.25em] text-primary">Shared Quality Control</p>
            <h1 className="font-display text-5xl font-bold md:text-7xl">Satu data mutu untuk seluruh tim proyek.</h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Kelola RMK, inspeksi, NCR/CAPA, dokumen, dan audit trail secara terpusat dengan akses sesuai peran.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <a href={`${basePath}/sign-in`} className="rounded bg-primary px-6 py-3 font-bold text-primary-foreground">Masuk</a>
              <a href={`${basePath}/sign-up`} className="rounded border border-border px-6 py-3 font-bold">Buat akun tim</a>
            </div>
          </section>
        </main>
      </Show>
    </>
  );
}

function AuthenticatedApp() {
  return (
    <StoreProvider>
      <Shell>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/quality-plan" component={QualityPlan} />
          <Route path="/inspections" component={Inspections} />
          <Route path="/ncr" component={NCRPage} />
          <Route path="/materials" component={MaterialsPage} />
          <Route path="/documents" component={DocumentsPage} />
          <Route path="/reports" component={ReportsPage} />
          <Route path="/team" component={TeamPage} />
          <Route component={NotFound} />
        </Switch>
      </Shell>
    </StoreProvider>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function AppRoutes() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/sign-in/*?">
          <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
          </div>
        </Route>
        <Route path="/sign-up/*?">
          <div className="flex min-h-screen items-center justify-center bg-background px-4">
            <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
          </div>
        </Route>
        <Route>
          <Show when="signed-in"><AuthenticatedApp /></Show>
          <Show when="signed-out"><Landing /></Show>
        </Route>
      </Switch>
    </RoutedErrorBoundary>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "Masuk ke QA/QC Core", subtitle: "Akses ruang kerja proyek Anda" } },
        signUp: { start: { title: "Buat akun tim", subtitle: "Mulai bekerja dengan data mutu yang sama" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <CacheInvalidator />
        <TooltipProvider>
          <AppRoutes />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default function App() {
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}