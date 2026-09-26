// POST /api/kb/admin/assignments
// Assign a user to an org node as member | manager with a validFrom.
// Schema enforces @@unique([tenantId, userId, nodeId, relation]) — if an
// active assignment already exists we close it (set validTo = now) and open
// a new one, so the assignment history is preserved (Nodo V7 rule).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx || ctx.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { tenantId } = ctx;

  const body = await req.json().catch(() => ({}));
  const { userId, nodeId, relation, validFrom } = body ?? {};

  if (!userId || !nodeId)
    return NextResponse.json(
      { error: "userId and nodeId are required" },
      { status: 400 }
    );

  const rel = relation === "manager" ? "manager" : "member";

  // both user and node must belong to this tenant
  const [user, node] = await Promise.all([
    db.user.findUnique({
      where: { id: String(userId) },
      select: { id: true, tenantId: true, email: true },
    }),
    db.orgNode.findUnique({
      where: { id: String(nodeId) },
      select: { id: true, tenantId: true, name: true },
    }),
  ]);
  if (!user || user.tenantId !== tenantId)
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!node || node.tenantId !== tenantId)
    return NextResponse.json({ error: "Node not found" }, { status: 404 });

  // close any currently-active assignment for the same (user, node, relation)
  const now = new Date();
  await db.orgAssignment.updateMany({
    where: {
      tenantId,
      userId: user.id,
      nodeId: node.id,
      relation: rel,
      validTo: null,
    },
    data: { validTo: now },
  });

  const start = validFrom ? new Date(validFrom) : now;

  const assignment = await db.orgAssignment.create({
    data: {
      tenantId,
      userId: user.id,
      nodeId: node.id,
      relation: rel,
      validFrom: start,
    },
    include: {
      node: { select: { id: true, name: true, type: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });

  await db.auditLog.create({
    data: {
      tenantId,
      action: "CREATE",
      entityType: "ORG_ASSIGNMENT",
      entityId: assignment.id,
      summary: `Assigned ${user.email} as ${rel} of "${node.name}"`,
      userId: ctx.userId,
    },
  });

  return NextResponse.json({ assignment }, { status: 201 });
}
