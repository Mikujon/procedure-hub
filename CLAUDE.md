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
7. **Le automazioni (`src/lib/automations/`) non ottengono un'azione
   "avanza/pubblica stato" generica** — solo `CHANGE_PROCEDURE_STATUS` verso
   `ARCHIVED`. `resolveNextStage()` già pubblica automaticamente una
   procedura non critica dopo l'approvazione management; una regola che
   cambiasse stato in parallelo bypasserebbe uno stage di compliance senza
   una decisione umana dietro. Se serve un'azione che cambia stato di
   approvazione, va disegnata come cambio a `resolveNextStage()` stesso,
   non come nuovo `AutomationActionType`.

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
  blocks/block-editor.tsx       editor a blocchi stile Notion (motore corrente, vedi New plan/01)
  editor/procedure-editor.tsx   editor Tiptap con toolbar (precedente al motore a blocchi)
  procedures/status-stamp.tsx   badge di stato workflow (elemento firma UI)
  procedures/workflow-panel.tsx azioni submit/approve/reject/archive
  procedures/acknowledge-button.tsx
  layout/                       sidebar, topbar, ricerca globale

src/lib/
  permissions/index.ts          RBAC centralizzato — leggi prima di toccare permessi
  workflow/index.ts             pipeline di approvazione
  automations/                  motore automazioni (trigger → condizione → azione), vedi regola 7
  integrations/notify.ts        dispatcher notifiche multi-canale
  integrations/slack.ts         adapter Slack (webhook + bot mode)
  integrations/gchat.ts         adapter Google Chat (webhook + bot mode)
  tenant.ts                     risoluzione tenant dalla request
  auth.ts                       config NextAuth (Credentials + Azure AD, con signIn callback per il match/provisioning utenti SSO)
  search.ts                     client MeiliSearch

