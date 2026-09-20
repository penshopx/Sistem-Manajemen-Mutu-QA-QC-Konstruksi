export type ProjectScoped = { projectId: string };

export function onlyProjectRows<T extends ProjectScoped>(projectId: string, rows: readonly T[]): T[] {
  return rows.filter((row) => row.projectId === projectId);
}

export function invitationMembership(
  invitation: { projectId: string; role: "QA_ENGINEER" | "QC_INSPECTOR" | "SITE_MANAGER" | "PROJECT_MANAGER" },
  userId: string,
) {
  return {
    projectId: invitation.projectId,
    userId,
    role: invitation.role,
  };
}