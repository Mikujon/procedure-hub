// GET /api/kb/tree
// Returns the org tree (for the publish form's destination picker).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { tenantId, userId, role } = ctx;

  const nodes = await db.orgNode.findMany({
    where: { tenantId },
    orderBy: { sortOrder: "asc" },
  });

  // build tree
  const byId = new Map(nodes.map((n) => [n.id, { ...n, children: [] as any[] }]));
  const roots: any[] = [];
  for (const n of nodes) {
    const node = byId.get(n.id)!;
    if (n.parentId && byId.has(n.parentId)) {
      byId.get(n.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // user's manageable nodes (for scoping the destination picker)
  const assignments = await db.orgAssignment.findMany({
    where: { userId, relation: "manager" },
    select: { nodeId: true },
  });

  return NextResponse.json({
    tree: roots,
    userManagedNodeIds: assignments.map((a) => a.nodeId),
    canPublishAnywhere: role === "ADMIN" || role === "HR_HEAD" || role === "LEGAL_HEAD",
  });
}
