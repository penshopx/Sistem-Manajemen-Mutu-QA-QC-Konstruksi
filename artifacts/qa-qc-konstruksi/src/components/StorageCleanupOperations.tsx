import { useGetStorageCleanupOperations } from "@workspace/api-client-react";
import { AlertTriangle, CheckCircle2, Clock3, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/core";
import { Skeleton } from "@/components/ui/skeleton";

const QUERY_OPTIONS = {
  queryKey: ["/api/workspace/operations/storage-cleanup"] as const,
  refetchInterval: 15_000,
  staleTime: 5_000,
  refetchOnWindowFocus: "always" as const,
};

const SUMMARY_ITEMS = [
  { key: "pending", label: "Upload tertunda", icon: Clock3, tone: "text-amber-500" },
  { key: "deleted", label: "Terhapus", icon: Trash2, tone: "text-emerald-500" },
  { key: "preserved", label: "Dipertahankan", icon: ShieldCheck, tone: "text-sky-500" },
  { key: "failed", label: "Gagal", icon: XCircle, tone: "text-destructive" },
] as const;

export function StorageCleanupOperations() {
  const operations = useGetStorageCleanupOperations({ query: QUERY_OPTIONS });

  if (operations.isLoading) {
    return (
      <Card data-testid="panel-storage-cleanup-loading">
        <CardHeader>
          <Skeleton className="h-6 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (operations.error || !operations.data) {
    return (
      <Card className="border-destructive/50 bg-destructive/5" data-testid="alert-storage-cleanup-unavailable">
        <CardContent className="flex items-start gap-3 p-5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <div className="font-semibold">Status pembersihan belum tersedia</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Muat ulang halaman atau periksa layanan API jika status ini tetap tidak tersedia.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const data = operations.data;
  const hasWarning = data.warning !== null;
  const isRepeatedWarning = data.warning?.level === "warning";

  return (
    <Card className="overflow-hidden" data-testid="panel-storage-cleanup">
      <CardHeader className="border-b border-border bg-muted/20">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Operasional Pembersihan Storage
          </CardTitle>
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {data.windowHours} jam terakhir
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {SUMMARY_ITEMS.map(({ key, label, icon: Icon, tone }) => (
            <div key={key} className="rounded-md border border-border bg-background/60 p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <Icon className={`h-4 w-4 ${tone}`} />
                {label}
              </div>
              <div className="mt-2 text-2xl font-bold font-display" data-testid={`value-storage-cleanup-${key}`}>
                {data[key]}
              </div>
            </div>
          ))}
        </div>

        {hasWarning ? (
          <div
            className={isRepeatedWarning
              ? "rounded-md border border-destructive/50 bg-destructive/10 p-4"
              : "rounded-md border border-amber-500/50 bg-amber-500/10 p-4"}
            data-testid="alert-storage-cleanup-warning"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${isRepeatedWarning ? "text-destructive" : "text-amber-500"}`} />
              <div className="space-y-2">
                <div className="font-semibold">
                  {isRepeatedWarning ? "Kegagalan pembersihan berulang" : "Pembersihan perlu diperiksa"}
                </div>
                <p className="text-sm" data-testid="text-storage-cleanup-warning">{data.warning?.message}</p>
                {data.repeatedFailures.length > 0 && (
                  <p className="text-sm font-medium" data-testid="text-storage-cleanup-repeated-count">
                    {data.repeatedFailures.length} upload mengalami kegagalan berulang.
                  </p>
                )}
                <div className="rounded border border-current/15 bg-background/50 p-3 text-sm">
                  <div className="font-semibold">Tindak lanjut</div>
                  <p className="mt-1 text-muted-foreground">
                    Periksa log API dan koneksi object storage, lalu jalankan ulang pembersihan setelah penyebab kegagalan diperbaiki.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="status-storage-cleanup-healthy">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Tidak ada kegagalan pembersihan dalam periode ini.
          </div>
        )}
      </CardContent>
    </Card>
  );
}