prisma/schema.prisma            modello dati — leggi i commenti inline, spiegano il "perché"
prisma/seed.ts                  dati demo (dipartimenti, utenti, ruoli, una procedura pubblicata)
```

## Cosa è già completo

*Aggiornato 19 ago 2026. Voce dopo voce, non fidarti di questa lista più
del codice/UI reali — la cronologia sotto mostra quanto spesso questo file
si è disallineato in passato.*

**19 ago 2026**: provisioning utenti reale (`POST /api/admin/users`,
password temporanea + `mustChangePassword`, non più solo `prisma/seed.ts`)
· SSO Microsoft Entra ID funzionante lato codice (`signIn` callback in
`lib/auth.ts` risolve tenant e fa match/provisioning, bottone "Accedi con
Microsoft" condizionale) — non ancora verificato con un vero tenant Azure,
vedi `docs/SSO-ENTRA-ID-SETUP.md` · nuova identità visiva "Control Room"
(vedi sezione sotto) con dark mode reale attivabile (`next-themes`, toggle
nel topbar) · motore di automazioni nei workflow (`src/lib/automations/`,
regola architetturale 7) con UI admin in `/admin/automations`.

Multi-tenancy · auth email/password · CRUD procedure con versioning ·
gerarchia Department → Process → Procedure → Work Instruction · workflow di
approvazione con audit trail · RBAC a due livelli · Read &
Acknowledge (con escalation multi-canale e certificato PDF) · notifiche
in-app + Slack/Google Chat (modalità webhook) · ricerca full-text con filtri
· dashboard KPI · tag/template · upload allegati reale (`POST /api/attachments`,
presigned URL S3-compatible, download/delete con stessa RBAC della procedura)
· sync automatico indice di ricerca (pubblicazione, archiviazione ed
eliminazione tengono MeiliSearch coerente entro la stessa richiesta; backfill
con `scripts/reindex.ts`) · cron reminder di revisione periodica
(`GET /api/cron/review-reminders`, `vercel.json`, idempotente su
`Procedure.reviewReminderSentAt`; equivalente manuale
`scripts/send-review-reminders.ts`) · rate limiting su login/AI/quick-confirm
(`lib/rate-limit.ts`, fail-open su Redis irraggiungibile).

Oltre questo, dal lavoro seguito in `New plan/` (vedi `New plan/00-INDEX.md`):
motore a blocchi (editor stile Notion, `src/components/blocks/`, sostituisce
l'editor Tiptap "semplice" descritto in versioni precedenti di questo file)
· collaborazione realtime multi-utente (Hocuspocus/Yjs, `collab-server/`)
· export PDF/DOCX/XLSX del contenuto procedura (`lib/export/`, bottone
"Esporta" nella pagina procedura) · confronto/diff tra versioni
(`procedures/[id]/versions/compare`) · AI: Q&A grounded con citazione fonte
(`/ask`), Suggest Mode, executive summary, gap analysis (Gemini,
`lib/ai/client.ts`) · gestione mansioni/ruoli (Job Role) · databases
relazionali in-app (`src/components/databases/`) · OAuth "Sign in with
Slack" per DM personalizzate (`/api/notifications/slack/oauth`,
`SlackUserIdentity`) — funzionante lato codice, manca solo la registrazione
dell'app su Slack (`SLACK_CLIENT_ID`/`SLACK_CLIENT_SECRET`) per attivarla.

Parziale: autenticazione service-account Google Workspace
(`lib/integrations/google-auth.ts`) — il token exchange OAuth2 è implementato,
ma l'invio effettivo del messaggio come DM bot (creazione/ricerca dello
spazio Chat) è deliberatamente lasciato un TODO in `gchat.ts` finché non è
verificabile contro un Workspace reale (solo la modalità webhook è
end-to-end oggi).

## Roadmap — prossimi task, in ordine di priorità

Quando l'utente chiede "cosa manca" o "continua lo sviluppo", proponi questi
nell'ordine indicato — sono ordinati per impatto su un rollout reale a 200
utenti, non per difficoltà tecnica.

1. **Verifica SSO Entra ID con un vero tenant Azure**: il codice funziona
   (verificato il 18-19 ago 2026: bottone condizionale, richiesta raggiunge
   davvero gli endpoint Microsoft), ma il `signIn` callback che fa match/
   provisioning dell'utente non è mai stato eseguito contro un login reale
   — vedi `docs/SSO-ENTRA-ID-SETUP.md` per i passaggi e i limiti noti (un
   solo tenant Azure supportato, test end-to-end non possibile su
   `localhost`).
2. **Registrazione app Slack** (`SLACK_CLIENT_ID`/`SLACK_CLIENT_SECRET`):
   il flusso OAuth "Sign in with Slack" per DM personalizzate è già
   implementato lato codice (`/api/notifications/slack/oauth`,
   `SlackUserIdentity`) — resta solo da registrare l'app su Slack e
   verificare end-to-end.
3. **Invio DM Google Chat**: il token exchange OAuth2 service-account esiste
   (`lib/integrations/google-auth.ts`), ma la chiamata reale che trova/crea
   lo spazio DM e posta il messaggio è un TODO esplicito in `gchat.ts` —
   verificarne il comportamento contro un Workspace reale prima di
   completarla (solo la modalità webhook è end-to-end oggi).
4. **Migrare review-reminders/ack-escalation sul motore di automazioni**:
   deliberatamente non fatto il 19 ago 2026 quando è stato introdotto il
   motore — `lib/review-reminders.ts` e `lib/ack.ts` restano il percorso
   reale finché il motore nuovo non ha girato un ciclo di produzione senza
   incidenti (conseguenze di compliance reali se si rompono).
5. **Teams / SharePoint / Jira / Freshdesk / ServiceNow**: `Integration.type`
   li prevede già nello schema; ogni adapter segue lo stesso pattern di
   `lib/integrations/slack.ts`.
6. **Test automatici**: nessuno presente ancora (solo dipendenze in
   `node_modules` hanno test propri). Partire dai flussi critici (workflow
   di approvazione, permessi, versioning, motore di automazioni) con
   Vitest/Playwright.

~~Export PDF/Word/Excel dalla pagina procedura~~ e ~~diff view tra
versioni~~ risultavano qui come roadmap futura in versioni precedenti di
questo file, ma sono già implementate e funzionanti (bottoni "Esporta" e
"Confronta versioni selezionate" sulla pagina procedura) — rimosse dalla
lista il 18 ago 2026 dopo verifica diretta in UI, non solo nel codice.

Nota: questa lista si disallinea facilmente dal codice reale da sessione a
sessione (vedi cronologia sopra). Se una voce risulta già implementata
quando la leggi, verificalo in UI oltre che nel codice prima di riproporla —
un bottone può esistere senza essere mai stato controllato che funzioni, e
viceversa il codice può esistere senza essere raggiungibile da nessuna
pagina.

**Piano attivo in esecuzione** (19 ago 2026): identità visiva in
profondità → gap feature vs Notion/leader → automazioni più ricche, in
questo ordine. Stato dettagliato (cosa è già fatto e verificato, cosa
resta, file per file) in
[`docs/REDESIGN-FEATURE-AUTOMATION-PLAN.md`](docs/REDESIGN-FEATURE-AUTOMATION-PLAN.md)
— se riprendi questo lavoro (anche in una sessione/licenza diversa), parti
da lì invece che da questa lista generale.

## Direzione visiva (se estendi la UI)

**Terza direzione visiva del progetto** (dopo ink/paper e Notion-blu — vedi
nota storica in `docs/DESIGN.md`): **"Control Room"**, introdotta il 19 ago
2026. Non un altro clone di Notion — il registro operativo delle procedure
aziendali, letto come un pannello di controllo: precisione invece di
decorazione, un solo colore-segnale distinto dai colori di stato.

- **Colore**: superficie "carta fredda" (`--background: 180 12% 97%`, non
  crema), accento teal-cyan `--primary: 186 78% 32%` — **mai** riusato come
  colore di stato. Ambra/verde restano gli stati di workflow
  (`--stamp-amber`/`--stamp-green`, invariati), rosso resta `--destructive`.
  Dark mode reale e attivabile (non più solo teorico): `next-themes`,
  toggle chiaro/scuro/sistema nel topbar (`ThemeToggle` in
  `components/layout/topbar.tsx`).
- **Tipografia**: Archivo per i titoli (`--font-display`, sostituisce
  Inter — carattere tecnico/condensato, cross-platform a differenza di
  Bahnschrift usato nel concept pitch), Inter per il corpo, IBM Plex Mono
  per codici procedura e `StatusStamp` (invariato).
- **Movimento**: quattro primitive in `globals.css`
  (`pill-settle`/`rise`/`pulse-ring`/`scan-sweep`, esposte anche come
  animazioni Tailwind), ognuna legata a un evento reale del prodotto
  (cambio di stato, liste che compaiono in sequenza, contatori KPI,
  ricerca in corso) — non decorazione sparsa. Tutte rispettano
  `prefers-reduced-motion`. Applicate finora a chrome (sidebar/topbar),
  `StatusStamp`, dashboard, KPI admin, pagina procedura, ricerca — non
  ancora a tutte le 17 pagine, per scelta deliberata (un tocco orchestrato
  batte cento effetti sparsi), non per dimenticanza.
- Componenti UI restano su shadcn/ui (`src/components/ui/`) — nuovi
  componenti passano da lì. `StatusStamp` resta l'unico elemento "audace"
  (timbro di approvazione, ora con un piccolo rimbalzo all'ingresso);
  mantieni il resto disciplinato.

Dettagli completi (inclusa la palette/mockup originale del concept) in
`docs/DESIGN.md`.

## Riferimenti

- `docs/ARCHITECTURE.md` — spiegazione estesa delle scelte architetturali
- `docs/DESIGN.md` — rationale della direzione visiva
- `docs/REDESIGN-FEATURE-AUTOMATION-PLAN.md` — piano attivo (identità
  visiva → gap feature → automazioni), stato dettagliato di cosa è fatto
  e cosa resta
- `README.md` — quick start e struttura cartelle
