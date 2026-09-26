// PATCH  /api/kb/admin/users/[id]  — update role / title / location / language / active
// DELETE /api/kb/admin/users/[id]  — soft delete (active = false)
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

  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, tenantId: true, email: true, role: true },
  });
  if (!user || user.tenantId !== tenantId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { role, title, location, language, active, avatarColor } = body ?? {};

  const data: Record<string, unknown> = {};
  if (typeof role === "string") data.role = role;
  if (typeof title === "string") data.title = title;
  if (typeof location === "string") data.location = location;
  if (typeof language === "string") data.language = language;
  if (typeof active === "boolean") data.active = active;
  if (typeof avatarColor === "string") data.avatarColor = avatarColor;

  const updated = await db.user.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      title: true,
      location: true,
      language: true,
      active: true,
      avatarColor: true,
    },
  });

  await db.auditLog.create({
    data: {
      tenantId,
      action: "UPDATE",
      entityType: "USER",
      entityId: id,
      summary: `Updated user ${user.email} — fields: ${Object.keys(data).join(", ") || "none"}`,
      userId: ctx.userId,
    },
  });

  return NextResponse.json({ user: updated });
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

  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, tenantId: true, email: true },
  });
  if (!user || user.tenantId !== tenantId)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Soft delete: deactivate. The row is preserved for audit history.
  await db.user.update({
    where: { id },
    data: { active: false },
  });

  await db.auditLog.create({
    data: {
      tenantId,
      action: "UPDATE",
      entityType: "USER",
      entityId: id,
      summary: `Deactivated user ${user.email}`,
      userId: ctx.userId,
    },
  });

  return NextResponse.json({ ok: true });
}
