// GET  /api/kb/admin/org-nodes  — full org tree, nested JSON
// POST /api/kb/admin/org-nodes  — create a node (type, name, code, parentId)
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTenantContext } from "@/lib/session";

export const dynamic = "force-dynamic";

type OrgNodeWithChildren = {
  id: string;
  type: string;
  name: string;
  code: string | null;
  parentId: string | null;
  sortOrder: number;
  children: OrgNodeWithChildren[];
};

export async function GET() {
  const ctx = await getTenantContext();
  if (!ctx || ctx.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { tenantId } = ctx;

  const nodes = await db.orgNode.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      type: true,
      name: true,
      code: true,
      parentId: true,
      sortOrder: true,
    },
  });

  const byId = new Map<string, OrgNodeWithChildren>(
    nodes.map((n) => [
      n.id,
      {
        id: n.id,
        type: n.type,
        name: n.name,
        code: n.code,
        parentId: n.parentId,
        sortOrder: n.sortOrder,
        children: [],
      },
    ])
  );

  const roots: OrgNodeWithChildren[] = [];
  for (const n of nodes) {
    const node = byId.get(n.id)!;
    if (n.parentId && byId.has(n.parentId)) {
      byId.get(n.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return NextResponse.json({ tree: roots });
}

export async function POST(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx || ctx.role !== "ADMIN")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { tenantId } = ctx;

  const body = await req.json().catch(() => ({}));
  const { type, name, code, parentId, sortOrder } = body ?? {};

  if (!type || !name)
    return NextResponse.json(
      { error: "type and name are required" },
      { status: 400 }
    );

  // validate code uniqueness within tenant if provided
  if (code) {
    const existing = await db.orgNode.findUnique({
      where: { tenantId_code: { tenantId, code: String(code) } },
      select: { id: true },
    });
    if (existing)
      return NextResponse.json(
        { error: "Code already in use within this tenant" },
        { status: 409 }
      );
  }

  // validate parent belongs to same tenant
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
  }

  const node = await db.orgNode.create({
    data: {
      tenantId,
      type: String(type),
      name: String(name),
      code: code ? String(code) : null,
      parentId: parentId ? String(parentId) : null,
      sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
    },
  });

  await db.auditLog.create({
    data: {
      tenantId,
      action: "CREATE",
      entityType: "ORG_NODE",
      entityId: node.id,
      summary: `Created org node "${node.name}" (${node.type}${node.code ? ` · ${node.code}` : ""})`,
      userId: ctx.userId,
    },
  });

  return NextResponse.json({ node }, { status: 201 });
}
