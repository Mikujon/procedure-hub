// Standalone seed runner — uses prisma client directly (no path aliases).
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const NOW = Date.now();
const days = (n: number) => new Date(NOW - n * 86400000);
const PASSWORD = "password123";

type B = unknown;
const h = (level: 1 | 2 | 3, text: string): B => ({ type: "heading", level, text });
const p = (text: string): B => ({ type: "paragraph", text });
const callout = (variant: any, text: string, title?: string): B => ({ type: "callout", variant, text, title });
const steps = (...items: string[]): B => ({ type: "steps", items });
const j = (blocks: B[]) => JSON.stringify(blocks);

async function main() {
  if ((await db.tenant.count()) > 0) {
    console.log("already seeded — skipping");
    return;
  }

  const tenant = await db.tenant.create({ data: { name: "Atelier Corp", slug: "atelier" } });

  const azienda = await db.orgNode.create({ data: { tenantId: tenant.id, type: "company", name: "Atelier Corp", code: "AZ", parentId: null, sortOrder: 0 } });
  const admin = await db.orgNode.create({ data: { tenantId: tenant.id, type: "branch", name: "Administration", code: "ADMIN", parentId: azienda.id, sortOrder: 0 } });
  const ops = await db.orgNode.create({ data: { tenantId: tenant.id, type: "branch", name: "Operation", code: "OPS", parentId: azienda.id, sortOrder: 1 } });
  const fns = ["HR","Legal","IT","Finance"];
  const fnNodes: any = {};
  for (let i = 0; i < fns.length; i++) {
    fnNodes[fns[i]] = await db.orgNode.create({ data: { tenantId: tenant.id, type: "function", name: fns[i], code: fns[i], parentId: admin.id, sortOrder: i } });
  }
  const clientA = await db.orgNode.create({ data: { tenantId: tenant.id, type: "client", name: "Cliente A", code: "CL-A", parentId: ops.id, sortOrder: 0 } });
  const campaign = await db.orgNode.create({ data: { tenantId: tenant.id, type: "campaign", name: "Customer Care", code: "CC", parentId: clientA.id, sortOrder: 0 } });
  const subInbound = await db.orgNode.create({ data: { tenantId: tenant.id, type: "subcampaign", name: "Inbound", code: "CC-IB", parentId: campaign.id, sortOrder: 0 } });
  const team1 = await db.orgNode.create({ data: { tenantId: tenant.id, type: "team", name: "Team 1", code: "T1", parentId: subInbound.id, sortOrder: 0 } });
  const team2 = await db.orgNode.create({ data: { tenantId: tenant.id, type: "team", name: "Team 2", code: "T2", parentId: subInbound.id, sortOrder: 1 } });

  const hash = await bcrypt.hash(PASSWORD, 10);
  const users = [
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
  const uid = new Map<string, string>();
  for (const u of users) {
    const c = await db.user.create({ data: { tenantId: tenant.id, name: u.name, email: u.email, passwordHash: hash, role: u.role, title: u.title, avatarColor: u.avatarColor, location: u.location, language: u.language } });
    uid.set(u.email, c.id);
  }
  const assign = (email: string, nodeId: string, relation: string) =>
    db.orgAssignment.create({ data: { tenantId: tenant.id, userId: uid.get(email)!, nodeId, relation } });
  await assign("elena.marchetti@procedurehub.io", fnNodes["HR"].id, "manager");
  await assign("sofia.bianchi@procedurehub.io", fnNodes["Legal"].id, "manager");
  await assign("marco.rossi@procedurehub.io", fnNodes["Legal"].id, "member");
  await assign("anna.krasniqi@procedurehub.io", team1.id, "manager");
  await assign("anna.krasniqi@procedurehub.io", team1.id, "member");
  await assign("dario.hoxha@procedurehub.io", team1.id, "member");
  await assign("bruno.lleshi@procedurehub.io", team1.id, "member");
  await assign("luca.hoti@procedurehub.io", team2.id, "manager");
  await assign("luca.hoti@procedurehub.io", team2.id, "member");
  await assign("elisa.dervishi@procedurehub.io", team2.id, "member");
  await assign("giulia.conti@procedurehub.io", subInbound.id, "manager");
  await assign("davide.romano@procedurehub.io", clientA.id, "manager");

  for (const tipo of ["policy", "procedura"]) {
    await db.documentTypeApproval.create({ data: { tenantId: tenant.id, tipo, requiredApprovals: JSON.stringify(["compliance"]) } });
  }

  const privacy = await db.document.create({ data: {
    tenantId: tenant.id, code: "POL-001", title: "Privacy Policy",
    summary: "Privacy policy aziendale — obbligatoria per tutto il personale.",
    tipo: "policy", category: "Privacy", obbligatorio: true, stato: "in_vigore", status: "published",
    ownerId: uid.get("sofia.bianchi@procedurehub.io")!,
    requiredApprovals: JSON.stringify(["compliance"]), visibility: "restricted",
    content: j([h(1,"Privacy Policy"), p("Questa policy descrive come Atelier Corp raccoglie, usa e protegge i dati personali."), callout("info","Confermare di aver letto la policy è obbligatorio per tutti."), h(2,"Dati raccolti"), steps("Dati anagrafici all'assunzione","Dati di accesso ai sistemi","Dati di performance")]),
    tags: JSON.stringify(["gdpr","privacy"]), createdAt: days(90), updatedAt: days(60),
  }});
  const privacyV1 = await db.version.create({ data: { tenantId: tenant.id, documentId: privacy.id, numero: 1, lingua: "it", inVigoreDal: days(60), testo: privacy.content, approvataDa: uid.get("sofia.bianchi@procedurehub.io"), approvataIl: days(60), isCurrent: true, createdAt: days(90) } });
  await db.document.update({ where: { id: privacy.id }, data: { currentVersionId: privacyV1.id } });
  await db.destination.create({ data: { tenantId: tenant.id, documentId: privacy.id, versionId: privacyV1.id, nodeIds: JSON.stringify([azienda.id]), sedi: "[]", ruoli: "[]", lingue: "[]" } });

  const conduct = await db.document.create({ data: {
    tenantId: tenant.id, code: "POL-002", title: "Codice di Condotta",
    summary: "Codice etico aziendale.", tipo: "policy", category: "Ethics", obbligatorio: true, stato: "in_vigore", status: "published",
    ownerId: uid.get("sofia.bianchi@procedurehub.io")!, requiredApprovals: JSON.stringify(["compliance"]), visibility: "restricted",
    content: j([h(1,"Codice di Condotta"), p("Principi etici di Atelier Corp."), callout("warning","La violazione può comportare azioni disciplinari.")]),
    tags: JSON.stringify(["ethics"]), createdAt: days(80), updatedAt: days(45),
  }});
  const conductV1 = await db.version.create({ data: { tenantId: tenant.id, documentId: conduct.id, numero: 1, lingua: "it", inVigoreDal: days(45), testo: conduct.content, approvataDa: uid.get("sofia.bianchi@procedurehub.io"), approvataIl: days(45), isCurrent: true, createdAt: days(80) } });
  await db.document.update({ where: { id: conduct.id }, data: { currentVersionId: conductV1.id } });
  await db.destination.create({ data: { tenantId: tenant.id, documentId: conduct.id, versionId: conductV1.id, nodeIds: JSON.stringify([azienda.id]), sedi: "[]", ruoli: "[]", lingue: "[]" } });

  const safety = await db.document.create({ data: {
    tenantId: tenant.id, code: "PROC-OPS-001", title: "Sicurezza sul Posto di Lavoro",
    summary: "Procedure di sicurezza per il personale Operation.", tipo: "procedura", category: "Safety", obbligatorio: true, stato: "in_vigore", status: "published",
    ownerId: uid.get("davide.romano@procedurehub.io")!, requiredApprovals: JSON.stringify(["compliance"]), visibility: "restricted",
    content: j([h(1,"Sicurezza"), steps("Indossare il badge","Non condividere credenziali","Segnalare incidenti entro 2h")]),
    tags: JSON.stringify(["safety","operation"]), createdAt: days(50), updatedAt: days(30),
  }});
  const safetyV1 = await db.version.create({ data: { tenantId: tenant.id, documentId: safety.id, numero: 1, lingua: "it", inVigoreDal: days(30), testo: safety.content, isCurrent: true, createdAt: days(50) } });
  await db.document.update({ where: { id: safety.id }, data: { currentVersionId: safetyV1.id } });
  await db.destination.create({ data: { tenantId: tenant.id, documentId: safety.id, versionId: safetyV1.id, nodeIds: JSON.stringify([ops.id]), sedi: "[]", ruoli: "[]", lingue: "[]" } });

  const clientRules = await db.document.create({ data: {
    tenantId: tenant.id, code: "PROC-CL-A-001", title: "Regole del Cliente A",
    summary: "Linee guida operative per il cliente A.", tipo: "procedura", category: "Client", obbligatorio: false, stato: "in_vigore", status: "published",
    ownerId: uid.get("davide.romano@procedurehub.io")!, requiredApprovals: JSON.stringify(["compliance"]), visibility: "restricted",
    content: j([h(1,"Regole del Cliente A"), p("Tutti gli agenti che lavorano su campagne del cliente A devono seguire queste regole."), callout("info","Le regole del cliente prevalgono dove esplicitamente indicato.")]),
    tags: JSON.stringify(["client","cliente-a"]), createdAt: days(35), updatedAt: days(20),
  }});
  const crV1 = await db.version.create({ data: { tenantId: tenant.id, documentId: clientRules.id, numero: 1, lingua: "it", inVigoreDal: days(20), testo: clientRules.content, isCurrent: true, createdAt: days(35) } });
  await db.document.update({ where: { id: clientRules.id }, data: { currentVersionId: crV1.id } });
  await db.destination.create({ data: { tenantId: tenant.id, documentId: clientRules.id, versionId: crV1.id, nodeIds: JSON.stringify([clientA.id]), sedi: "[]", ruoli: "[]", lingue: "[]" } });

  const script = await db.document.create({ data: {
    tenantId: tenant.id, code: "PROC-CC-IB-001", title: "Script di Apertura Chiamata Inbound",
    summary: "Script obbligatorio per l'apertura delle chiamate inbound.", tipo: "procedura", category: "Script", obbligatorio: true, stato: "in_vigore", status: "published",
    ownerId: uid.get("giulia.conti@procedurehub.io")!, requiredApprovals: JSON.stringify(["compliance"]), visibility: "restricted",
    content: j([h(1,"Script di Apertura"), steps("Salutare: 'Buongiorno, sono [nome], come posso aiutarla?'","Verificare l'identità del chiamante","Registrare la richiesta nel CRM entro 30 secondi"), callout("warning","Non chiudere senza registrare l'esito.")]),
    tags: JSON.stringify(["script","inbound"]), createdAt: days(25), updatedAt: days(10),
  }});
  const scV1 = await db.version.create({ data: { tenantId: tenant.id, documentId: script.id, numero: 1, lingua: "it", inVigoreDal: days(10), testo: script.content, isCurrent: true, createdAt: days(25) } });
  await db.document.update({ where: { id: script.id }, data: { currentVersionId: scV1.id } });
  await db.destination.create({ data: { tenantId: tenant.id, documentId: script.id, versionId: scV1.id, nodeIds: JSON.stringify([subInbound.id]), sedi: "[]", ruoli: "[]", lingue: "[]" } });

  const esc = await db.document.create({ data: {
    tenantId: tenant.id, code: "PROC-T1-001", title: "Escalation del Team 1",
    summary: "Procedura di escalation specifica per il Team 1.", tipo: "procedura", category: "Escalation", obbligatorio: true, stato: "in_vigore", status: "published",
    ownerId: uid.get("anna.krasniqi@procedurehub.io")!, requiredApprovals: JSON.stringify(["compliance"]), visibility: "restricted",
    content: j([h(1,"Escalazione del Team 1"), steps("Se il chiamante richiede un supervisore, trasferire al TL Anna","In assenza del TL, escalation al FM Giulia","Registrare ogni escalation nel CRM con tag 'ESCALATION-T1'")]),
    tags: JSON.stringify(["escalation","team-1"]), createdAt: days(15), updatedAt: days(5),
  }});
  const escV1 = await db.version.create({ data: { tenantId: tenant.id, documentId: esc.id, numero: 1, lingua: "it", inVigoreDal: days(5), testo: esc.content, isCurrent: true, createdAt: days(15) } });
  await db.document.update({ where: { id: esc.id }, data: { currentVersionId: escV1.id } });
  await db.destination.create({ data: { tenantId: tenant.id, documentId: esc.id, versionId: escV1.id, nodeIds: JSON.stringify([team1.id]), sedi: "[]", ruoli: "[]", lingue: "[]" } });

  const comm = await db.document.create({ data: {
    tenantId: tenant.id, code: "COM-001", title: "Cambio orari ufficio per festività",
    summary: "Comunicazione ufficiale sugli orari di ufficio per la festività del 28 novembre.", tipo: "comunicazione", category: "HR", obbligatorio: false, stato: "in_vigore", status: "published",
    ownerId: uid.get("elena.marchetti@procedurehub.io")!, requiredApprovals: JSON.stringify([]), visibility: "restricted",
    content: j([h(1,"Cambio orari ufficio"), p("Per la festività del 28 novembre gli uffici saranno chiusi."), callout("info","Le attività Operation continuano secondo i turni.")]),
    tags: JSON.stringify(["hr","comunicazione"]), createdAt: days(3), updatedAt: days(2),
  }});
  const commV1 = await db.version.create({ data: { tenantId: tenant.id, documentId: comm.id, numero: 1, lingua: "it", inVigoreDal: days(2), testo: comm.content, isCurrent: true, createdAt: days(3) } });
  await db.document.update({ where: { id: comm.id }, data: { currentVersionId: commV1.id } });
  await db.destination.create({ data: { tenantId: tenant.id, documentId: comm.id, versionId: commV1.id, nodeIds: JSON.stringify([azienda.id]), sedi: "[]", ruoli: "[]", lingue: "[]" } });

  for (const [code, acker] of [["POL-001", "anna.krasniqi@procedurehub.io"], ["POL-002", "anna.krasniqi@procedurehub.io"], ["POL-001", "dario.hoxha@procedurehub.io"]] as const) {
    const d = await db.document.findUnique({ where: { tenantId_code: { tenantId: tenant.id, code } } });
    if (d?.currentVersionId) {
      await db.acknowledgment.create({ data: { tenantId: tenant.id, userId: uid.get(acker)!, documentId: d.id, versionId: d.currentVersionId, via: "diretta", at: days(Math.floor(Math.random()*10)+1) } });
    }
  }

  console.log("seed done:", { tenants: await db.tenant.count(), users: await db.user.count(), documents: await db.document.count(), nodes: await db.orgNode.count() });
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
