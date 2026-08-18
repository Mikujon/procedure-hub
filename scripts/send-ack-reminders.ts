import { PrismaClient } from "@prisma/client";
import { notifyEvent } from "../src/lib/integrations/notify";

const prisma = new PrismaClient();

/**
 * Daily Read & Acknowledge escalation (Fase 4). For every open AckCampaign,
 * sends whichever reminder stage (DAY_3 / DAY_7 / DAY_14) is due and hasn't
 * already been sent — the (campaignId, stage) unique constraint on
 * AckReminder plus the existence check below is what makes this safe to
 * run more than once a day without double-sending.
 *
 * Manual for now (no scheduler wired up in this environment): `npx tsx scripts/send-ack-reminders.ts`.
 * Intended to run once daily via Vercel Cron / node-cron, same as the
 * still-unbuilt scripts/send-digests.ts (CLAUDE.md roadmap item 3).
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

async function main() {
  const campaigns = await prisma.ackCampaign.findMany({
    where: { completedAt: null },
    include: { reminders: true, procedure: { select: { id: true, title: true, tenantId: true, ownerId: true } } },
  });

  console.log(`Checking ${campaigns.length} open campaign(s).`);

  for (const campaign of campaigns) {
    const daysSinceStart = Math.floor((Date.now() - campaign.startedAt.getTime()) / MS_PER_DAY);
    const sentStages = new Set(campaign.reminders.map((r) => r.stage));

    const acknowledged = await prisma.acknowledgment.findMany({
      where: { procedureId: campaign.procedureId, versionNumber: campaign.versionNumber, userId: { in: campaign.targetUserIds } },
      select: { userId: true },
    });
    const ackedIds = new Set(acknowledged.map((a) => a.userId));
    const outstandingIds = campaign.targetUserIds.filter((id) => !ackedIds.has(id));

    if (outstandingIds.length === 0) continue; // maybeCompleteCampaign (lib/ack.ts) should have closed this already; skip defensively

    if (daysSinceStart >= 3 && !sentStages.has("DAY_3")) {
      await sendReminder(campaign, "DAY_3", outstandingIds, { externalChannels: false });
    }
    if (daysSinceStart >= 7 && !sentStages.has("DAY_7")) {
      await sendReminder(campaign, "DAY_7", outstandingIds, { externalChannels: true });
    }
    if (daysSinceStart >= 14 && !sentStages.has("DAY_14")) {
      await sendEscalation(campaign, outstandingIds);
    }
  }

  console.log("Done.");
}

async function sendReminder(
  campaign: { id: string; procedureId: string; versionNumber: number; procedure: { title: string; tenantId: string } },
  stage: "DAY_3" | "DAY_7",
  outstandingIds: string[],
  opts: { externalChannels: boolean }
) {
  await notifyEvent({
    tenantId: campaign.procedure.tenantId,
    type: "ACK_REQUIRED",
    procedureId: campaign.procedureId,
    title: `Promemoria: conferma la lettura di "${campaign.procedure.title}"`,
    body: "Non risulta ancora una tua conferma di lettura per questa procedura.",
    userIds: outstandingIds,
    ackVersionNumber: campaign.versionNumber,
    externalChannels: opts.externalChannels,
  });
  await prisma.ackReminder.create({ data: { campaignId: campaign.id, stage } });
  console.log(`  ${campaign.procedure.title}: ${stage} sent to ${outstandingIds.length} outstanding user(s).`);
}

/** DAY_14: escalates to each outstanding user's manager (fallback: the procedure owner), one grouped message per manager — not another nag to the same people. */
async function sendEscalation(
  campaign: {
    id: string;
    procedureId: string;
    procedure: { id: string; title: string; tenantId: string; ownerId: string | null };
  },
  outstandingIds: string[]
) {
  const users = await prisma.user.findMany({
    where: { id: { in: outstandingIds } },
    select: { id: true, name: true, managerId: true },
  });

  const groups = new Map<string, string[]>(); // managerId(or ownerId) -> outstanding user names
  for (const user of users) {
    const escalateTo = user.managerId ?? campaign.procedure.ownerId;
    if (!escalateTo) continue; // no manager and no owner set — nothing to escalate to
    const names = groups.get(escalateTo) ?? [];
    names.push(user.name);
    groups.set(escalateTo, names);
  }

  for (const [managerId, names] of groups) {
    await notifyEvent({
      tenantId: campaign.procedure.tenantId,
      type: "ACK_REQUIRED",
      procedureId: campaign.procedureId,
      title: `${names.length} persona/e del tuo team non ha/hanno ancora confermato la lettura di "${campaign.procedure.title}"`,
      body: names.join(", "),
      userIds: [managerId],
    });
  }

  await prisma.ackReminder.create({ data: { campaignId: campaign.id, stage: "DAY_14" } });
  console.log(`  ${campaign.procedure.title}: DAY_14 escalated to ${groups.size} manager/owner(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
