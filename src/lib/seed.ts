// Seed — Nodo-aligned.
// Builds an organigram tree (company → Admin/Op → functions/clients →
// campaigns → subcampaigns → teams → people) and a few documents with
// destinations that demonstrate the cascade (general in high nodes, specific
// in low nodes). Multi-language versions. DocumentTypeApproval config (only
// "compliance" for now — quality/training/hr configurable later).
//
// Two tenants:
//  - "atelier" — the rich example (mirrors the spec's example tree)
//  - "northwind" — a smaller isolated tenant
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const NOW = Date.now();
const days = (n: number) => new Date(NOW - n * 86400000);
const PASSWORD = "password123";

// block helpers (kept simple)
type B = unknown;
const h = (level: 1 | 2 | 3, text: string): B => ({ type: "heading", level, text });
const p = (text: string): B => ({ type: "paragraph", text });
const callout = (variant: "info" | "warning" | "success" | "danger", text: string, title?: string): B => ({ type: "callout", variant, text, title });
const steps = (...items: string[]): B => ({ type: "steps", items });
const j = (blocks: B[]) => JSON.stringify(blocks);

// ===========================================================================
// TENANT 1 — Atelier Corp (albero spec Nodo 7.1)
// ===========================================================================
const T1 = {
  slug: "atelier",
  name: "Atelier Corp",
};

// Users (roles aligned with Nodo)
const T1_USERS = [
  { name: "Elena Marchetti", email: "elena.marchetti@procedurehub.io", role: "HR_HEAD", title: "HR Head", avatarColor: "#be185d", location: "AL", language: "it" },
  { name: "Sofia Bianchi", email: "sofia.bianchi@procedurehub.io", role: "LEGAL_HEAD", title: "Legal Head", avatarColor: "#475569", location: "AL", language: "it" },
  { name: "Marco Rossi", email: "marco.rossi@procedurehub.io", role: "COMPLIANCE", title: "Compliance Officer", avatarColor: "#0d9488", location: "AL", language: "it" },
  { name: "Luca Ferrari", email: "luca.ferrari@procedurehub.io", role: "ADMIN", title: "Platform Admin", avatarColor: "#7c3aed", location: "IT", language: "it" },
  { name: "Anna Krasniqi", email: "anna.krasniqi@procedurehub.io", role: "TL", title: "Team Leader — Team 1", avatarColor: "#0891b2", location: "AL", language: "sq" },
  { name: "Dario Hoxha", email: "dario.hoxha@procedurehub.io", role: "VIEWER", title: "Agent — Team 1", avatarColor: "#ca8a04", location: "AL", language: "sq" },
  { name: "Bruno Lleshi", email: "bruno.lleshi@procedurehub.io", role: "VIEWER", title: "Agent — Team 1", avatarColor: "#dc2626", location: "AL", language: "sq" },
  { name: "Luca Hoti", email: "luca.hoti@procedurehub.io", role: "TL", title: "Team Leader — Team 2", avatarColor: "#db2777", location: "AL", language: "sq" },
  { name: "Elisa Dervishi", email: "elisa.dervishi@procedurehub.io", role: "VIEWER", title: "Agent — Team 2", avatarColor: "#9333ea", location: "AL", language: "sq" },
  { name: "Giulia Conti", email: "giulia.conti@procedurehub.io", role: "FM", title: "Floor Manager", avatarColor: "#16a34a", location: "IT", language: "it" },
  { name: "Davide Romano", email: "davide.romano@procedurehub.io", role: "CSDM", title: "CSDM — Cliente A", avatarColor: "#ea580c", location: "IT", language: "it" },
];

// Org tree (spec 7.1):
// Azienda
// ├── Administration
// │     ├── HR (function)
// │     ├── Legal (function)
// │     ├── IT (function)
// │     └── Finance (function)
// └── Operation
//       └── Cliente «A»
//             └── Campagna «Customer Care»
//                   └── Sottocampagna «Inbound»
//                         ├── Team 1 — Anna (TL), Dario, Bruno
//                         └── Team 2 — Luca (TL), Elisa
const T1_TREE = `
Azienda
├── Administration
│     ├── HR
│     ├── Legal
│     ├── IT
│     └── Finance
└── Operation
      └── Cliente «A»
            └── Campagna «Customer Care»
                  └── Sottocampagna «Inbound»
                        ├── Team 1
                        └── Team 2
`;

