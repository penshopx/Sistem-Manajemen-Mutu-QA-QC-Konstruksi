import { and, eq, isNull, sql } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import {
  db,
  projectInvitationsTable,
  projectMembershipsTable,
  projectsTable,
  usersTable,
} from "@workspace/db";
import { permissionsByRole } from "./rbac";
import { invitationMembership } from "./project-scope";
export { canManageAttachment, canMutate } from "./rbac";

export class ProjectAccessError extends Error {
  constructor(message = "Akun Anda belum diundang ke proyek ini.") {
    super(message);
    this.name = "ProjectAccessError";
  }
}

export async function ensureProjectAccess(clerkUserId: string) {
  const clerkUser = await clerkClient.users.getUser(clerkUserId);
  const email = clerkUser.primaryEmailAddress?.emailAddress.toLowerCase();
  if (!email) throw new ProjectAccessError("Akun harus memiliki alamat email terverifikasi.");
  const name = clerkUser.fullName || clerkUser.firstName || email.split("@")[0];

  return db.transaction(async (tx) => {
    let [user] = await tx.select().from(usersTable).where(eq(usersTable.clerkUserId, clerkUserId)).limit(1);
    if (!user) {
      [user] = await tx.insert(usersTable).values({ clerkUserId, name, email }).returning();
    } else if (user.name !== name || user.email !== email) {
      [user] = await tx.update(usersTable).set({ name, email }).where(eq(usersTable.id, user.id)).returning();
    }

    let [membership] = await tx
      .select({
        id: projectMembershipsTable.id,
        projectId: projectMembershipsTable.projectId,
        role: projectMembershipsTable.role,
      })
      .from(projectMembershipsTable)
      .where(eq(projectMembershipsTable.userId, user.id))
      .limit(1);

    if (!membership) {
      const [{ membershipCount }] = await tx
        .select({ membershipCount: sql<number>`count(*)::int` })
        .from(projectMembershipsTable);

      if (membershipCount === 0) {
        let [project] = await tx.select().from(projectsTable).limit(1);
        if (!project) {
          [project] = await tx.insert(projectsTable).values({
            name: "Gedung Pusat Inovasi",
            code: "PRJ-GPI-24",
            client: "PT Inovasi Mandiri",
            contractor: "Waskita Karya",
            progress: 78,
            qualityScore: 92,
          }).returning();
        }
        [membership] = await tx.insert(projectMembershipsTable).values({
          projectId: project.id,
          userId: user.id,
          role: "QA_ENGINEER",
        }).returning({
          id: projectMembershipsTable.id,
          projectId: projectMembershipsTable.projectId,
          role: projectMembershipsTable.role,
        });
      } else {
        const [invitation] = await tx.select().from(projectInvitationsTable).where(and(
          eq(projectInvitationsTable.email, email),
          isNull(projectInvitationsTable.acceptedAt),
        )).limit(1);
        if (!invitation) throw new ProjectAccessError();
        [membership] = await tx.insert(projectMembershipsTable).values(
          invitationMembership(invitation, user.id),
        ).returning({
          id: projectMembershipsTable.id,
          projectId: projectMembershipsTable.projectId,
          role: projectMembershipsTable.role,
        });
        await tx.update(projectInvitationsTable)
          .set({ acceptedAt: new Date() })
          .where(eq(projectInvitationsTable.id, invitation.id));
      }
    }

    const [project] = await tx.select().from(projectsTable).where(eq(projectsTable.id, membership.projectId)).limit(1);
    if (!project) throw new Error("Project membership points to a missing project");

    return { user, membership, project, permissions: [...permissionsByRole[membership.role]] };
  });
}

export type ProjectAccess = Awaited<ReturnType<typeof ensureProjectAccess>>;
