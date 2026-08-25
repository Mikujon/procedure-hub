import { DepartmentRole, GlobalRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Central permission logic. Every mutating API route / server action should
 * call one of these instead of re-deriving role checks inline, so the rules
 * only live in one place.
 *
 * Role model recap:
 *  - GlobalRole:      ADMIN | COMPLIANCE_OFFICER | USER            (tenant-wide)
 *  - DepartmentRole:  VIEWER | EDITOR | DEPARTMENT_OWNER           (per department)
 *
 * A tenant ADMIN implicitly has DEPARTMENT_OWNER powers everywhere.
 * A COMPLIANCE_OFFICER can act on the COMPLIANCE_APPROVAL workflow stage
 * for any department, regardless of their DepartmentRole there.
 */

export interface ActingUser {
  id: string;
  tenantId: string;
  globalRole: GlobalRole;
}

async function getDepartmentRole(userId: string, departmentId: string): Promise<DepartmentRole | null> {
  const membership = await prisma.departmentMembership.findUnique({
    where: { userId_departmentId: { userId, departmentId } },
  });
  return membership?.role ?? null;
}

/**
 * Defense-in-depth: verifies `departmentId` actually belongs to the acting
 * user's tenant. Callers are expected to have already tenant-scoped the
 * procedure/department they derived this departmentId from — but the ADMIN
 * bypass below in canEditProcedure/canPublishProcedure previously skipped
 * straight past any role check without ever confirming that, so a caller
 * that forgot the tenant filter (as decide/route.ts did) silently let a
 * tenant-A ADMIN act on a tenant-B department. This makes that impossible
 * even if a future route makes the same mistake.
 */
async function departmentBelongsToTenant(departmentId: string, tenantId: string): Promise<boolean> {
  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { tenantId: true },
  });
  return department?.tenantId === tenantId;
}

export async function canViewProcedure(user: ActingUser, procedureId: string): Promise<boolean> {
  const procedure = await prisma.procedure.findUnique({ where: { id: procedureId } });
  if (!procedure || procedure.tenantId !== user.tenantId) return false;

  if (procedure.visibility === "PUBLIC") return true;
  if (user.globalRole === "ADMIN") return true;

  const role = await getDepartmentRole(user.id, procedure.departmentId);
  if (procedure.visibility === "DEPARTMENT") return role !== null;
  if (procedure.visibility === "RESTRICTED") return role !== null; // membership is the explicit grant
  return false;
}

/**
 * Given a set of procedure ids a search engine (MeiliSearch or its Postgres
 * fallback, see lib/search.ts/api/search/route.ts) already returned as
 * candidates, returns only the ones `user` may actually see — PUBLISHED
 * *and* passing the same visibility rule as canViewProcedure/
 * visibilityWhereClause — in the same order as `hitIds`, dropping the rest.
 *
 * Why this exists rather than trusting the search engine's own result set:
 * the engine's own filters (status/department/tags) are index-side and, for
 * MeiliSearch specifically, built from a string filter DSL that a crafted
 * query param could in principle break out of (see
 * escapeMeiliFilterValue in lib/search.ts for the injection this guards
 * against at the source) — visibility scoping was never enforced at the
 * index layer at all, only `status = PUBLISHED`. So a hit list is only ever
 * a set of *candidates*; this is the one place, shared by every caller, that
 * turns candidates into what the requesting user is actually allowed to see,
 * the same "search picks candidates, Postgres decides visibility" split
 * api/ai/ask/route.ts already relied on before this was pulled out here.
 */
export async function filterVisibleProcedureHits(
  user: ActingUser,
  tenantId: string,
  hitIds: string[]
): Promise<{ id: string; title: string; code: string; summary: string | null; type: string; departmentName: string }[]> {
  if (hitIds.length === 0) return [];

  const visible = await prisma.procedure.findMany({
    where: { id: { in: hitIds }, tenantId, status: "PUBLISHED", ...(await visibilityWhereClause(user)) },
    select: { id: true, title: true, code: true, summary: true, type: true, department: { select: { name: true } } },
  });
  const byId = new Map(visible.map((p) => [p.id, p]));

  // Preserve the search engine's relevance order — the findMany above
  // doesn't guarantee it back.
  return hitIds
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
    .map((p) => ({ id: p.id, title: p.title, code: p.code, summary: p.summary, type: p.type, departmentName: p.department.name }));
}

/**
 * Same rule as canViewProcedure, expressed as a Prisma `where` fragment
 * instead of a per-row check — for list endpoints, where calling
 * canViewProcedure once per row would be an N+1. ADMIN bypasses (returns an
 * always-true fragment); everyone else sees PUBLIC procedures plus any
 * procedure in a department they belong to (DEPARTMENT and RESTRICTED are
 * both gated the same way: membership is the grant, same as the per-row check).
 */
