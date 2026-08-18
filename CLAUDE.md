# CLAUDE.md

Questo file viene letto automaticamente da Claude Code all'avvio in questa repo.
Contiene il contesto necessario per continuare lo sviluppo senza dover
ri-spiegare l'architettura ogni volta.

## Cos'è questo progetto

**Procedure Hub** — piattaforma interna multi-tenant di Procedure Management
(repository centralizzato di procedure, policy, work instruction, SOP,
template, FAQ aziendali), ispirata a Notion ma su misura per workflow di
approvazione, audit trail e compliance (ISO, GDPR, SOC2). Target: ~200
utenti per tenant, notifiche verso Slack e Google Chat.

Stack: Next.js 14 (App Router) · TypeScript · Prisma · PostgreSQL ·
NextAuth.js · Tiptap · MeiliSearch · Tailwind · Recharts.

## Setup ambiente

```bash
npm install
cp .env.example .env        # compila DATABASE_URL e NEXTAUTH_SECRET
docker compose up -d        # Postgres + MeiliSearch locali
npm run db:migrate
npm run db:seed             # crea tenant "demo" con utenti/dipartimenti/dati di prova
npm run dev
```

Login dopo il seed: tenant `demo`, password `password123`, utenti:
`admin@demo.com` (ADMIN), `compliance@demo.com` (COMPLIANCE_OFFICER),
`editor@demo.com` (DEPARTMENT_OWNER su HR), `viewer@demo.com` (VIEWER su HR).

In locale, apri `http://localhost:3000?tenant=demo` (il query param sostituisce
la risoluzione via subdomain, che non esiste su localhost).

## Comandi utili

| Comando | Cosa fa |
|---|---|
| `npm run dev` | Server di sviluppo |
| `npm run db:studio` | GUI Prisma per ispezionare i dati |
| `npm run db:migrate` | Crea/applica una nuova migration |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Type-check completo |

## Regole architetturali da rispettare sempre

Queste non sono suggerimenti — violarle rompe l'isolamento multi-tenant o
l'audit trail, che sono requisiti hard del progetto (compliance ISO/GDPR).

1. **Ogni query che tocca dati aziendali deve filtrare per `tenantId`**,
   risolto lato server via `lib/tenant.ts` (mai fidarsi di un `tenantId`
   passato dal client).
2. **Ogni azione che cambia stato** (pubblica, approva, rifiuta, archivia,
   elimina, cambia permessi) **deve scrivere una riga in `AuditLog`**.
3. **`ProcedureVersion` è immutabile**: non aggiornare mai una versione
   esistente. Un edit crea sempre una nuova riga con `versionNumber`
   incrementale; `Procedure.currentVersionId` viene ripuntato.
4. **I controlli di permesso passano sempre da `lib/permissions/index.ts`**
   (`canViewProcedure`, `canEditProcedure`, `canPublishProcedure`,
   `canActOnComplianceStage`) — non reimplementare la logica RBAC inline
   nelle route.
5. **Le transizioni di workflow passano da `lib/workflow/index.ts`**
   (`submitForReview`, `decideWorkflowStep`, `archiveProcedure`) — non
   scrivere `procedure.status` a mano altrove.
6. **Le notifiche passano sempre da `notifyEvent()`** in
   `lib/integrations/notify.ts`, mai chiamando `sendSlackNotification` /
   `sendGoogleChatNotification` direttamente da una route — il dispatcher
   gestisce fan-out, preferenze utente e la riga in-app.

## Mappa del codice

```
src/app/
  (auth)/login/              pagina di accesso
  (app)/                     area autenticata (richiede sessione)
    dashboard/                homepage: recenti, preferiti, annunci, scadenze
    departments/[slug]/       lista procedure di un dipartimento
    procedures/[id]/          dettaglio procedura (contenuto, workflow, versioni, ack)
    procedures/[id]/edit/     editor Tiptap
    admin/                    dashboard KPI (solo ADMIN/COMPLIANCE_OFFICER)
  api/
    procedures/                CRUD + submit/decide/archive (workflow)
    departments/                CRUD dipartimenti
    acknowledgments/            Read & Acknowledge
    attachments/                upload/download/delete allegati (presigned URL, lib/storage.ts)
    search/                     proxy verso MeiliSearch
    notifications/              notifiche in-app (lista, mark-as-read)
    admin/kpi/                  dati dashboard amministrativa
    admin/integrations/         config Slack/Google Chat/altre integrazioni
    auth/[...nextauth]/         NextAuth

src/components/
  editor/procedure-editor.tsx   editor Tiptap con toolbar
  procedures/status-stamp.tsx   badge di stato workflow (elemento firma UI)
  procedures/workflow-panel.tsx azioni submit/approve/reject/archive
  procedures/acknowledge-button.tsx
  layout/                       sidebar, topbar, ricerca globale

src/lib/
  permissions/index.ts          RBAC centralizzato — leggi prima di toccare permessi
  workflow/index.ts             pipeline di approvazione
  integrations/notify.ts        dispatcher notifiche multi-canale
  integrations/slack.ts         adapter Slack (webhook + bot mode)
  integrations/gchat.ts         adapter Google Chat (webhook + bot mode)
  tenant.ts                     risoluzione tenant dalla request
  auth.ts                       config NextAuth (Credentials + Azure AD)
  search.ts                     client MeiliSearch

prisma/schema.prisma            modello dati — leggi i commenti inline, spiegano il "perché"
prisma/seed.ts                  dati demo (dipartimenti, utenti, ruoli, una procedura pubblicata)
```

