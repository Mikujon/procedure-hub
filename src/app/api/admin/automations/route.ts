import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isTenantAdmin } from "@/lib/permissions";
import { createAutomationRuleSchema, parseTriggerConfig, parseActionConfig } from "@/lib/automations/types";

/** Admin-only. Creating/editing a standing rule that acts unattended tenant-wide is the same authority tier as connecting Slack or provisioning users — see the redesign/automations plan for why this isn't scoped to COMPLIANCE_OFFICER too. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;
  if (!isTenantAdmin({ id: userId, tenantId, globalRole })) {
    return NextResponse.json({ error: "Solo un amministratore può gestire le automazioni." }, { status: 403 });
  }

  const rules = await prisma.automationRule.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true, email: true } }, _count: { select: { runs: true } } },
  });
  return NextResponse.json({ rules });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;
  if (!isTenantAdmin({ id: userId, tenantId, globalRole })) {
    return NextResponse.json({ error: "Solo un amministratore può gestire le automazioni." }, { status: 403 });
  }

  const parsed = createAutomationRuleSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const data = parsed.data;

  let triggerConfig: unknown;
  let actionConfig: unknown;
  try {
    triggerConfig = parseTriggerConfig(data.triggerType, data.triggerConfig);
    actionConfig = parseActionConfig(data.actionType, data.actionConfig);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Configurazione non valida." }, { status: 400 });
  }

  const rule = await prisma.automationRule.create({
    data: {
      tenantId,
      name: data.name,
      description: data.description,
      isEnabled: data.isEnabled ?? true,
      triggerType: data.triggerType,
      triggerConfig: triggerConfig as any,
      conditions: data.conditions ?? undefined,
      actionType: data.actionType,
      actionConfig: actionConfig as any,
      createdById: userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      tenantId,
      actorId: userId,
      action: "CREATE",
      entityType: "AutomationRule",
      entityId: rule.id,
      metadata: { name: rule.name, triggerType: rule.triggerType, actionType: rule.actionType },
    },
  });

  return NextResponse.json({ rule });
}
