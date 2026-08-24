import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Seeds one demo tenant ("demo") with the department structure, tags, and
 * roles called out in the functional requirements doc, plus a handful of
 * users covering every role so the RBAC and workflow logic can be exercised
 * immediately after `npm run db:seed`.
 *
 * Login after seeding: tenant "demo", any user below, password "password123".
 */

const DEPARTMENTS = [
  { name: "HR", description: "Risorse umane, onboarding, gestione del personale" },
  { name: "Operations", description: "Processi operativi e customer service" },
  { name: "Recruitment", description: "Selezione e acquisizione talenti" },
  { name: "Training", description: "Formazione e sviluppo competenze" },
  { name: "Quality", description: "Controllo qualità e miglioramento continuo" },
  { name: "IT", description: "Infrastruttura, sicurezza, supporto tecnico" },
  { name: "Legal & Compliance", description: "GDPR, contratti, audit normativi" },
  { name: "Finance", description: "Amministrazione, contabilità, budget" },
  { name: "WFM", description: "Workforce management e pianificazione" },
  { name: "Marketing", description: "Comunicazione e brand" },
  { name: "Facilities", description: "Gestione sedi e infrastrutture fisiche" },
];

const TAGS = ["GDPR", "ISO27001", "ISO9001", "SOC2", "Klarna", "HR", "Finance", "Critical Process", "Mandatory", "Policy", "Procedure", "Template"];

