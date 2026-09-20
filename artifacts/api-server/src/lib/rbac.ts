export const permissionsByRole = {
  QA_ENGINEER: ["read", "create", "update", "delete", "approve", "manage_members"],
  QC_INSPECTOR: ["read", "create_inspection", "update_inspection", "create_ncr", "update_ncr"],
  SITE_MANAGER: ["read", "update", "approve"],
  PROJECT_MANAGER: ["read", "approve"],
} as const;

export type ProjectRole = keyof typeof permissionsByRole;

export function canMutate(role: ProjectRole, collection: string, action: "create" | "update" | "delete"): boolean {
  if (role === "QA_ENGINEER") return true;
  if (role === "PROJECT_MANAGER") return false;
  if (role === "SITE_MANAGER") return action === "update";
  return action !== "delete" && (collection === "inspections" || collection === "ncrs");
}

export function canManageAttachment(
  role: ProjectRole,
  collection: "inspections" | "ncrs",
  action: "add" | "delete",
): boolean {
  return canMutate(role, collection, action === "add" ? "update" : "delete");
}