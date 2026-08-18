import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CHANNEL_LABEL: Record<string, string> = {
  IN_APP: "In-app",
  EMAIL: "Email",
  SLACK: "Slack",
  GOOGLE_CHAT: "Google Chat",
};

/** Generates the Read & Acknowledge compliance certificate for a fully-completed campaign — see New plan/04-read-ack-escalation.md. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string;
  const tenantId = (session.user as any).tenantId as string;
  const globalRole = (session.user as any).globalRole;

  const procedure = await prisma.procedure.findFirst({
    where: { id: params.id, tenantId },
    include: { currentVersion: { select: { versionNumber: true } }, department: true },
  });
  if (!procedure) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Must match canSeeAckDashboard in procedures/[id]/page.tsx exactly — that's
  // what decides whether the "Certificato" link is even shown. It checks
  // Procedure.ownerId, not department publish rights, so an owner who's only
  // an EDITOR in their department (not DEPARTMENT_OWNER) still gets the PDF
  // instead of a 403 on a link they were shown.
  const allowed = globalRole === "ADMIN" || globalRole === "COMPLIANCE_OFFICER" || procedure.ownerId === userId;
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!procedure.currentVersion) {
    return NextResponse.json({ error: "Procedure has no published version" }, { status: 400 });
  }

  const campaign = await prisma.ackCampaign.findFirst({
    where: { procedureId: procedure.id, versionNumber: procedure.currentVersion.versionNumber },
  });
  if (!campaign) return NextResponse.json({ error: "No Read & Acknowledge campaign for this version" }, { status: 400 });
  if (!campaign.completedAt) {
    return NextResponse.json({ error: "Campaign not yet at 100% completion" }, { status: 400 });
  }

  const acknowledgments = await prisma.acknowledgment.findMany({
    where: { procedureId: procedure.id, versionNumber: campaign.versionNumber, userId: { in: campaign.targetUserIds } },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { acknowledgedAt: "asc" },
  });

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { height } = page.getSize();
  let y = height - 60;

  const draw = (text: string, opts: { size?: number; f?: typeof font; color?: [number, number, number] } = {}) => {
    page.drawText(text, {
      x: 50,
      y,
      size: opts.size ?? 10,
      font: opts.f ?? font,
      color: rgb(...(opts.color ?? [0.08, 0.1, 0.18])),
    });
    y -= (opts.size ?? 10) + 8;
  };

  draw("Certificato di Conformità — Read & Acknowledge", { size: 16, f: bold });
  y -= 6;
  draw(`Procedura: ${procedure.title} (${procedure.code})`, { size: 11, f: bold });
  draw(`Dipartimento: ${procedure.department.name}`);
  draw(`Versione: v${campaign.versionNumber}`);
  draw(`Campagna avviata: ${campaign.startedAt.toLocaleString("it-IT")}`);
  draw(`Completata al 100%: ${campaign.completedAt.toLocaleString("it-IT")}`, { color: [0.24, 0.48, 0.31] });
  draw(`Platea obbligata: ${campaign.targetUserIds.length} persone`);
  y -= 10;

  draw("Nominativo", { f: bold, size: 10 });
  page.drawText("Email", { x: 220, y: y + 18, size: 10, font: bold });
  page.drawText("Canale", { x: 400, y: y + 18, size: 10, font: bold });
  page.drawText("Data conferma", { x: 460, y: y + 18, size: 10, font: bold });
  y -= 6;
  page.drawLine({ start: { x: 50, y: y + 10 }, end: { x: 545, y: y + 10 }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
  y -= 6;

  for (const ack of acknowledgments) {
    if (y < 60) {
      y = height - 60;
      pdf.addPage([595.28, 841.89]);
    }
    const row = pdf.getPage(pdf.getPageCount() - 1);
    row.drawText(ack.user.name, { x: 50, y, size: 9, font });
    row.drawText(ack.user.email, { x: 220, y, size: 9, font });
    row.drawText(CHANNEL_LABEL[ack.channel] ?? ack.channel, { x: 400, y, size: 9, font });
    row.drawText(ack.acknowledgedAt.toLocaleDateString("it-IT"), { x: 460, y, size: 9, font });
    y -= 16;
  }

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificato-ack-${procedure.code}-v${campaign.versionNumber}.pdf"`,
    },
  });
}