export async function visibilityWhereClause(user: ActingUser) {
  if (user.globalRole === "ADMIN") return {};

  const memberships = await prisma.departmentMembership.findMany({
    where: { userId: user.id },
    select: { departmentId: true },
  });
  const departmentIds = memberships.map((m) => m.departmentId);

  return {
    OR: [{ visibility: "PUBLIC" as const }, { departmentId: { in: departmentIds } }],
  };
}

export async function canEditProcedure(user: ActingUser, departmentId: string): Promise<boolean> {
  if (!(await departmentBelongsToTenant(departmentId, user.tenantId))) return false;
  if (user.globalRole === "ADMIN") return true;
  const role = await getDepartmentRole(user.id, departmentId);
  return role === "EDITOR" || role === "DEPARTMENT_OWNER";
}

export async function canPublishProcedure(user: ActingUser, departmentId: string): Promise<boolean> {
  if (!(await departmentBelongsToTenant(departmentId, user.tenantId))) return false;
  if (user.globalRole === "ADMIN") return true;
  const role = await getDepartmentRole(user.id, departmentId);
  return role === "DEPARTMENT_OWNER";
}

/**
 * Whether `user` may push a content change (a block edit, or a new version
 * via the legacy PATCH /api/procedures/[id] path) to a Procedure that might
 * be locked via "Blocca pagina" (page-options menu, POST /[id]/lock). Same
 * department-edit rule as canEditProcedure, tightened once isLocked is set:
 * only whoever could publish (Department Owner/Admin) stays able to edit —
 * everyone else is frozen out until it's unlocked again. Workflow
 * transitions (submit/decide/archive, lib/workflow) are a separate surface
 * and intentionally NOT gated by this — locking content isn't the same as
 * freezing its approval state.
 */
export async function canMutateProcedureContent(
  user: ActingUser,
  procedure: { departmentId: string; isLocked: boolean }
): Promise<boolean> {
  if (!(await canEditProcedure(user, procedure.departmentId))) return false;
  if (!procedure.isLocked) return true;
  return canPublishProcedure(user, procedure.departmentId);
}

/** Compliance approval stage can be actioned by any Compliance Officer, tenant-wide. */
export function canActOnComplianceStage(user: ActingUser): boolean {
  return user.globalRole === "ADMIN" || user.globalRole === "COMPLIANCE_OFFICER";
}

export function isTenantAdmin(user: ActingUser): boolean {
  return user.globalRole === "ADMIN";
}

/**
 * Workspace (pages & databases) access model, aligned with the product goal:
 * *every* employee has an account and can READ all company procedures, while
 * only designated people can EDIT.
 *
 *  - Read:  any authenticated member of the tenant (enforced by tenantId scope
 *           on the queries — there is no per-page hiding at this layer).
 *  - Edit:  tenant ADMIN, COMPLIANCE_OFFICER, or anyone who holds an EDITOR /
 *           DEPARTMENT_OWNER role in at least one department (i.e. an author).
 *           Pure VIEWERs get a clean read-only experience.
 */
export async function canEditWorkspace(user: ActingUser): Promise<boolean> {
  if (user.globalRole === "ADMIN" || user.globalRole === "COMPLIANCE_OFFICER") return true;
  const editorMembership = await prisma.departmentMembership.findFirst({
    where: { userId: user.id, role: { in: ["EDITOR", "DEPARTMENT_OWNER"] } },
    select: { id: true },
  });
  return editorMembership !== null;
}

/**
 * A Block belongs to exactly one of Procedure or Page (Fase 2b) — this
 * routes edit-permission checks to the right rule instead of every Block
 * route reimplementing "which parent do I have" itself. Pass the Block
 * already `include: { procedure: true, page: { include: { procedure: true } } }`'d
 * (avoids extra queries here).
 *
 * Fase 3: a Page "promoted" to a governed Procedure (Page.procedure set)
 * holds that procedure's content under Block.pageId — its edit rule must be
 * the same department-based canEditProcedure check as a classic procedure,
 * not the blanket canEditWorkspace a free page gets. Getting this wrong
 * would silently loosen who can edit governed content after promotion.
 */
export async function canEditBlockParent(
  user: ActingUser,
  block: {
    procedureId: string | null;
    pageId: string | null;
    procedure: { departmentId: string; isLocked: boolean } | null;
    page?: { procedure: { departmentId: string; isLocked: boolean } | null } | null;
  }
): Promise<boolean> {
  if (block.procedureId && block.procedure) {
    return canMutateProcedureContent(user, block.procedure);
  }
  if (block.pageId) {
    if (block.page?.procedure) {
      return canMutateProcedureContent(user, block.page.procedure);
    }
    return canEditWorkspace(user);
  }
  return false;
}

/** Used by the admin dashboard / user management screens. */
export async function canManageUsers(user: ActingUser): Promise<boolean> {
  return user.globalRole === "ADMIN";
}
