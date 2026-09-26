import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isTenantAdmin } from "@/lib/permissions";

const updateSchema = z.object({
  isEnabled: z.boolean().optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
});

async function requireAdmin(tenantId: string, globalRole: string, userId: string) {
  return isTenantAdmin({ id: userId, tenantId, globalRole: globalRole as any });
}

/** Admin-only. Currently only toggling isEnabled / renaming — editing trigger/condition/action re-runs the same validation as creation, not built in this pass; delete + recreate covers it for now. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;
  if (!(await requireAdmin(tenantId, globalRole, userId))) {
    return NextResponse.json({ error: "Solo un amministratore può gestire le automazioni." }, { status: 403 });
  }

  const existing = await prisma.automationRule.findUnique({ where: { id: params.id } });
  if (!existing || existing.tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const rule = await prisma.automationRule.update({ where: { id: params.id }, data: parsed.data });

  await prisma.auditLog.create({
    data: {
      tenantId,
      actorId: userId,
      action: "UPDATE",
      entityType: "AutomationRule",
      entityId: rule.id,
      metadata: parsed.data,
    },
  });

  // This route never touches actionConfig itself (see the schema above),
  // but Prisma's update() still returns the full row — mask the same
  // SEND_WEBHOOK secret the list route does, see its comment for why.
  const actionConfig = rule.actionConfig as Record<string, any>;
  const sanitizedRule =
    rule.actionType === "SEND_WEBHOOK" && actionConfig?.authHeader
      ? { ...rule, actionConfig: { ...actionConfig, authHeader: "••••••••" } }
      : rule;

  return NextResponse.json({ rule: sanitizedRule });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;
  if (!(await requireAdmin(tenantId, globalRole, userId))) {
    return NextResponse.json({ error: "Solo un amministratore può gestire le automazioni." }, { status: 403 });
  }

  const existing = await prisma.automationRule.findUnique({ where: { id: params.id } });
  if (!existing || existing.tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.automationRule.delete({ where: { id: params.id } });

  await prisma.auditLog.create({
    data: {
      tenantId,
      actorId: userId,
      action: "DELETE",
      entityType: "AutomationRule",
      entityId: params.id,
      metadata: { name: existing.name },
    },
  });

  return NextResponse.json({ success: true });
}
