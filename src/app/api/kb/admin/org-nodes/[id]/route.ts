// PATCH  /api/kb/admin/org-nodes/[id]  — update name / code / parentId (move)
// DELETE /api/kb/admin/org-nodes/[id]  — cascade delete (children via DB cascade)
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx || ctx.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { tenantId } = ctx;
  const { id } = await params;

  const node = await db.orgNode.findUnique({
    where: { id },
    select: { id: true, tenantId: true, name: true },
  });
  if (!node || node.tenantId !== tenantId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { name, code, parentId, sortOrder, type } = body ?? {};

  // prevent moving a node under itself (would create a cycle)
  if (parentId && parentId === id)
    return NextResponse.json(
      { error: "A node cannot be its own parent" },
      { status: 400 }
    );

  // validate code uniqueness if changing
  if (code) {
    const existing = await db.orgNode.findUnique({
      where: { tenantId_code: { tenantId, code: String(code) } },
      select: { id: true },
    });
    if (existing && existing.id !== id)
      return NextResponse.json(
        { error: "Code already in use within this tenant" },
        { status: 409 }
      );
  }

  // validate parent belongs to same tenant (and is not a descendant)
  if (parentId) {
    const parent = await db.orgNode.findUnique({
      where: { id: String(parentId) },
      select: { tenantId: true },
    });
    if (!parent || parent.tenantId !== tenantId)
      return NextResponse.json(
        { error: "Parent node not found in this tenant" },
        { status: 400 }
      );

    // check the new parent is not a descendant of this node (cycle guard)
    const isDescendant = await isDescendantOf(id, String(parentId), tenantId);
    if (isDescendant)
      return NextResponse.json(
        { error: "Cannot move a node under one of its own descendants" },
        { status: 400 }
      );
  }

  const data: Record<string, unknown> = {};
  if (typeof name === "string") data.name = name;
  if (typeof code === "string") data.code = code || null;
  if (parentId !== undefined) data.parentId = parentId ? String(parentId) : null;
  if (typeof type === "string") data.type = type;
  if (typeof sortOrder === "number") data.sortOrder = sortOrder;

  const updated = await db.orgNode.update({
    where: { id },
    data,
    select: {
      id: true,
      type: true,
      name: true,
      code: true,
      parentId: true,
      sortOrder: true,
    },
  });

  await db.auditLog.create({
    data: {
      tenantId,
      action: "UPDATE",
      entityType: "ORG_NODE",
      entityId: id,
      summary: `Updated org node "${node.name}" — fields: ${Object.keys(data).join(", ") || "none"}`,
      userId: ctx.userId,
    },
  });

  return NextResponse.json({ node: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getTenantContext();
  if (!ctx || ctx.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { tenantId } = ctx;
  const { id } = await params;

  const node = await db.orgNode.findUnique({
    where: { id },
    select: { id: true, tenantId: true, name: true },
  });
  if (!node || node.tenantId !== tenantId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Cascade is configured at the DB layer (OrgNode.parent onDelete: Cascade),
  // so deleting this node will recursively delete all descendants + their
  // assignments. Prisma emulates this for SQLite via its own cascade handling.
  await db.orgNode.delete({ where: { id } });

  await db.auditLog.create({
    data: {
      tenantId,
      action: "DELETE",
      entityType: "ORG_NODE",
      entityId: id,
      summary: `Deleted org node "${node.name}" (cascade)`,
      userId: ctx.userId,
    },
  });

  return NextResponse.json({ ok: true });
}

// Walk up the tree from candidate to see if it eventually reaches `ancestorId`.
// If so, candidate is a descendant of ancestorId → moving ancestor under
// candidate would create a cycle.
async function isDescendantOf(
  candidateId: string,
  ancestorId: string,
  tenantId: string
): Promise<boolean> {
  let currentId: string | null = candidateId;
  const visited = new Set<string>();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    if (currentId === ancestorId) return true;
    const row = await db.orgNode.findUnique({
      where: { id: currentId },
      select: { parentId: true, tenantId: true },
    });
    if (!row || row.tenantId !== tenantId) return false;
    currentId = row.parentId;
  }
  return false;
}
