import { prisma } from "@/lib/prisma";
import { canViewProcedure, visibilityWhereClause, type ActingUser } from "@/lib/permissions";

/**
 * Pulled out of api/favorites/route.ts so the permission gate is testable
 * against the real DB the same way the rest of this codebase's RBAC logic
 * is (tests/helpers/test-tenant.ts), not just reachable through a route
 * handler.
 */
export type ToggleFavoriteResult = { status: "not_found" } | { status: "forbidden" } | { status: "ok"; favorited: boolean };

export async function toggleFavorite(actor: ActingUser, procedureId: string): Promise<ToggleFavoriteResult> {
  // Tenant isolation first, before anything else.
  const procedure = await prisma.procedure.findFirst({
    where: { id: procedureId, tenantId: actor.tenantId },
    select: { id: true },
  });
  if (!procedure) return { status: "not_found" };

  const existing = await prisma.favorite.findUnique({
    where: { userId_procedureId: { userId: actor.id, procedureId: procedure.id } },
  });

  if (existing) {
    // Un-favoriting is always allowed, even for a procedure the caller can
    // no longer view (visibility tightened after they favorited it) —
    // removing their own reference discloses nothing and just lets them
    // clean up a stale entry.
    await prisma.favorite.delete({ where: { id: existing.id } });
    return { status: "ok", favorited: false };
  }

  // Creating a new favorite is what needs the gate: without it, a user
  // could favorite a DEPARTMENT/RESTRICTED procedure they have no
  // membership grant for, turning it into a permanent reference that then
  // shows up (title, department) on their own dashboard/favorites list —
  // the same visibility rule as opening the procedure itself.
  const canView = await canViewProcedure(actor, procedure.id);
  if (!canView) return { status: "forbidden" };

  await prisma.favorite.create({ data: { userId: actor.id, procedureId: procedure.id } });
  return { status: "ok", favorited: true };
}

/**
 * Defense in depth alongside toggleFavorite's own gate: a favorite created
 * before that gate existed, or on a procedure whose visibility was
 * tightened afterward, must not keep showing its title/department here or
 * on the dashboard's own favorites widget.
 */
export async function listVisibleFavorites(actor: ActingUser) {
  return prisma.favorite.findMany({
    where: { userId: actor.id, procedure: { ...(await visibilityWhereClause(actor)) } },
    orderBy: { createdAt: "desc" },
    include: { procedure: { include: { department: { select: { name: true, slug: true } } } } },
  });
}
