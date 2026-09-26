import { PrismaClient } from "@prisma/client";
import { ensureDefaultAutomationRules } from "../src/lib/automations/defaults";

const prisma = new PrismaClient();

/**
 * Backfill/ensure script for the four default automation rules that
 * replace lib/review-reminders.ts and scripts/send-ack-reminders.ts (see
 * lib/automations/defaults.ts's own comment for the full "why"). Run once
 * per environment after this migration deploys, and safe to re-run any
 * time — idempotent per tenant, and harmless to run again after
 * provisioning a new tenant by hand (there's no self-service tenant
 * creation flow in this app yet to hook automatically).
 *
 * Manual: `npx tsx scripts/ensure-default-automations.ts` (optionally
 * `-- --tenant=<slug>` to scope to one tenant, matching scripts/reindex.ts's
 * own convention).
 */
async function main() {
  const tenantSlugArg = process.argv.find((a) => a.startsWith("--tenant="))?.split("=")[1];

  const tenants = await prisma.tenant.findMany({
    where: tenantSlugArg ? { slug: tenantSlugArg } : undefined,
    select: { id: true, slug: true },
  });
  console.log(`Checking ${tenants.length} tenant(s).`);

  for (const tenant of tenants) {
    const { created } = await ensureDefaultAutomationRules(tenant.id);
    if (created.length === 0) {
      console.log(`  ${tenant.slug}: already has all default rules.`);
    } else {
      console.log(`  ${tenant.slug}: created ${created.length} rule(s) — ${created.join(", ")}`);
    }
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
