import { PrismaClient } from "@prisma/client";
import { ensureTenantIndex, indexProcedure, buildSearchDocument, stripHtml } from "../src/lib/search";

const prisma = new PrismaClient();

/**
 * Backfill script for the search index (Fase 5a — roadmap item mentioned in
 * docs/ARCHITECTURE.md, never written). Indexes every PUBLISHED procedure
 * per tenant. Safe to re-run: indexProcedure() upserts by procedure id, so
 * running this twice just re-writes the same documents, no duplicates.
 * Manual: `npx tsx scripts/reindex.ts` (optionally `-- --tenant=<slug>` to
 * scope to one tenant).
 */
async function main() {
  const tenantSlugArg = process.argv.find((a) => a.startsWith("--tenant="))?.split("=")[1];

  const tenants = await prisma.tenant.findMany({
    where: tenantSlugArg ? { slug: tenantSlugArg } : undefined,
    select: { id: true, slug: true },
  });
  console.log(`Reindexing ${tenants.length} tenant(s).`);

  for (const tenant of tenants) {
    await ensureTenantIndex(tenant.id);

    const procedures = await prisma.procedure.findMany({
      where: { tenantId: tenant.id, status: "PUBLISHED" },
      include: {
        department: true,
        tags: { include: { tag: true } },
        currentVersion: { select: { contentHtml: true } },
      },
    });

    for (const procedure of procedures) {
      const contentText = stripHtml(procedure.currentVersion?.contentHtml ?? "");
      await indexProcedure(buildSearchDocument(procedure, contentText), tenant.id);
    }

    console.log(`  ${tenant.slug}: indexed ${procedures.length} published procedures`);
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