// ===========================================================================
// TENANT 2 — Northwind Logistics (smaller)
// ===========================================================================
const T2 = {
  slug: "northwind",
  name: "Northwind Logistics",
};

const T2_USERS = [
  { name: "Nora Lindqvist", email: "nora.lindqvist@northwind.io", role: "ADMIN", title: "Warehouse Manager", avatarColor: "#0891b2", location: "IT", language: "en" },
  { name: "Tomas Berg", email: "tomas.berg@northwind.io", role: "LEGAL_HEAD", title: "Fleet & Safety Lead", avatarColor: "#ea580c", location: "IT", language: "en" },
];

export async function ensureSeed() {
  if ((await db.tenant.count()) > 0) return;
  await seedTenant1();
  await seedTenant2();
}

async function seedTenant1() {
  const tenant = await db.tenant.create({ data: { name: T1.name, slug: T1.slug } });

  // ---- Org tree ----------------------------------------------------------
  // root: company
  const azienda = await db.orgNode.create({
    data: { tenantId: tenant.id, type: "company", name: "Atelier Corp", code: "AZ", parentId: null, sortOrder: 0 },
  });
  // two branches
  const admin = await db.orgNode.create({
    data: { tenantId: tenant.id, type: "branch", name: "Administration", code: "ADMIN", parentId: azienda.id, sortOrder: 0 },
  });
  const ops = await db.orgNode.create({
    data: { tenantId: tenant.id, type: "branch", name: "Operation", code: "OPS", parentId: azienda.id, sortOrder: 1 },
  });
  // admin functions
  const functions = [
    { name: "HR", code: "HR", color: "#be185d" },
    { name: "Legal", code: "LG", color: "#475569" },
    { name: "IT", code: "IT", color: "#7c3aed" },
    { name: "Finance", code: "FN", color: "#ca8a04" },
  ];
  const fnNodes: Record<string, any> = {};
  for (let i = 0; i < functions.length; i++) {
    fnNodes[functions[i].code] = await db.orgNode.create({
      data: { tenantId: tenant.id, type: "function", name: functions[i].name, code: functions[i].code, parentId: admin.id, sortOrder: i },
    });
  }
  // operation: client A → campaign → subcampaign → teams
  const clientA = await db.orgNode.create({
    data: { tenantId: tenant.id, type: "client", name: "Cliente A", code: "CL-A", parentId: ops.id, sortOrder: 0 },
  });
  const campaign = await db.orgNode.create({
    data: { tenantId: tenant.id, type: "campaign", name: "Customer Care", code: "CC", parentId: clientA.id, sortOrder: 0 },
  });
  const subInbound = await db.orgNode.create({
    data: { tenantId: tenant.id, type: "subcampaign", name: "Inbound", code: "CC-IB", parentId: campaign.id, sortOrder: 0 },
  });
  const team1 = await db.orgNode.create({
    data: { tenantId: tenant.id, type: "team", name: "Team 1", code: "T1", parentId: subInbound.id, sortOrder: 0 },
  });
  const team2 = await db.orgNode.create({
    data: { tenantId: tenant.id, type: "team", name: "Team 2", code: "T2", parentId: subInbound.id, sortOrder: 1 },
  });

  // ---- Users + assignments -----------------------------------------------
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const userIdByEmail = new Map<string, string>();
  for (const u of T1_USERS) {
    const created = await db.user.create({
      data: {
        tenantId: tenant.id,
        name: u.name,
        email: u.email,
        passwordHash,
        role: u.role,
        title: u.title,
        avatarColor: u.avatarColor,
        location: u.location,
        language: u.language,
      },
    });
    userIdByEmail.set(u.email, created.id);
  }

  // Assignments:
  // - Elena (HR_HEAD) → manager of HR function
  // - Sofia (LEGAL_HEAD) → manager of Legal function
  // - Anna (TL) → manager of Team 1; member of Team 1
  // - Dario, Bruno → members of Team 1
  // - Luca Hoti (TL) → manager of Team 2; member of Team 2
  // - Elisa → member of Team 2
  // - Giulia (FM) → manager of subInbound
  // - Davide (CSDM) → manager of clientA
  // - Marco (COMPLIANCE) → member of Legal function
  // - Luca Ferrari (ADMIN) → no assignment
  const assign = (email: string, nodeId: string, relation: string) => {
    return db.orgAssignment.create({
      data: { tenantId: tenant.id, userId: userIdByEmail.get(email)!, nodeId, relation },
    });
  };
  await assign("elena.marchetti@procedurehub.io", fnNodes.HR.id, "manager");
  await assign("sofia.bianchi@procedurehub.io", fnNodes.LG.id, "manager");
  await assign("marco.rossi@procedurehub.io", fnNodes.LG.id, "member");
  await assign("anna.krasniqi@procedurehub.io", team1.id, "manager");
  await assign("anna.krasniqi@procedurehub.io", team1.id, "member");
  await assign("dario.hoxha@procedurehub.io", team1.id, "member");
  await assign("bruno.lleshi@procedurehub.io", team1.id, "member");
  await assign("luca.hoti@procedurehub.io", team2.id, "manager");
  await assign("luca.hoti@procedurehub.io", team2.id, "member");
  await assign("elisa.dervishi@procedurehub.io", team2.id, "member");
  await assign("giulia.conti@procedurehub.io", subInbound.id, "manager");
  await assign("davide.romano@procedurehub.io", clientA.id, "manager");

  // ---- DocumentTypeApproval config (Opzione 3 — configurable per tipo) --
  // for now: only "compliance" on policy & procedura
  for (const tipo of ["policy", "procedura"]) {
    await db.documentTypeApproval.create({
      data: { tenantId: tenant.id, tipo, requiredApprovals: JSON.stringify(["compliance"]) },
    });
  }

  // ---- Documents ---------------------------------------------------------
  // 1. Policy privacy (GENERAL — attached to Azienda node, all languages)
  const privacy = await db.document.create({
    data: {
      tenantId: tenant.id,
      code: "POL-001",
      title: "Privacy Policy",
      summary: "Privacy policy aziendale — obbligatoria per tutto il personale.",
      tipo: "policy",
      category: "Privacy",
      obbligatorio: true,
      stato: "in_vigore",
      status: "published",
      ownerId: userIdByEmail.get("sofia.bianchi@procedurehub.io")!,
      requiredApprovals: JSON.stringify(["compliance"]),
      visibility: "restricted",
      content: j([
        h(1, "Privacy Policy"),
        p("Questa policy descrive come Atelier Corp raccoglie, usa e protegge i dati personali di dipendenti, collaboratori e clienti."),
        callout("info", "Confermare di aver letto la policy è obbligatorio per tutti. La conferma vale per questa versione; una nuova versione richiede nuova conferma."),
        h(2, "Dati raccolti"),
        steps(
          "Dati anagrafici forniti all'assunzione",
          "Dati di accesso ai sistemi aziendali",
          "Dati di performance raccolti dai sistemi di WFM"
        ),
        h(2, "Diritti dell'interessato"),
        p("Ogni dipendente può esercitare i diritti GDPR contattando il DPO all'indirizzo dpo@ateliercorp.io."),
      ]),
      tags: JSON.stringify(["gdpr", "privacy", "obbligatorio"]),
      publishedAt: days(60),
      createdAt: days(90),
      updatedAt: days(60),
    },
  });
  // version 1 in IT
  const privacyV1It = await db.version.create({
    data: {
      tenantId: tenant.id,
      documentId: privacy.id,
      numero: 1,
      lingua: "it",
      inVigoreDal: days(60),
      testo: privacy.content,
      approvataDa: userIdByEmail.get("sofia.bianchi@procedurehub.io"),
      approvataIl: days(60),
      isCurrent: true,
      createdAt: days(90),
    },
  });
  await db.document.update({ where: { id: privacy.id }, data: { currentVersionId: privacyV1It.id } });
  // destination: Azienda node (everyone), all locations, all roles, all languages
  await db.destination.create({
    data: {
      tenantId: tenant.id,
      documentId: privacy.id,
      versionId: privacyV1It.id,
      nodeIds: JSON.stringify([azienda.id]),
      sedi: JSON.stringify([]),
      ruoli: JSON.stringify([]),
      lingue: JSON.stringify([]),
    },
  });

  // 2. Codice di condotta (GENERAL — Azienda)
  const conduct = await db.document.create({
    data: {
      tenantId: tenant.id,
      code: "POL-002",
      title: "Codice di Condotta",
      summary: "Codice etico e di condotta aziendale.",
      tipo: "policy",
      category: "Ethics",
      obbligatorio: true,
      stato: "in_vigore",
      status: "published",
      ownerId: userIdByEmail.get("sofia.bianchi@procedurehub.io")!,
      requiredApprovals: JSON.stringify(["compliance"]),
      visibility: "restricted",
      content: j([
        h(1, "Codice di Condotta"),
        p("Il presente codice definisce i principi etici di Atelier Corp."),
        callout("warning", "La violazione del codice può comportare azioni disciplinari fino al licenziamento."),
      ]),
      tags: JSON.stringify(["ethics", "obbligatorio"]),
      publishedAt: days(45),
      createdAt: days(80),
      updatedAt: days(45),
    },
  });
  const conductV1 = await db.version.create({
    data: {
      tenantId: tenant.id,
      documentId: conduct.id,
      numero: 1,
      lingua: "it",
      inVigoreDal: days(45),
      testo: conduct.content,
      approvataDa: userIdByEmail.get("sofia.bianchi@procedurehub.io"),
      approvataIl: days(45),
      isCurrent: true,
      createdAt: days(80),
    },
  });
  await db.document.update({ where: { id: conduct.id }, data: { currentVersionId: conductV1.id } });
  await db.destination.create({
    data: {
      tenantId: tenant.id,
      documentId: conduct.id,
      versionId: conductV1.id,
      nodeIds: JSON.stringify([azienda.id]),
    },
  });

  // 3. Procedura di sicurezza sul posto (Operation branch)
  const safety = await db.document.create({
    data: {
      tenantId: tenant.id,
      code: "PROC-OPS-001",
      title: "Sicurezza sul Posto di Lavoro",
      summary: "Procedure di sicurezza per il personale Operation.",
      tipo: "procedura",
      category: "Safety",
      obbligatorio: true,
      stato: "in_vigore",
      status: "published",
      ownerId: userIdByEmail.get("davide.romano@procedurehub.io")!,
      requiredApprovals: JSON.stringify(["compliance"]),
      visibility: "restricted",
      content: j([
        h(1, "Sicurezza sul Posto di Lavoro"),
        steps(
          "Indossare il badge identificativo in ogni momento",
          "Non condividere le credenziali di accesso",
          "Segnalare incidenti entro 2 ore al Team Leader",
          "Rispettare le vie di fuga segnalate"
        ),
      ]),
      tags: JSON.stringify(["safety", "obbligatorio", "operation"]),
      publishedAt: days(30),
      createdAt: days(50),
      updatedAt: days(30),
    },
  });
  const safetyV1 = await db.version.create({
    data: {
      tenantId: tenant.id,
      documentId: safety.id,
      numero: 1,
      lingua: "it",
      inVigoreDal: days(30),
      testo: safety.content,
      approvataDa: userIdByEmail.get("sofia.bianchi@procedurehub.io"),
      approvataIl: days(30),
      isCurrent: true,
      createdAt: days(50),
    },
  });
  await db.document.update({ where: { id: safety.id }, data: { currentVersionId: safetyV1.id } });
  await db.destination.create({
    data: {
      tenantId: tenant.id,
      documentId: safety.id,
      versionId: safetyV1.id,
      nodeIds: JSON.stringify([ops.id]),
    },
  });

  // 4. Regole del Cliente A (specific — client A node)
  const clientRules = await db.document.create({
    data: {
      tenantId: tenant.id,
      code: "PROC-CL-A-001",
      title: "Regole del Cliente A",
      summary: "Linee guida operative specifiche per il cliente A.",
      tipo: "procedura",
      category: "Client",
      obbligatorio: false,
      stato: "in_vigore",
      status: "published",
      ownerId: userIdByEmail.get("davide.romano@procedurehub.io")!,
      requiredApprovals: JSON.stringify(["compliance"]),
      visibility: "restricted",
      content: j([
        h(1, "Regole del Cliente A"),
        p("Tutti gli agenti che lavorano su campagne del cliente A devono seguire queste regole."),
        callout("info", "Le regole del cliente prevalgono sulle procedure generali solo dove esplicitamente indicato."),
      ]),
      tags: JSON.stringify(["client", "cliente-a"]),
      publishedAt: days(20),
      createdAt: days(35),
      updatedAt: days(20),
    },
  });
  const clientRulesV1 = await db.version.create({
    data: {
      tenantId: tenant.id,
      documentId: clientRules.id,
      numero: 1,
      lingua: "it",
      inVigoreDal: days(20),
      testo: clientRules.content,
      isCurrent: true,
      createdAt: days(35),
    },
  });
  await db.document.update({ where: { id: clientRules.id }, data: { currentVersionId: clientRulesV1.id } });
  await db.destination.create({
    data: {
      tenantId: tenant.id,
      documentId: clientRules.id,
      versionId: clientRulesV1.id,
      nodeIds: JSON.stringify([clientA.id]),
    },
  });

  // 5. Script Inbound (specific — subcampaign Inbound)
  const script = await db.document.create({
    data: {
      tenantId: tenant.id,
      code: "PROC-CC-IB-001",
      title: "Script di Apertura Chiamata Inbound",
      summary: "Script obbligatorio per l'apertura delle chiamate inbound.",
      tipo: "procedura",
      category: "Script",
      obbligatorio: true,
      stato: "in_vigore",
      status: "published",
      ownerId: userIdByEmail.get("giulia.conti@procedurehub.io")!,
      requiredApprovals: JSON.stringify(["compliance"]),
      visibility: "restricted",
      content: j([
        h(1, "Script di Apertura"),
        steps(
          "Salutare con la formula: 'Buongiorno, sono [nome], come posso aiutarla?'",
          "Verificare l'identità del chiamante secondo la procedura di autenticazione",
          "Registrare la richiesta nel CRM entro 30 secondi"
        ),
        callout("warning", "Non chiudere la chiamata senza aver registrato l'esito nel CRM."),
      ]),
      tags: JSON.stringify(["script", "inbound", "obbligatorio"]),
      publishedAt: days(10),
      createdAt: days(25),
      updatedAt: days(10),
    },
  });
  const scriptV1 = await db.version.create({
    data: {
      tenantId: tenant.id,
      documentId: script.id,
      numero: 1,
      lingua: "it",
      inVigoreDal: days(10),
      testo: script.content,
      isCurrent: true,
      createdAt: days(25),
    },
  });
  await db.document.update({ where: { id: script.id }, data: { currentVersionId: scriptV1.id } });
  await db.destination.create({
    data: {
      tenantId: tenant.id,
      documentId: script.id,
      versionId: scriptV1.id,
      nodeIds: JSON.stringify([subInbound.id]),
    },
  });

  // 6. Procedura escalation Team 1 (very specific — team 1 only)
  const escalation = await db.document.create({
    data: {
      tenantId: tenant.id,
      code: "PROC-T1-001",
      title: "Escalation del Team 1",
      summary: "Procedura di escalation specifica per il Team 1.",
      tipo: "procedura",
      category: "Escalation",
      obbligatorio: true,
      stato: "in_vigore",
      status: "published",
      ownerId: userIdByEmail.get("anna.krasniqi@procedurehub.io")!,
      requiredApprovals: JSON.stringify(["compliance"]),
      visibility: "restricted",
      content: j([
        h(1, "Escalazione del Team 1"),
        steps(
          "Se il chiamante richiede un supervisore, trasferire al TL Anna Krasniqi",
          "In caso di assenza del TL, escalation al Floor Manager Giulia Conti",
          "Registrare ogni escalation nel CRM con il tag 'ESCALATION-T1'"
        ),
      ]),
      tags: JSON.stringify(["escalation", "team-1", "obbligatorio"]),
      publishedAt: days(5),
      createdAt: days(15),
      updatedAt: days(5),
    },
  });
  const escV1 = await db.version.create({
    data: {
      tenantId: tenant.id,
      documentId: escalation.id,
      numero: 1,
      lingua: "it",
      inVigoreDal: days(5),
      testo: escalation.content,
      isCurrent: true,
      createdAt: days(15),
    },
  });
  await db.document.update({ where: { id: escalation.id }, data: { currentVersionId: escV1.id } });
  await db.destination.create({
    data: {
      tenantId: tenant.id,
      documentId: escalation.id,
      versionId: escV1.id,
      nodeIds: JSON.stringify([team1.id]),
    },
  });

  // 7. Comunicazione ufficiale (HR-8) — general, scheduled
  const comm = await db.document.create({
    data: {
      tenantId: tenant.id,
      code: "COM-001",
      title: "Cambio orari ufficio per festività",
      summary: "Comunicazione ufficiale sugli orari di ufficio per la festività del 28 novembre.",
      tipo: "comunicazione",
      category: "HR",
      obbligatorio: false,
      stato: "in_vigore",
      status: "published",
      ownerId: userIdByEmail.get("elena.marchetti@procedurehub.io")!,
      requiredApprovals: JSON.stringify([]), // comunicazioni: no approvals
      visibility: "restricted",
      content: j([
        h(1, "Cambio orari ufficio"),
        p("Si comunica che per la festività del 28 novembre gli uffici saranno chiusi."),
        callout("info", "Le attività Operation continuano regolarmente secondo i turni assegnati."),
      ]),
      tags: JSON.stringify(["hr", "comunicazione"]),
      publishedAt: days(2),
      createdAt: days(3),
      updatedAt: days(2),
    },
  });
  const commV1 = await db.version.create({
    data: {
      tenantId: tenant.id,
      documentId: comm.id,
      numero: 1,
      lingua: "it",
      inVigoreDal: days(2),
      testo: comm.content,
      isCurrent: true,
      createdAt: days(3),
    },
  });
  await db.document.update({ where: { id: comm.id }, data: { currentVersionId: commV1.id } });
  await db.destination.create({
    data: {
      tenantId: tenant.id,
      documentId: comm.id,
      versionId: commV1.id,
      nodeIds: JSON.stringify([azienda.id]),
    },
  });

  // ---- Acknowledgments (some pre-acked for realism) ----------------------
  // Anna acked privacy + conduct (current version)
  for (const [code, acker] of [
    ["POL-001", "anna.krasniqi@procedurehub.io"],
    ["POL-002", "anna.krasniqi@procedurehub.io"],
    ["POL-001", "dario.hoxha@procedurehub.io"],
  ] as const) {
    const d = await db.document.findUnique({ where: { tenantId_code: { tenantId: tenant.id, code } } });
    if (d?.currentVersionId) {
      await db.acknowledgment.create({
        data: {
          tenantId: tenant.id,
          userId: userIdByEmail.get(acker)!,
          documentId: d.id,
          versionId: d.currentVersionId,
          via: "diretta",
          at: days(Math.floor(Math.random() * 10) + 1),
        },
      });
    }
  }

  // ---- Audit log ---------------------------------------------------------
  for (const entry of [
    { action: "PUBLISH", code: "POL-001", summary: "Published v1", email: "sofia.bianchi@procedurehub.io", daysAgo: 60 },
    { action: "PUBLISH", code: "POL-002", summary: "Published v1", email: "sofia.bianchi@procedurehub.io", daysAgo: 45 },
    { action: "PUBLISH", code: "PROC-T1-001", summary: "Published v1", email: "anna.krasniqi@procedurehub.io", daysAgo: 5 },
    { action: "ACK", code: "POL-001", summary: "Acknowledged v1", email: "anna.krasniqi@procedurehub.io", daysAgo: 3 },
  ] as const) {
    const d = await db.document.findUnique({ where: { tenantId_code: { tenantId: tenant.id, code: entry.code } } });
    if (d) {
      await db.auditLog.create({
        data: {
          tenantId: tenant.id,
          action: entry.action,
          entityType: "DOCUMENT",
          entityId: d.id,
          summary: entry.summary,
          userId: userIdByEmail.get(entry.email) ?? null,
          procedureId: d.id,
          createdAt: days(entry.daysAgo),
        },
      });
    }
  }
}

