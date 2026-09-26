import type { User, Document, OrgNode, OrgAssignment } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * RBAC — Nodo-aligned permissions.
 *
 * Permissions (family `kb`, from the closed list 9.4 of the Nodo spec):
 *  - kb:document:publish        — publish a communication/procedura
 *  - kb:policy:publish          — publish a policy + new version
 *  - kb:document:acknowledge    — ack (ONLY for self)
 *  - kb:document:remind         — send reminders
 *  - kb:document:read_status    — TL sees their team's read status (NEW, proposed)
 *
 * Global roles (in User.role) — coarse-grained:
 *  - ADMIN         — everything (platform admin, break-glass)
 *  - COMPLIANCE    — approve any document in the workflow
 *  - HR_HEAD       — publish communications (kb:document:publish)
 *  - LEGAL_HEAD    — publish policies (kb:policy:publish), see read proof (LG-4)
 *  - LEGAL_MANAGER — see read proof, send reminders (LG-4)
 *  - TL            — see read_status of their team only
 *  - FM/CSDM/COO   — see read_status of their perimeter
 *  - VIEWER        — read + ack (self) only
 *
 * Approval workflow (Opzione 3 — configurable per tipo):
 *  - Each document.tipo has a list of required approvals (DocumentTypeApproval)
 *  - For now only "compliance" is configured on "policy" and "procedura"
 *  - Quality/Training/HR can be added later by inserting rows, no code change
 */

export type KbPermission =
  | "kb:document:publish"
  | "kb:policy:publish"
  | "kb:document:acknowledge"
  | "kb:document:remind"
  | "kb:document:read_status";

export type GlobalRole =
  | "ADMIN"
  | "COMPLIANCE"
  | "HR_HEAD"
  | "LEGAL_HEAD"
  | "LEGAL_MANAGER"
  | "TL"
  | "FM"
  | "CSDM"
  | "COO"
  | "VIEWER";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator",
  COMPLIANCE: "Compliance Officer",
  HR_HEAD: "HR Head",
  LEGAL_HEAD: "Legal Head",
  LEGAL_MANAGER: "Legal Manager",
  TL: "Team Leader",
  FM: "Floor Manager",
  CSDM: "Customer Success Delivery Manager",
  COO: "Chief Operating Officer",
  VIEWER: "Viewer",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

/**
 * Can the user perform the given permission?
 * Global check — does NOT consider node-level scoping (use canManageNode
 * for perimeter-scoped actions like TL seeing team read status).
 */
export function can(userRole: string, perm: KbPermission): boolean {
  if (userRole === "ADMIN") return true; // break-glass

  switch (perm) {
    case "kb:document:publish":
      return userRole === "HR_HEAD";
    case "kb:policy:publish":
      return userRole === "LEGAL_HEAD";
    case "kb:document:acknowledge":
      // every authenticated user can ack FOR THEMSELVES only
      return true;
    case "kb:document:remind":
      return userRole === "LEGAL_HEAD" || userRole === "LEGAL_MANAGER";
    case "kb:document:read_status":
      return (
        userRole === "TL" ||
        userRole === "FM" ||
        userRole === "CSDM" ||
        userRole === "COO" ||
        userRole === "LEGAL_HEAD" ||
        userRole === "LEGAL_MANAGER" ||
        userRole === "ADMIN"
      );
    default:
      return false;
  }
}

/**
 * Can the user approve a document at the given approval role?
 * (e.g. can a COMPLIANCE user approve at the "compliance" stage? yes)
 */
export function canApproveAs(userRole: string, approvalRole: string): boolean {
  if (userRole === "ADMIN") return true;
  if (approvalRole === "compliance") return userRole === "COMPLIANCE";
  // future: quality → userRole === "QUALITY", etc.
  return false;
}

/**
 * Can the user edit a document's content?
 * - ADMIN: yes
 * - owner: yes
 * - COMPLIANCE: yes (they need to review/edit during approval)
 * - HR_HEAD / LEGAL_HEAD: yes (they publish)
 * - others: no
 */
export function canEditDocument(userRole: string, isOwner: boolean): boolean {
  if (userRole === "ADMIN") return true;
  if (isOwner) return true;
  if (userRole === "COMPLIANCE") return true;
  if (userRole === "HR_HEAD" || userRole === "LEGAL_HEAD") return true;
  return false;
}

/**
 * Can the user publish (move from approved → published)?
 * Only HR_HEAD (comunicazioni) and LEGAL_HEAD (policy) — gated by tipo.
 */
export function canPublish(userRole: string, documentTipo: string): boolean {
  if (userRole === "ADMIN") return true;
  if (documentTipo === "policy") return userRole === "LEGAL_HEAD";
  if (documentTipo === "comunicazione") return userRole === "HR_HEAD";
  // procedura/processo/documento: configurable — for now HR_HEAD can publish
  return userRole === "HR_HEAD";
}

/**
 * Required approval roles for a document tipo (from DocumentTypeApproval).
 * Defaults: policy → [compliance], procedura → [compliance], others → []
 */
export async function getRequiredApprovals(tenantId: string, tipo: string): Promise<string[]> {
  const config = await db.documentTypeApproval.findUnique({
    where: { tenantId_tipo: { tenantId, tipo } },
  });
  if (config) {
    try {
      const v = JSON.parse(config.requiredApprovals);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  // sensible defaults if no config row exists
  if (tipo === "policy" || tipo === "procedura") return ["compliance"];
  return [];
}

/**
 * Compute the next pending approval stage for a document.
 * Returns the role that needs to approve next, or null if all done.
 */
export async function getNextPendingApproval(
  documentId: string
): Promise<string | null> {
  const approvals = await db.approval.findMany({
    where: { documentId },
    orderBy: { createdAt: "asc" },
  });
  for (const a of approvals) {
    if (a.status === "pending") return a.role;
  }
  return null;
}

/**
 * Is the workflow complete (all required approvals done)?
 */
export async function isWorkflowComplete(documentId: string): Promise<boolean> {
  const doc = await db.document.findUnique({
    where: { id: documentId },
    select: { tenantId: true, tipo: true },
  });
  if (!doc) return false;
  const required = await getRequiredApprovals(doc.tenantId, doc.tipo);
  if (required.length === 0) return true;
  const approvals = await db.approval.findMany({
    where: { documentId },
  });
  return required.every((role) =>
    approvals.some((a) => a.role === role && a.status === "approved")
  );
}
