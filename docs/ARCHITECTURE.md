# Architettura — Procedure Hub

Questo documento descrive le scelte architetturali e cosa è già implementato
vs cosa resta da collegare. È pensato per essere letto da Claude Code prima
di continuare lo sviluppo.

## Stack

| Livello | Scelta | Perché |
|---|---|---|
| Framework | Next.js 14 (App Router) | Server Components per data-fetching sicuro lato server, API routes per il backend, un solo deploy |
| Database | PostgreSQL + Prisma | Relazionale, forte tipizzazione, gestisce bene gerarchie e vincoli multi-tenant |
| Auth | NextAuth.js (JWT) | Supporta Credentials oggi, Azure AD (Entra ID) pronto ma disattivato finché non configurato |
| Ricerca | MeiliSearch | Self-hostable, typo-tolerant, sufficiente per ~migliaia di documenti / 200 utenti senza l'overhead operativo di Elasticsearch |
| Editor | Tiptap (ProseMirror) | Editor "stile Notion": testo, immagini, tabelle, checklist, video, drag&drop |
| Notifiche | Dispatcher centrale (`lib/integrations/notify.ts`) | Fan-out a in-app + Slack + Google Chat, ogni canale è un adapter intercambiabile |
| Grafici | Recharts | Dashboard KPI amministrativa |

## Multi-tenancy

Strategia: **subdomain-based**, un tenant = un'azienda cliente.

- `middleware.ts` estrae lo slug del tenant dal subdomain (`acme.procedurehub.com` → `acme`) e lo inietta come header `x-tenant-slug`.
- `lib/tenant.ts` risolve il record `Tenant` da quell'header — va sempre chiamato lato server, mai fidarsi di un `tenantId` passato dal client.
- **Ogni** modello che contiene dati aziendali ha una colonna `tenantId` con foreign key e viene sempre filtrato per essa nelle query. Questo è applicato manualmente nel codice attuale (Prisma non ha row-level security nativo) — se il progetto scala, valutare Postgres RLS come seconda barriera.
- In sviluppo locale, `localhost:3000?tenant=demo` sostituisce il subdomain.

## Modello dati (prisma/schema.prisma)

Punti chiave da conoscere prima di estendere lo schema:

- **Gerarchia contenuti**: `Department → Process (self-referenziale, nesting arbitrario) → Procedure → Procedure (figlie, per le Work Instructions)`.
- **Versioning**: `Procedure` non contiene mai il contenuto direttamente. Ogni versione è una riga immutabile in `ProcedureVersion`; `Procedure.currentVersionId` punta alla versione "live". Modificare una procedura pubblicata crea una nuova versione e riporta lo stato a `DRAFT` — i lettori continuano a vedere l'ultima versione pubblicata finché la nuova non viene ri-approvata (vedi `PATCH /api/procedures/[id]`).
- **RBAC a due livelli**: `GlobalRole` (ADMIN / COMPLIANCE_OFFICER / USER) è tenant-wide; `DepartmentRole` (VIEWER / EDITOR / DEPARTMENT_OWNER) è per dipartimento tramite `DepartmentMembership`. Tutta la logica vive in `lib/permissions/index.ts` — non duplicare i controlli altrove.
- **Workflow**: `lib/workflow/index.ts` implementa la pipeline Draft → Review → Compliance Approval → Management Approval → Published → Archived. Lo step di Compliance Approval viene saltato automaticamente per contenuti non critici e senza tag di compliance (GDPR/ISO/SOC2/Mandatory) — vedi `resolveNextStage()`.
- **Read & Acknowledge**: `Acknowledgment` è univoco per `(procedureId, userId, versionNumber)` — una nuova versione richiede una nuova conferma, questo è ciò che rende l'audit trail utile per ISO/SOC2.
- **Audit trail**: `AuditLog` registra ogni azione rilevante (create/update/publish/archive/approve/reject/acknowledge/...). Non cancellare mai righe di audit.

## Notifiche multi-canale

`lib/integrations/notify.ts` è il punto di ingresso unico: crea sempre una riga `Notification` in-app, poi controlla se il tenant ha integrazioni Slack/Google Chat abilitate e le preferenze dell'utente, e fa il fan-out.

