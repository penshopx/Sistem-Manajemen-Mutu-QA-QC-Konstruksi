import type { ProjectRole } from "./rbac";

export const CLEANUP_WARNING_THRESHOLD = 3;

export function canViewCleanupOperations(role: ProjectRole): boolean {
  return role === "QA_ENGINEER";
}

export function cleanupWarning(failed: number, repeatedFailures: number) {
  if (repeatedFailures > 0) {
    return {
      level: "warning" as const,
      message: `${repeatedFailures} upload gagal dibersihkan sedikitnya ${CLEANUP_WARNING_THRESHOLD} kali. Periksa akses object storage dan hapus file secara manual bila aman.`,
    };
  }
  if (failed > 0) {
    return {
      level: "notice" as const,
      message: `${failed} percobaan pembersihan gagal dalam 24 jam terakhir dan akan dicoba kembali otomatis.`,
    };
  }
  return null;
}