async function main() {
  console.log("Seeding tenant...");

  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      slug: "demo",
      name: "Fiber Demo",
      plan: "STANDARD",
      maxUsers: 200,
    },
  });

  const passwordHash = await bcrypt.hash("password123", 10);

  const admin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "admin@demo.com" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "admin@demo.com",
      name: "Alessia Admin",
      passwordHash,
      globalRole: "ADMIN",
    },
  });

  const compliance = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "compliance@demo.com" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "compliance@demo.com",
      name: "Carlo Compliance",
      passwordHash,
      globalRole: "COMPLIANCE_OFFICER",
    },
  });

  const editor = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "editor@demo.com" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "editor@demo.com",
      name: "Elena Editor",
      passwordHash,
      globalRole: "USER",
    },
  });

  const viewer = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: "viewer@demo.com" } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: "viewer@demo.com",
      name: "Vittorio Viewer",
      passwordHash,
      globalRole: "USER",
    },
  });

  console.log("Seeding departments...");
  const departments = [];
  for (let i = 0; i < DEPARTMENTS.length; i++) {
    const d = DEPARTMENTS[i];
    const dept = await prisma.department.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: d.name,
        slug: d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        description: d.description,
        sortOrder: i,
      },
    });
    departments.push(dept);
  }

  const hr = departments.find((d) => d.name === "HR")!;
  const legal = departments.find((d) => d.name === "Legal & Compliance")!;

  console.log("Seeding memberships...");
  await prisma.departmentMembership.upsert({
    where: { userId_departmentId: { userId: editor.id, departmentId: hr.id } },
    update: {},
    create: { userId: editor.id, departmentId: hr.id, role: "DEPARTMENT_OWNER" },
  });
  await prisma.departmentMembership.upsert({
    where: { userId_departmentId: { userId: viewer.id, departmentId: hr.id } },
    update: {},
    create: { userId: viewer.id, departmentId: hr.id, role: "VIEWER" },
  });
  await prisma.departmentMembership.upsert({
    where: { userId_departmentId: { userId: editor.id, departmentId: legal.id } },
    update: {},
    create: { userId: editor.id, departmentId: legal.id, role: "EDITOR" },
  });

  console.log("Seeding tags...");
  const tags = [];
  for (const name of TAGS) {
    const tag = await prisma.tag.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: {},
      create: { tenantId: tenant.id, name },
    });
    tags.push(tag);
  }

  console.log("Seeding a sample published procedure...");
  const gdprTag = tags.find((t) => t.name === "GDPR")!;
  const mandatoryTag = tags.find((t) => t.name === "Mandatory")!;

  const existing = await prisma.procedure.findUnique({
    where: { tenantId_code: { tenantId: tenant.id, code: "LEG-PRO-001" } },
  });

  if (!existing) {
    const contentHtml = `
      <h2>Scopo</h2>
      <p>Questa procedura definisce le modalità di gestione di una richiesta di accesso ai dati personali (Data Subject Access Request) ai sensi del GDPR.</p>
      <h2>Ambito di applicazione</h2>
      <p>Si applica a tutte le richieste ricevute da clienti, dipendenti o terze parti riguardo al trattamento dei loro dati personali.</p>
      <h2>Passaggi operativi</h2>
      <ol>
        <li>Registrare la richiesta nel sistema DPO entro 24 ore dalla ricezione.</li>
        <li>Verificare l'identità del richiedente.</li>
        <li>Raccogliere i dati pertinenti dai sistemi coinvolti.</li>
        <li>Preparare la risposta formale entro 30 giorni di calendario.</li>
        <li>Ottenere approvazione del Data Protection Officer prima dell'invio.</li>
      </ol>
    `;

    // A real ProseMirror doc mirroring contentHtml above, not just {} — a
    // {} here silently defeats every Block-recreation path that reads
    // ProcedureVersion.contentJson (GET /api/procedures/[id]/blocks' lazy
    // backfill, POST .../duplicate's own backfill, scripts/migrate-to-blocks.ts):
    // opening this procedure in the block editor, or duplicating it, produced
    // zero blocks despite contentHtml rendering fine — found verifying the
    // reading-outline/TOC-block feature live, not a hypothetical.
    const orderedListItem = (text: string) => ({
      type: "listItem",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    });
    const contentJson = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Scopo" }] },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Questa procedura definisce le modalità di gestione di una richiesta di accesso ai dati personali (Data Subject Access Request) ai sensi del GDPR.",
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Ambito di applicazione" }] },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Si applica a tutte le richieste ricevute da clienti, dipendenti o terze parti riguardo al trattamento dei loro dati personali.",
            },
          ],
        },
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Passaggi operativi" }] },
        {
          type: "orderedList",
          content: [
            orderedListItem("Registrare la richiesta nel sistema DPO entro 24 ore dalla ricezione."),
            orderedListItem("Verificare l'identità del richiedente."),
            orderedListItem("Raccogliere i dati pertinenti dai sistemi coinvolti."),
            orderedListItem("Preparare la risposta formale entro 30 giorni di calendario."),
            orderedListItem("Ottenere approvazione del Data Protection Officer prima dell'invio."),
          ],
        },
      ],
    };

    const procedure = await prisma.procedure.create({
      data: {
        tenantId: tenant.id,
        departmentId: legal.id,
        code: "LEG-PRO-001",
        title: "Gestione delle richieste di accesso ai dati (GDPR DSAR)",
        summary: "Procedura per la gestione delle richieste di accesso ai dati personali ai sensi del GDPR.",
        type: "PROCEDURE",
        status: "PUBLISHED",
        requiresAck: true,
        isCritical: true,
        visibility: "PUBLIC",
        authorId: admin.id,
        ownerId: compliance.id,
        publishedAt: new Date(),
        reviewDate: new Date(),
        nextReviewDate: new Date(Date.now() + 300 * 24 * 60 * 60 * 1000),
        tags: { create: [{ tagId: gdprTag.id }, { tagId: mandatoryTag.id }] },
      },
    });

    const version = await prisma.procedureVersion.create({
      data: {
        procedureId: procedure.id,
        versionNumber: 1,
        contentJson,
        contentHtml,
        authorId: admin.id,
        changelog: "Versione iniziale pubblicata",
      },
    });

    await prisma.procedure.update({ where: { id: procedure.id }, data: { currentVersionId: version.id } });
  }

  console.log("Seeding sample announcement...");
  await prisma.announcement.create({
    data: {
      tenantId: tenant.id,
      title: "Benvenuti su Procedure Hub",
      body: "La nuova piattaforma di gestione documentale aziendale è online. Esplora i dipartimenti nella sidebar per iniziare.",
      isPinned: true,
    },
  });

  console.log("Done. Login with tenant 'demo' and password 'password123':");
  console.log("  admin@demo.com        (ADMIN)");
  console.log("  compliance@demo.com   (COMPLIANCE_OFFICER)");
  console.log("  editor@demo.com       (DEPARTMENT_OWNER on HR, EDITOR on Legal)");
  console.log("  viewer@demo.com       (VIEWER on HR)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
