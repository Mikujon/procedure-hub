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
  // --- Template per procedure aziendali (2.2, 20 ago 2026) — dominio del
  // prodotto (ISO/GDPR/SOC2, ~200 dipendenti), non sviluppo prodotto come i
  // 5 sopra. Tutti "CUSTOM": TemplateCategory non guida oggi né filtri né
  // raggruppamenti in UI (verificato in template-picker-dialog.tsx e
  // api/templates/route.ts — solo `not: null`), quindi non vale una
  // migration per aggiungere valori enum mai letti da nessun componente.
  {
    name: "Onboarding Nuovo Dipendente",
    category: "CUSTOM",
    icon: "🧑‍💻",
    description: "Checklist primo giorno, prima settimana, primo mese per un nuovo assunto.",
    blockTemplate: [
      h1("Onboarding — [Nome dipendente]"),
      h2("Informazioni Generali"),
      bullet("Ruolo:"),
      bullet("Dipartimento:"),
      bullet("Data di inizio:"),
      bullet("Manager di riferimento:"),
      h2("Checklist Primo Giorno"),
      check("Badge e accessi fisici assegnati"),
      check("Postazione di lavoro pronta"),
      check("Account IT creati (email, VPN, tool interni)"),
      check("Presentazione al team"),
      h2("Checklist Prima Settimana"),
      check("Formazione su policy aziendali obbligatorie"),
      check("Formazione sui tool interni"),
      check("Incontro 1:1 con il manager"),
      h2("Checklist Primo Mese"),
      check("Obiettivi 30/60/90 giorni definiti"),
      check("Feedback intermedio raccolto"),
      h2("Materiali di Riferimento"),
      bullet(""),
    ],
  },
  {
    name: "Checklist Audit Interno",
    category: "CUSTOM",
    icon: "🕵️",
    description: "Ambito, team, elenco di verifica, non conformità e piano d'azione di un audit.",
    blockTemplate: [
      h1("Checklist Audit Interno"),
      h2("Ambito e Obiettivo"),
      p(""),
      h2("Standard di Riferimento"),
      bullet("Es. ISO 27001 / ISO 9001 / SOC2"),
      h2("Team di Audit"),
      table([["Nome", "Ruolo"], ["", ""]]),
      h2("Elenco di Verifica"),
      table([["Area", "Requisito", "Conforme", "Note"], ["", "", "", ""]]),
      h2("Non Conformità Rilevate"),
      bullet(""),
      h2("Piano di Azione"),
      table([["Azione", "Responsabile", "Scadenza"], ["", "", ""]]),
      h2("Conclusioni"),
      p(""),
    ],
  },
  {
    name: "Verbale Riunione Compliance",
    category: "CUSTOM",
    icon: "⚖️",
    description: "Partecipanti, rischi di compliance discussi, decisioni e action item.",
    blockTemplate: [
      h1("Verbale Riunione Compliance"),
      h2("Data e Partecipanti"),
      bullet(""),
      h2("Ordine del Giorno"),
      bullet(""),
      h2("Argomenti Discussi"),
      p(""),
      h2("Decisioni Prese"),
      bullet(""),
      h2("Rischi di Compliance Identificati"),
      table([["Rischio", "Impatto", "Owner"], ["", "", ""]]),
      h2("Action Item"),
      check(""),
      check(""),
      h2("Prossima Riunione"),
      p(""),
    ],
  },
  {
    name: "Piano di Formazione",
    category: "CUSTOM",
    icon: "🎓",
    description: "Obiettivi, programma, registro presenze e valutazione di un percorso formativo.",
    blockTemplate: [
      h1("Piano di Formazione"),
      h2("Obiettivi Formativi"),
      bullet(""),
      h2("Destinatari"),
      p(""),
      h2("Programma"),
      table([["Modulo", "Durata", "Formatore", "Data"], ["", "", "", ""]]),
      h2("Modalità di Verifica"),
      p(""),
      h2("Registro Presenze"),
      table([["Nome", "Presente", "Firma"], ["", "", ""]]),
      h2("Valutazione Efficacia"),
      p(""),
    ],
  },
  {
    name: "Registro Non Conformità",
    category: "CUSTOM",
    icon: "⚠️",
    description: "Descrizione, causa radice, azioni correttive/preventive e chiusura di una non conformità (CAPA).",
    blockTemplate: [
      h1("Registro Non Conformità"),
      h2("Descrizione"),
      p(""),
      h2("Origine"),
      bullet("Es. Audit interno / Reclamo cliente / Segnalazione dipendente / Ispezione"),
      h2("Analisi delle Cause (Root Cause)"),
      p(""),
      h2("Azione Correttiva"),
      table([["Azione", "Responsabile", "Scadenza", "Stato"], ["", "", "", ""]]),
      h2("Azione Preventiva"),
      table([["Azione", "Responsabile", "Scadenza", "Stato"], ["", "", "", ""]]),
      h2("Verifica di Efficacia"),
      p(""),
      h2("Chiusura"),
      check("Approvato dal Compliance Officer"),
    ],
  },
  {
    name: "Segnalazione Incidente",
    category: "CUSTOM",
    icon: "🚨",
    description: "Descrizione, impatto, azioni immediate e misure correttive per un incidente.",
    blockTemplate: [
      h1("Segnalazione Incidente"),
      h2("Data e Ora"),
      p(""),
      h2("Descrizione dell'Incidente"),
      p(""),
      h2("Persone Coinvolte"),
      bullet(""),
      h2("Impatto (Basso / Medio / Alto / Critico)"),
      p(""),
      h2("Azioni Immediate Intraprese"),
      bullet(""),
      h2("Causa Radice"),
      p(""),
      h2("Misure Correttive"),
      table([["Azione", "Responsabile", "Scadenza"], ["", "", ""]]),
      h2("Notifiche Effettuate"),
      check("DPO informato"),
      check("Management informato"),
      check("Autorità competente informata (se richiesto)"),
    ],
  },
  {
    name: "Richiesta di Modifica (Change Request)",
    category: "CUSTOM",
    icon: "🔄",
    description: "Descrizione, rischio, piano di test/rollback e approvazioni per una modifica a sistemi o processi.",
    blockTemplate: [
      h1("Richiesta di Modifica"),
      h2("Descrizione della Modifica"),
      p(""),
      h2("Motivazione"),
      p(""),
      h2("Sistemi/Processi Impattati"),
      bullet(""),
      h2("Valutazione del Rischio"),
      p(""),
      h2("Piano di Test"),
      bullet(""),
      h2("Piano di Rollback"),
      p(""),
      h2("Approvazioni"),
      table([["Ruolo", "Nome", "Approvato", "Data"], ["", "", "", ""]]),
    ],
  },
  {
    name: "Offboarding Dipendente",
    category: "CUSTOM",
    icon: "🚪",
    description: "Checklist revoca accessi, adempimenti amministrativi e knowledge transfer per un'uscita.",
    blockTemplate: [
      h1("Offboarding — [Nome dipendente]"),
      h2("Informazioni Generali"),
      bullet("Ultimo giorno lavorativo:"),
      bullet("Motivo:"),
      bullet("Manager:"),
      h2("Checklist Revoca Accessi"),
      check("Account email disattivato"),
      check("Accessi VPN/sistemi revocati"),
      check("Badge fisico ritirato"),
      check("Dispositivi aziendali restituiti"),
      h2("Checklist Amministrativa"),
      check("Liquidazione calcolata"),
      check("Documenti di cessazione consegnati"),
      check("Certificato di lavoro emesso"),
      h2("Knowledge Transfer"),
      p(""),
      h2("Colloquio di Uscita (Exit Interview)"),
      p(""),
    ],
  },
  {
    name: "Valutazione Rischio Fornitore",
    category: "CUSTOM",
    icon: "🏢",
    description: "Dati trattati, certificazioni, valutazione del rischio e clausole contrattuali di un fornitore terzo.",
    blockTemplate: [
      h1("Valutazione Rischio Fornitore"),
      h2("Dati Fornitore"),
      bullet("Nome:"),
      bullet("Servizio fornito:"),
      bullet("Referente:"),
      h2("Tipologia di Dati Trattati"),
      bullet(""),
      h2("Certificazioni del Fornitore"),
      bullet("Es. ISO 27001 / SOC2 / altro"),
      h2("Valutazione del Rischio"),
      table([["Area", "Rischio", "Livello", "Mitigazione"], ["", "", "", ""]]),
      h2("Clausole Contrattuali di Compliance"),
      check("DPA (Data Processing Agreement) firmato"),
      check("SLA definiti"),
      check("Diritto di audit incluso"),
      h2("Esito"),
      p(""),
    ],
  },
  {
    name: "Piano di Risposta a Data Breach",
    category: "CUSTOM",
    icon: "🔐",
    description: "Contenimento, valutazione del rischio, notifiche e misure preventive dopo una violazione dati.",
    blockTemplate: [
      h1("Piano di Risposta a Data Breach"),
      h2("Descrizione dell'Evento"),
      p(""),
      h2("Dati Coinvolti"),
      p(""),
      h2("Numero di Soggetti Interessati"),
      p(""),
      h2("Valutazione del Rischio per gli Interessati"),
      p(""),
      h2("Azioni di Contenimento"),
      bullet(""),
      h2("Notifica al Garante Privacy"),
      check("Valutata necessità di notifica entro 72h"),
      check("Notifica inviata"),
      check("Registro delle violazioni aggiornato"),
      h2("Comunicazione agli Interessati"),
      p(""),
      h2("Misure Preventive Future"),
      bullet(""),
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