- `lib/integrations/slack.ts` e `lib/integrations/gchat.ts` supportano entrambi due modalità:
  1. **Webhook** (consigliata per iniziare): un URL webhook per canale/spazio, configurabile da `/admin` senza bisogno di un'app Slack/Google registrata.
  2. **Bot/App** (per DM a singoli utenti): richiede la registrazione di un'app Slack o Google Chat, OAuth per collegare `SlackUserIdentity`/`GoogleChatUserIdentity` a ogni utente. Gli endpoint OAuth non sono ancora scaffoldati — vedi roadmap sotto.

## Cosa è implementato end-to-end

- Multi-tenancy con isolamento dati
- Autenticazione email/password (NextAuth Credentials)
- CRUD procedure con versioning immutabile
- Gerarchia Department → Process → Procedure → Work Instruction
- Workflow di approvazione completo con audit trail
- RBAC a due livelli (globale + per dipartimento)
- Editor ricco (testo, immagini, tabelle, checklist, video embed)
- Read & Acknowledge con storico per utente/versione
- Notifiche in-app + adapter Slack/Google Chat (modalità webhook pronta all'uso)
- Ricerca full-text (MeiliSearch) con filtri per dipartimento/tipo/tag
- Dashboard KPI amministrativa
- Tag, template, allegati (modello dati pronto, upload UI da completare)

## Roadmap — cosa manca / prossimi passi consigliati

In ordine di priorità realistica per un rollout a 200 utenti:

1. **Upload allegati reale**: il modello `Attachment` esiste ma manca l'endpoint di upload verso object storage (S3/Azure Blob/GCS — variabili già in `.env.example`). Aggiungere `POST /api/attachments` con presigned URL.
2. **Sync indice di ricerca**: attualmente `lib/search.ts` espone le funzioni di indicizzazione ma nessuna route le chiama automaticamente. Agganciare `indexProcedure()` dentro `submitForReview`/pubblicazione, e un job di backfill iniziale (`scripts/reindex.ts`).
3. **Job di reminder periodici**: le notifiche di "revisione in scadenza" richiedono un cron (Vercel Cron / node-cron) che interroghi `nextReviewDate` giornalmente e chiami `notifyEvent`.
4. **OAuth Slack App / Google Chat App**: per la modalità "bot" con DM personalizzate serve registrare le app sulle rispettive piattaforme e implementare `/api/notifications/slack/oauth` e l'equivalente Google.
5. **Microsoft Entra ID SSO**: `AzureADProvider` è già in `lib/auth.ts`, basta valorizzare le tre variabili d'ambiente e testare il consenso admin nel tenant Azure del cliente.
6. **Microsoft Teams / SharePoint / Jira / Freshdesk / ServiceNow**: nel modello `Integration.type` sono già previsti; implementare un adapter per ciascuno seguendo lo stesso pattern di `slack.ts`.
7. **AI Search in linguaggio naturale** (requisito opzionale #25): endpoint che passa la query utente + risultati MeiliSearch a un LLM per sintetizzare una risposta con citazione delle procedure pertinenti.
8. **Export PDF/Word/Excel**: bottone "Esporta" nella pagina procedura — generare PDF da `contentHtml` (es. Puppeteer/Playwright) o DOCX (libreria `docx`, vedi skill `docx` del repository se sviluppato con Claude).
9. **Confronto versioni (diff view)**: `ProcedureVersion` ha già tutto lo storico; manca la UI che mostra il diff testuale tra due versioni selezionate.
10. **Test automatici**: nessun test è incluso in questo scaffold iniziale — aggiungere Vitest/Playwright a partire dai flussi critici (workflow di approvazione, permessi, versioning).

## Convenzioni per chi continua lo sviluppo

- Ogni nuova query che tocca dati aziendali deve filtrare per `tenantId` risolto lato server.
- Ogni azione che cambia stato (pubblica, approva, archivia, elimina) deve scrivere una riga `AuditLog`.
- Non modificare mai `ProcedureVersion` esistenti: sono immutabili by design.
- I controlli di permesso vanno sempre tramite `lib/permissions`, mai reimplementati inline nelle route.