## Cosa è già completo

Multi-tenancy · auth email/password · CRUD procedure con versioning ·
gerarchia Department → Process → Procedure → Work Instruction · workflow di
approvazione con audit trail · RBAC a due livelli · editor ricco · Read &
Acknowledge (con escalation multi-canale e certificato PDF) · notifiche
in-app + Slack/Google Chat (modalità webhook) · ricerca full-text con filtri
· dashboard KPI · tag/template · upload allegati reale (`POST /api/attachments`,
presigned URL S3-compatible, download/delete con stessa RBAC della procedura)
· sync automatico indice di ricerca (pubblicazione, archiviazione ed
eliminazione tengono MeiliSearch coerente entro la stessa richiesta; backfill
con `scripts/reindex.ts`) · cron reminder di revisione periodica
(`GET /api/cron/review-reminders`, `vercel.json`, idempotente su
`Procedure.reviewReminderSentAt`; equivalente manuale
`scripts/send-review-reminders.ts`).

## Roadmap — prossimi task, in ordine di priorità

Quando l'utente chiede "cosa manca" o "continua lo sviluppo", proponi questi
nell'ordine indicato — sono ordinati per impatto su un rollout reale a 200
utenti, non per difficoltà tecnica.

1. **OAuth Slack App / Google Chat App**: per DM personalizzate (oggi
   funziona solo la modalità webhook, condivisa su un canale). Serve
   registrare le app sulle rispettive piattaforme e implementare
   `/api/notifications/slack/oauth` + equivalente Google, popolando
   `SlackUserIdentity`/`GoogleChatUserIdentity`.
2. **Attivazione Microsoft Entra ID SSO**: `AzureADProvider` già presente in
   `lib/auth.ts`, basta valorizzare `AZURE_AD_CLIENT_ID/SECRET/TENANT_ID` e
   testare il consenso admin sul tenant Azure del cliente.
3. **Teams / SharePoint / Jira / Freshdesk / ServiceNow**: `Integration.type`
   li prevede già nello schema; ogni adapter segue lo stesso pattern di
   `lib/integrations/slack.ts`.
4. **Export PDF/Word/Excel** dalla pagina procedura (diverso dal certificato
   PDF di Read & Acknowledge, già presente: qui si tratta di esportare il
   contenuto stesso della procedura).
5. **Diff view tra versioni**: `ProcedureVersion` ha già lo storico
   completo, manca la UI che confronta due versioni selezionate.
6. **Test automatici**: nessuno presente ancora. Partire dai flussi critici
   (workflow di approvazione, permessi, versioning) con Vitest/Playwright.

Nota: molto lavoro oltre questa lista è stato fatto seguendo `New plan/` (motore
a blocchi, Database, ruoli/mansioni, AI Q&A e Suggest Mode — vedi
`New plan/00-INDEX.md`) e non era ancora riflesso qui. Se una voce sopra
risulta già implementata quando la leggi, verifica nel codice prima di
riproporla: questa lista si disallinea facilmente da sessione a sessione.

## Direzione visiva (se estendi la UI)

**Attenzione**: questa sezione descriveva in origine una palette ink/paper
mai più vera nel codice — vedi la nota storica in `docs/DESIGN.md`. Stato
attuale: superfici bianche, blu segnale `#2383E2` per azioni primarie, ambra
per stati in approvazione, verde per pubblicato — tutti come CSS variable in
`src/app/globals.css`. Inter per tutto (titoli inclusi, `--font-display`
mappa su Inter, non su un serif), IBM Plex Mono riservato ai codici procedura
e al testo dentro `StatusStamp`. Componenti UI su shadcn/ui
(`src/components/ui/`, sopra i primitivi Radix già in uso) — nuovi
componenti passano da lì, non da markup Radix scritto a mano. Il
`StatusStamp` resta l'unico elemento "audace" (timbro di approvazione);
mantieni il resto disciplinato. Dettagli completi in `docs/DESIGN.md`.

## Riferimenti

- `docs/ARCHITECTURE.md` — spiegazione estesa delle scelte architetturali
- `docs/DESIGN.md` — rationale della direzione visiva
- `README.md` — quick start e struttura cartelle
