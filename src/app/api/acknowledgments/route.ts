import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordAcknowledgment } from "@/lib/ack";
import { canViewProcedure } from "@/lib/permissions";

const schema = z.object({ procedureId: z.string() });

/**
 * Records a "Read & Acknowledge" confirmation for the *current published
 * version* of a procedure. Idempotent per (procedure, user, versionNumber) —
 * re-acknowledging the same version is a no-op; a new version requires a
 * fresh acknowledgment, which is exactly the audit trail ISO/SOC2 reviewers
 * ask for ("did everyone confirm they read the version that was live?").
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Previously missing: no tenant scope at all, so a user could register an
  // acknowledgment against another tenant's procedure by id — see audit
  // finding #2. canViewProcedure below covers both the tenant check and
  // "can this user even see this procedure" in one call.
  const procedure = await prisma.procedure.findUnique({
    where: { id: parsed.data.procedureId },
    include: { currentVersion: true },
  });
  if (!procedure || procedure.tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const canView = await canViewProcedure({ id: userId, tenantId, globalRole }, procedure.id);
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!procedure.currentVersion) {
    return NextResponse.json({ error: "Procedure has no published version yet" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for") ?? undefined;

  const ack = await recordAcknowledgment(procedure.id, userId, procedure.currentVersion.versionNumber, ip);

  return NextResponse.json({ acknowledgment: ack });
}

/** Compliance view: who has/hasn't acknowledged the current version of a procedure. */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole as string;

  const { searchParams } = new URL(req.url);
  const procedureId = searchParams.get("procedureId");
  if (!procedureId) return NextResponse.json({ error: "procedureId required" }, { status: 400 });

  // Previously missing: no tenant scope, and no permission check beyond
  // "logged in" — anyone could pull the compliance roster (names, emails,
  // who hasn't confirmed) of another tenant's procedure. This mirrors the
  // canSeeAckDashboard rule already used in procedures/[id]/page.tsx.
  const procedure = await prisma.procedure.findUnique({
    where: { id: procedureId },
    include: { department: { include: { memberships: { include: { user: true } } } }, currentVersion: true },
  });
  if (!procedure || procedure.tenantId !== tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const canSeeAckDashboard =
    globalRole === "ADMIN" || globalRole === "COMPLIANCE_OFFICER" || procedure.ownerId === userId;
  if (!canSeeAckDashboard) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const versionNumber = procedure.currentVersion?.versionNumber ?? 1;

  const acknowledgments = await prisma.acknowledgment.findMany({
    where: { procedureId, versionNumber },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { acknowledgedAt: "asc" },
  });
  const ackUserIds = new Set(acknowledgments.map((a) => a.userId));

  // Prefer the AckCampaign's frozen audience (Fase 4) — it's the actual set
  // of people notified/obligated, which can be tenant-wide for a requiresAck
  // procedure, not just the department. Falls back to department membership
  // for procedures published before this feature existed.
  const campaign = await prisma.ackCampaign.findFirst({ where: { procedureId, versionNumber } });

  let outstanding;
  if (campaign) {
    const outstandingIds = campaign.targetUserIds.filter((id) => !ackUserIds.has(id));
    outstanding = await prisma.user.findMany({
      where: { id: { in: outstandingIds } },
      select: { id: true, name: true, email: true },
    });
  } else {
    outstanding = procedure.department.memberships.map((m) => m.user).filter((u) => !ackUserIds.has(u.id));
  }

  return NextResponse.json({
    acknowledged: acknowledgments,
    outstanding,
    campaign: campaign ? { startedAt: campaign.startedAt, completedAt: campaign.completedAt, targetCount: campaign.targetUserIds.length } : null,
  });
}
