import { PrismaClient, TemplateCategory } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seeds the 5 built-in page templates (Fase 5 Parte A) as global templates
 * (tenantId: null) — available to every tenant, not just "demo". Separate
 * from prisma/seed.ts (which is tenant-specific demo data) since these are
 * platform-level content, not sample data.
 *
 * Idempotent: upserts by (tenantId, name) via a manual find-then-update
 * since Template has no unique constraint on name alone (multiple tenants
 * could reasonably want their own custom template with the same name).
 */

type Node = {
  type:
    | "PARAGRAPH"
    | "HEADING_1"
    | "HEADING_2"
    | "HEADING_3"
    | "BULLETED_LIST_ITEM"
    | "NUMBERED_LIST_ITEM"
    | "CHECKLIST_ITEM"
    | "QUOTE"
    | "TABLE_SIMPLE";
  content: any;
  children?: Node[];
};

// A ProseMirror text node cannot be empty — `text: ""` is an invalid node,
// not an "empty paragraph". The block editor's own empty-block shape is
// `{ text: [] }` (see block-editor.tsx), so section placeholders here must
// match that instead of wrapping an empty string.
const textNodes = (text: string) => (text ? [{ type: "text", text }] : []);

const h1 = (text: string): Node => ({ type: "HEADING_1", content: { text: textNodes(text) } });
const h2 = (text: string): Node => ({ type: "HEADING_2", content: { text: textNodes(text) } });
const p = (text: string): Node => ({ type: "PARAGRAPH", content: { text: textNodes(text) } });
const bullet = (text: string): Node => ({ type: "BULLETED_LIST_ITEM", content: { text: textNodes(text) } });
const check = (text: string): Node => ({ type: "CHECKLIST_ITEM", content: { text: textNodes(text), checked: false } });
const table = (rows: string[][]): Node => ({ type: "TABLE_SIMPLE", content: { rows } });

const TEMPLATES: {
  name: string;
  category: TemplateCategory;
  description: string;
  icon: string;
  blockTemplate: Node[];
}[] = [
  {
    name: "PRD",
    category: "PRD",
    icon: "📋",
    description: "Product Requirements Document: problema, obiettivi, requisiti, metriche.",
    blockTemplate: [
      h1("PRD"),
      h2("Problema"),
      p(""),
      h2("Obiettivi"),
      bullet(""),
      h2("Non obiettivi"),
      bullet(""),
      h2("Utenti target"),
      p(""),
      h2("User Stories"),
      bullet("Come [ruolo], voglio [azione], affinché [beneficio]."),
      h2("Requisiti Funzionali"),
      table([["ID", "Descrizione", "Priorità"], ["", "", ""]]),
      h2("Requisiti Non Funzionali"),
      bullet(""),
      h2("Metriche di Successo"),
      bullet(""),
      h2("Rischi"),
      bullet(""),
      h2("Timeline"),
      p(""),
    ],
  },
  {
    name: "Analisi Funzionale",
    category: "FUNCTIONAL_ANALYSIS",
    icon: "🔍",
    description: "Contesto, attori, casi d'uso, regole di business, tracciabilità.",
    blockTemplate: [
      h1("Analisi Funzionale"),
      h2("Contesto"),
      p(""),
      h2("Attori"),
      bullet(""),
      h2("Casi d'Uso"),
      table([["Caso d'uso", "Precondizioni", "Flusso", "Postcondizioni"], ["", "", "", ""]]),
      h2("Regole di Business"),
      bullet(""),
      h2("Matrice di Tracciabilità"),
      table([["Requisito", "Test"], ["", ""]]),
    ],
  },
  {
    name: "User Story",
    category: "USER_STORY",
    icon: "🎯",
    description: "Come... voglio... affinché..., con criteri di accettazione.",
    blockTemplate: [
      h1("User Story"),
      p("Come [ruolo], voglio [azione], affinché [beneficio]."),
      h2("Criteri di Accettazione"),
      check(""),
      check(""),
      check(""),
    ],
  },
  {
    name: "RFC / ADR",
    category: "TECH_SPEC_RFC",
    icon: "🏗️",
    description: "Contesto, alternative considerate, decisione, conseguenze.",
    blockTemplate: [
      h1("RFC / ADR"),
      h2("Contesto"),
      p(""),
      h2("Alternative Considerate"),
      table([["Alternativa", "Pro", "Contro"], ["", "", ""]]),
      h2("Decisione"),
      p(""),
      h2("Conseguenze"),
      p(""),
    ],
  },
  {
    name: "Meeting Notes",
    category: "MEETING_NOTES",
    icon: "🗒️",
    description: "Partecipanti, agenda, decisioni prese, action item.",
    blockTemplate: [
      h1("Meeting Notes"),
      h2("Partecipanti"),
      bullet(""),
      h2("Agenda"),
      bullet(""),
      h2("Decisioni Prese"),
      bullet(""),
      h2("Action Item"),
      check(""),
      check(""),
    ],
  },
];

async function main() {
  console.log("Seeding built-in page templates...");

  for (const t of TEMPLATES) {
    const existing = await prisma.template.findFirst({ where: { tenantId: null, name: t.name } });
    if (existing) {
      await prisma.template.update({
        where: { id: existing.id },
        data: { description: t.description, icon: t.icon, category: t.category, blockTemplate: t.blockTemplate },
      });
      console.log(`  updated: ${t.name}`);
    } else {
      await prisma.template.create({
        data: {
          tenantId: null,
          name: t.name,
          description: t.description,
          icon: t.icon,
          category: t.category,
          blockTemplate: t.blockTemplate,
        },
      });
      console.log(`  created: ${t.name}`);
    }
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
