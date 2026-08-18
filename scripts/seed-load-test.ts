import { PrismaClient } from "@prisma/client";
import { indexProcedure, buildSearchDocument, stripHtml } from "../src/lib/search";

const prisma = new PrismaClient();

/**
 * One-off, not part of `npm run db:seed`: generates procedures at a density
 * closer to a real 200-user rollout (prisma/seed.ts leaves exactly one),
 * so search/dashboard/department-list performance can be measured against
 * something other than a near-empty demo tenant. Run with
 * `npx tsx scripts/seed-load-test.ts`, safe to re-run (skips departments
 * that already have >= TARGET_PER_DEPARTMENT procedures).
 */
const TARGET_PER_DEPARTMENT = 15;

const TOPICS = [
  "Onboarding nuovo dipendente", "Gestione ferie e permessi", "Valutazione performance annuale",
  "Processo di offboarding", "Gestione segnalazioni interne", "Politica smart working",
  "Richiesta accesso ai dati (DSAR)", "Gestione data breach", "Audit interno periodico",
  "Gestione fornitori terzi", "Backup e disaster recovery", "Gestione incidenti di sicurezza",
  "Approvazione spese", "Chiusura contabile mensile", "Gestione fatture fornitori",
  "Pianificazione turni", "Gestione straordinari", "Reclutamento e selezione",
  "Formazione obbligatoria", "Gestione non conformità", "Controllo qualità prodotto",
  "Gestione reclami cliente", "Pubblicazione contenuti social", "Approvazione materiale marketing",
  "Gestione asset IT", "Provisioning accessi", "Gestione sedi e spazi",
  "Manutenzione ordinaria", "Gestione visitatori", "Procedura di emergenza incendio",
];

function pick<T>(arr: T[], n: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "demo" } });
  if (!tenant) throw new Error('Tenant "demo" not found — run npm run db:seed first.');

  const admin = await prisma.user.findFirstOrThrow({ where: { tenantId: tenant.id, globalRole: "ADMIN" } });
  const departments = await prisma.department.findMany({ where: { tenantId: tenant.id } });
  const tags = await prisma.tag.findMany({ where: { tenantId: tenant.id } });

  let created = 0;
  for (const dept of departments) {
    const existingCount = await prisma.procedure.count({ where: { tenantId: tenant.id, departmentId: dept.id } });
    const toCreate = TARGET_PER_DEPARTMENT - existingCount;
    if (toCreate <= 0) {
      console.log(`${dept.name}: already has ${existingCount}, skipping.`);
      continue;
    }

    const prefix = dept.slug.slice(0, 3).toUpperCase();
    for (let i = 0; i < toCreate; i++) {
      const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
      const code = `${prefix}-PRO-${String(existingCount + i + 1).padStart(3, "0")}`;
      const title = `${topic} — ${dept.name}`;
      const isCritical = Math.random() < 0.15;

      const procedure = await prisma.procedure.create({
        data: {
          tenantId: tenant.id,
          departmentId: dept.id,
          code,
          title,
          summary: `Procedura operativa: ${topic.toLowerCase()}, ambito ${dept.name}.`,
          type: "PROCEDURE",
          status: "PUBLISHED",
          requiresAck: isCritical,
          isCritical,
          visibility: "PUBLIC",
          authorId: admin.id,
          ownerId: admin.id,
          publishedAt: new Date(),
          reviewDate: new Date(),
          nextReviewDate: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000),
          tags: tags.length ? { create: pick(tags, 1 + Math.floor(Math.random() * 2)).map((t) => ({ tagId: t.id })) } : undefined,
        },
      });

      const contentHtml = `<h2>Scopo</h2><p>Questa procedura definisce le modalità operative per: ${topic.toLowerCase()}.</p><h2>Passaggi</h2><ol><li>Passo 1</li><li>Passo 2</li><li>Passo 3</li></ol>`;
      const version = await prisma.procedureVersion.create({
        data: {
          procedureId: procedure.id,
          versionNumber: 1,
          contentJson: {},
          contentHtml,
          authorId: admin.id,
          changelog: "Versione generata per test di carico",
        },
      });
      await prisma.procedure.update({ where: { id: procedure.id }, data: { currentVersionId: version.id } });

      const full = await prisma.procedure.findUniqueOrThrow({
        where: { id: procedure.id },
        include: { department: true, tags: { include: { tag: true } } },
      });
      await indexProcedure(buildSearchDocument(full as any, stripHtml(contentHtml)), tenant.id);

      created++;
    }
    console.log(`${dept.name}: created ${toCreate}.`);
  }

  const total = await prisma.procedure.count({ where: { tenantId: tenant.id } });
  console.log(`Done. Created ${created} procedures this run, ${total} total in tenant "demo".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