async function seedTenant2() {
  const tenant = await db.tenant.create({ data: { name: T2.name, slug: T2.slug } });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  for (const u of T2_USERS) {
    await db.user.create({
      data: {
        tenantId: tenant.id,
        name: u.name,
        email: u.email,
        passwordHash,
        role: u.role,
        title: u.title,
        avatarColor: u.avatarColor,
        location: u.location,
        language: u.language,
      },
    });
  }
  // simpler tree
  const azienda = await db.orgNode.create({
    data: { tenantId: tenant.id, type: "company", name: T2.name, code: "NW", parentId: null },
  });
  const warehouse = await db.orgNode.create({
    data: { tenantId: tenant.id, type: "function", name: "Warehouse Operations", code: "WH", parentId: azienda.id },
  });
  const fleet = await db.orgNode.create({
    data: { tenantId: tenant.id, type: "function", name: "Fleet & Transport", code: "FLT", parentId: azienda.id },
  });
  const users = await db.user.findMany({ where: { tenantId: tenant.id } });
  await db.orgAssignment.create({
    data: { tenantId: tenant.id, userId: users[0].id, nodeId: warehouse.id, relation: "manager" },
  });
  await db.orgAssignment.create({
    data: { tenantId: tenant.id, userId: users[1].id, nodeId: fleet.id, relation: "manager" },
  });
}

export const DEMO_CREDENTIALS = { password: PASSWORD };
