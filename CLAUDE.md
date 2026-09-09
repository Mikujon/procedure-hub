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
| `npm test` | Test automatici (Vitest, vedi sotto) |

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
    departments/[slug]/       alberatura Processo → Procedura → Istruzione di Lavoro del dipartimento
    procedures/[id]/          dettaglio procedura (contenuto, workflow, versioni, ack)
    procedures/[id]/edit/     editor Tiptap
    admin/                    dashboard KPI (solo ADMIN/COMPLIANCE_OFFICER)
  api/
    procedures/                CRUD + submit/decide/archive (workflow); procedures/[id]/location = lookup minimo per l'auto-reveal della sidebar
    departments/                CRUD dipartimenti; departments/[id]/tree = dati piatti Processi+Procedure per DepartmentTree
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
  procedures/procedure-breadcrumb.tsx  breadcrumb con dropdown "salta ai fratelli" a ogni livello
  layout/                       sidebar, topbar, ricerca globale
  layout/page-tree.tsx           alberatura Workspace (Pagine/Database), stile Notion — pattern originale
  layout/department-tree.tsx     alberatura Processo → Procedura → Istruzione di Lavoro, stesso pattern di page-tree.tsx; riusata sia in sidebar.tsx (lazy, un dipartimento alla volta) sia in departments/[slug]/page.tsx (sempre caricata)

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

*Aggiornato 24 ago 2026. Voce dopo voce, non fidarti di questa lista più
del codice/UI reali — la cronologia sotto mostra quanto spesso questo file
si è disallineato in passato.*

**9 set 2026**: Roadmap #4 — `lib/review-reminders.ts` e
`scripts/send-ack-reminders.ts` migrati sul motore di automazioni,
**su richiesta esplicita di procedere subito**: la voce era stata
deliberatamente rimandata il 19 ago 2026 finché il motore non avesse
girato "un ciclo di produzione senza incidenti" — un criterio che questo
sandbox, senza traffico di produzione reale, non può mai soddisfare da
solo; a chi ha chiesto come procedere sono state offerte alternative
(aspettare credenziali reali per gli item #1-3, un audit più ampio,
altro) e la scelta di procedere comunque con #4 è stata dell'utente, non
un giudizio autonomo di Claude che ha sovrascritto il rimando.

**Il problema reale del "migrare"**: questi due percorsi non erano mai
stati configurabili da admin — ogni tenant li otteneva automaticamente,
zero `AutomationRule` da creare. Spegnere il codice vecchio e dire
"createvi la regola equivalente" avrebbe fatto sparire in silenzio i
promemoria di revisione e l'escalation Read & Acknowledge per ogni
tenant che non lo fa proattivamente — esattamente il rischio di
compliance per cui il rimando esisteva. Soluzione: nuovo
`lib/automations/defaults.ts` (`ensureDefaultAutomationRules`) crea
quattro regole predefinite per tenant se non esiste già l'equivalente
(stesso trigger/azione, e per le tre `ACK_CAMPAIGN_AGE` anche stesso
`days` — non un nome, un admin che rinomina una regola non deve farne
comparire una seconda al prossimo giro) — chiamato da
`scripts/ensure-default-automations.ts` (backfill, idempotente, non
c'è un flusso self-service di creazione tenant in questo codebase da
agganciare automaticamente) e ora anche da `prisma/seed.ts`, così un
ambiente nuovo parte già corretto. Il comportamento pre-esistente resta
identico zero-configurazione, ma ora è una vera `AutomationRule`
visibile/disattivabile/modificabile in `/admin/automations` — mai stato
possibile prima.

**Le quattro regole**: `REVIEW_DATE_DUE` → `SEND_NOTIFICATION`
(destinatario `OWNER`, replica `sendReviewReminders()`); tre
`ACK_CAMPAIGN_AGE` a 3/7/14 giorni. A 3 e 7 giorni →
`SEND_NOTIFICATION` con un destinatario nuovo, `ACK_OUTSTANDING` (solo
chi non ha ancora confermato — prima irraggiungibile dall'azione
generica, che sapeva solo risolvere proprietario/dipartimento/tenant) —
7 giorni con fan-out esterno (Slack/Google Chat/Teams), 3 giorni solo
in-app, stessa distinzione dello script originale, resa possibile da un
nuovo `externalChannels` opzionale su `SendNotificationConfig` (prima
sempre `true`, senza modo di scegliere). A 14 giorni → nuovo
`AutomationActionType.ESCALATE_ACK_TO_MANAGERS` (nuova migration): non
esprimibile come `SEND_NOTIFICATION`, che risolve *un* insieme di
destinatari e manda *un* messaggio — questo raggruppa chi non ha ancora
confermato per il proprio manager (fallback: proprietario della
procedura) e manda un messaggio distinto a ciascun manager, una forma
di azione diversa, non solo un destinatario diverso. Permesso dalla
regola architetturale 7 (che blocca solo un'azione generica "avanza/
pubblica stato", non nuove azioni di notifica).

**Bug reale trovato ricostruendo `runAckCampaignAgeRule` per
agganciarci questo lavoro, non introdotto da esso**: il suo `fireKey`
era `String(days)` — una stringa costante per ogni esecuzione della
stessa regola, indipendente da *quale* campagna. Con
`@@unique([ruleId, entityId, fireKey])` e `entityId` = id procedura,
questo significava che una regola poteva scattare **una sola volta per
procedura, per sempre**: una volta che una prima `AckCampaign` per la
procedura X avesse fatto scattare la regola "14 giorni", **nessuna**
`AckCampaign` futura per quella stessa procedura (es. dopo una
ripubblicazione che richiede una nuova conferma) avrebbe mai potuto
farla scattare di nuovo. Corretto: `fireKey` ed `entityId` ora sono
l'id della campagna stessa, non la procedura — ogni campagna ha il
proprio slot di dedup, una nuova campagna per la stessa procedura parte
pulita. Toccata anche una lacuna adiacente: `runAckCampaignAgeRule` non
calcolava affatto chi fosse ancora "outstanding" (mancante la
conferma) — lo fa ora, escludendo chi ha già confermato, e salta del
tutto lo scatto se non resta nessuno (difensivo: `maybeCompleteCampaign`
dovrebbe già aver chiuso quella campagna).

**Nuovo**: placeholder `{{procedureTitle}}` in titolo/messaggio di
`SEND_NOTIFICATION` — sostituzione di stringa, non un motore di
template. Prima di questo, ogni regola `SEND_NOTIFICATION` mandava un
titolo fisso identico per ogni procedura che la faceva scattare, bene
per una regola-annuncio isolata (es. "Avvisa il DPO quando serve
approvazione compliance", un solo evento, l'utente apre e vede i
dettagli) ma non per un promemoria ricorrente su *molte* procedure
diverse, dove titoli indistinguibili nell'elenco notifiche vanificano
lo scopo — esattamente il caso dei promemoria di revisione/ACK appena
migrati, che prima avevano un titolo dinamico costruito a mano
(`"${title}" è in scadenza...`) e lo avrebbero perso migrando
sull'azione generica senza questo. `AckReminder` (stage DAY_3/7/14) non
viene più scritto da questo percorso — `AutomationRun` (già visibile
nello storico esecuzioni di `/admin/automations`, Traccia 3.1) è ora
la fonte di verità su cosa è scattato quando; `AckReminderStage` con
solo `INITIAL` resta in uso (scritto da `lib/ack.ts`, non toccato).

`vercel.json`: rimossa la voce cron dedicata (`/api/cron/review-reminders`,
giornaliera) — `/api/cron/automations` (oraria, già esistente) ora è
l'unico cron time-based, comprese le quattro regole predefinite.
`scripts/dev-cron.ts` semplificato di conseguenza.

21 nuovi test (`tests/automations-ack-migration.test.ts`): il fix del
bug `fireKey` (due campagne separate sulla stessa procedura scattano
entrambe in modo indipendente), skip quando nessuno è più outstanding,
risoluzione `ACK_OUTSTANDING` (incluso lo skip silenzioso — nessuna
eccezione, nessun destinatario — se una regola viene configurata per
sbaglio su un trigger diverso da `ACK_CAMPAIGN_AGE`), il placeholder
`{{procedureTitle}}`, `ESCALATE_ACK_TO_MANAGERS` (raggruppamento per
manager e fallback a proprietario), e `ensureDefaultAutomationRules`
(crea le quattro al primo giro, no-op al secondo, non duplica una
regola equivalente già esistente con nome diverso, distingue le tre
regole `ACK_CAMPAIGN_AGE` per `days` e non solo per trigger/azione).
Una particolarità trovata scrivendo questi test, non nel codice sotto
test: `runTimeBasedAutomations()` scansiona ogni regola abilitata
dell'intero tenant, quindi condividere un tenant fisso tra più test che
creano ciascuno una propria regola "days=3" fa scattare *tutte* quelle
regole sulla stessa campagna, moltiplicando le notifiche attese — non
un bug del motore (un admin che crea davvero due regole identiche
vedrebbe lo stesso comportamento, corretto), ma un problema di
isolamento tra test, risolto dando a ogni test in questo file un
proprio tenant di scarto invece di condividerne uno con `beforeAll`.

**Verificato dal vivo** oltre ai test, contro il tenant demo reale:
`scripts/ensure-default-automations.ts` ha creato le quattro regole
(verificato idempotente su un secondo giro, e su un terzo giro dentro
`npm run db:seed` risemminato), poi una procedura di scarto pubblicata
con `nextReviewDate` nel passato più una `AckCampaign` di scarto aperta
20 giorni fa (destinatari `viewer@demo.com` — con manager impostato
temporaneamente su `editor@demo.com` — ed `editor@demo.com`, senza
manager) sottoposte a un vero `GET /api/cron/automations`: tutte e
quattro le regole hanno scattato con `status: SUCCESS`, le notifiche
reali create hanno il titolo templato correttamente
(`"..." è in scadenza di revisione`), i promemoria a 3/7 giorni sono
arrivati a entrambi gli outstanding, e l'escalation a 14 giorni ha
prodotto esattamente due messaggi distinti — uno a `editor@demo.com`
("Vittorio Viewer" nel corpo, il suo riporto) e uno ad `admin@demo.com`
(proprietario della procedura, fallback per `editor@demo.com` che non
ha un manager) — non uno generico a tutti. Un secondo giro dello stesso
endpoint ha rieseguito le quattro regole senza creare notifiche
duplicate (dedup reale via `AutomationRun`, non solo nei test). `npx
tsc --noEmit` pulito, `npm test` 142/142. Dati di scarto rimossi
(procedura, campagna, notifiche generate durante la verifica,
`managerId` temporaneo ripristinato a `null`) — le quattro regole
predefinite sul tenant demo restano, per scelta: non sono dati di
scarto, sono il comportamento di produzione atteso da qui in avanti.

**2 set 2026**: Roadmap #5 — integrazione SharePoint, l'ultimo dei
cinque provider rimasti e l'unico per cui serviva davvero un disegno
proprio (non un canale di notifica come Slack/Teams/Google Chat, non
sbloccabile con il webhook generico come Jira/ServiceNow/Freshdesk): è
storage documentale via Microsoft Graph, con un flusso OAuth2 diverso da
tutti gli altri. Nuovo `Integration.type = SHAREPOINT`, `config = {
azureTenantId, clientId, clientSecret, siteId, drivePath }` — una
seconda app registration Azure AD, distinta da quella SSO già esistente
in `lib/auth.ts` (`AZURE_AD_CLIENT_ID`/ecc., permessi delegati,
un'app per l'intero deployment): questa serve il permesso applicativo
`Sites.ReadWrite.All` con consenso admin, configurata per-tenant come
Slack/Google Chat/Teams già sono. `lib/integrations/sharepoint-auth.ts`:
OAuth2 client-credentials verso l'endpoint token di Azure AD (stesso
pattern RFC-standard di `google-auth.ts`, solo grant type diverso).
`lib/integrations/sharepoint.ts`: `PUT` diretto su
`/sites/{siteId}/drive/root:/{path}:/content` (upload semplice, fino a
4MB — sufficiente per qualunque export PDF di una procedura; sopra
quella soglia Graph richiede una upload session a chunk, non
implementata, nessun export si è mai avvicinato a quella dimensione).
`lib/sharepoint-sync.ts` orchestra il tutto dietro un'unica funzione
testabile: richiede `canEditProcedure` (stessa soglia di autorità di un
allegato, non una semplice visualizzazione), sincronizza solo contenuto
già `PUBLISHED` (stessa regola di `syncSearchIndex` per MeiliSearch,
applicata a un secondo sistema esterno), genera il PDF con lo stesso
`generateProcedurePdf` dell'export manuale, e scrive un `AuditLog` con
`action: EXPORT` (mai usata finora in questo codebase — nemmeno il
bottone "Esporta" manuale la scrive, una lacuna pre-esistente notata ma
non corretta qui, fuori scope). Bottone "SharePoint" sulla pagina
procedura (`sharepoint-sync-button.tsx`), visibile solo se procedura
pubblicata, utente con diritti di modifica, e integrazione abilitata per
il tenant. **Bug reale trovato scrivendo la verifica dal vivo**: la
route `POST .../sync-sharepoint` non aveva alcun try/catch attorno alla
chiamata reale a Graph — un fallimento del token exchange o dell'upload
sarebbe propagato come eccezione non gestita fino a un 500 generico di
Next.js, senza messaggio utile per il toast del bottone (a differenza di
`executeSendWebhook`, che rilancia deliberatamente l'errore ma lo fa
dentro un motore che lo cattura già a un livello più alto, in
`AutomationRun.error`— qui non c'era un livello più alto ad
intercettarlo). Corretto avvolgendo la chiamata nella route con un
try/catch che restituisce un JSON pulito con `status: 502`. 15 nuovi
test (`tests/sharepoint.test.ts`, `tests/sharepoint-sync.test.ts` —
`fetch` mockato per l'adapter Graph, DB reale per permessi/stato/PDF).
**Verificato anche dal vivo in modo insolitamente concreto per
un'integrazione non completabile in questo sandbox**: `login.microsoftonline.com`
si è rivelato raggiungibile attraverso il proxy di questo ambiente (a
differenza di, ad esempio, `dl.min.io` per MinIO) — una regola creata
con credenziali finte ma sintatticamente plausibili ha prodotto due
risposte reali e diverse da Azure AD (`AADSTS900021` per un GUID tenant
non valido, `AADSTS53003` per una Conditional Access policy su un tenant
Microsoft reale e noto pubblicamente), entrambe propagate correttamente
come 502 con messaggio leggibile — non solo un mock locale come per
Teams, ma il servizio Microsoft reale, anche se senza un'app
registration reale non si può arrivare a un upload riuscito. Verificato
anche il percorso di permessi puro (`no_content` su una procedura DRAFT,
`forbidden` per `viewer@demo.com`, `not_configured` senza
integrazione), che non tocca Graph affatto. `npx tsc --noEmit` pulito,
`npm test` 132/132. Dati di scarto rimossi (procedura, integrazione —
la `DELETE` procedura con lo stesso 500 innocuo di MeiliSearch non
raggiungibile già documentato altrove).

**25 ago 2026 (5)**: Roadmap #6 — Playwright introdotto (ultimo pezzo
mancante dell'item), `e2e/` con 7 test su 3 file (`login.spec.ts`,
`search-visibility.spec.ts`, `dashboard-visibility.spec.ts`), fixture
dedicata (`e2e/helpers/fixtures.ts`, tenant di scarto isolato con utenti
con password reali — separata da `tests/helpers/test-tenant.ts`, i cui
utenti non hanno `passwordHash` perché quei test chiamano funzioni
`lib/` direttamente e non fanno mai un login reale). Browser Chromium
pre-installato in questo sandbox su una cache path fissa
(`/opt/pw-browsers`) non allineata alla versione di `@playwright/test`
appena installata: `playwright.config.ts` legge un
`PLAYWRIGHT_CHROMIUM_PATH` opzionale (non impostato di default, quindi
innocuo su qualunque altra macchina/CI) invece di un percorso fisso nel
file — impostato solo per l'esecuzione in questo ambiente.

**Due bug RBAC reali trovati nel primo giro di sviluppo di questa
suite**, non quello che la suite doveva coprire in origine (il fix di
`/api/search` di stamattina): il primo test di ricerca falliva in un
modo che ha portato dritto al secondo bug. **Bug 1**: la dashboard
(`app/(app)/dashboard/page.tsx`) — sezioni "Aggiornate di recente", "In
scadenza" e "Per il tuo ruolo" — interrogava ogni procedura PUBLISHED
dell'intero tenant senza mai applicare `visibilityWhereClause`: un
utente nuovo, senza alcuna appartenenza a un dipartimento, vedeva titolo
e dipartimento di una procedura RESTRICTED/DEPARTMENT già al primo
accesso alla propria dashboard — stessa classe di difetto del bug di
`/api/search` corretto poche ore prima nella stessa sessione, stavolta
sulla home page invece che nella ricerca. **Bug 2**, trovato verificando
il primo: `POST /api/favorites` (toggle preferito) controllava solo
l'isolamento di tenant, mai `canViewProcedure` — un utente poteva
aggiungere ai preferiti (e quindi fissare in modo permanente sulla
propria dashboard) una procedura RESTRICTED/DEPARTMENT a cui non aveva
alcun accesso. Nuovo `src/lib/favorites.ts` (`toggleFavorite`,
`listVisibleFavorites`) estratto da `api/favorites/route.ts` per renderlo
testabile: la creazione di un nuovo preferito ora richiede
`canViewProcedure`; la rimozione resta sempre permessa anche per una
procedura non più visibile (non rivela nulla, permette solo di ripulire
un proprio riferimento ormai stantio). Stesso `visibilityWhereClause`
applicato anche al widget preferiti della dashboard e a
`GET /api/favorites`, come difesa in profondità per preferiti creati
prima di questo fix. 7 nuovi test Vitest (`tests/favorites.test.ts`) più
i 7 Playwright, entrambi verificati dal vivo: dashboard e ricerca
mostrano/nascondono correttamente la procedura riservata a seconda
dell'appartenenza al dipartimento, contro un vero browser Chromium e un
vero Postgres. `vitest.config.mts` ristretto esplicitamente a
`tests/**/*.test.ts` (altrimenti il glob di default di Vitest
raccoglieva anche `e2e/*.spec.ts`, che il runner di Playwright rifiuta se
eseguito da un altro test runner). `npx tsc --noEmit` pulito, `npm test`
117/117, `npm run test:e2e` 7/7. Dati di scarto rimossi (un tenant
Playwright di un run precedente rimasto per un'interruzione a metà,
ripulito a mano).

**25 ago 2026 (4)**: Roadmap #6, continuazione — copertura test per
l'upload allegati. Estratta in `src/lib/attachments.ts` la logica pura
già presente ma inline in `api/attachments/route.ts` (whitelist
estensioni, mappatura content-type, costruzione della storage key) —
nessun bug di permessi trovato qui (POST/DELETE/download erano già
correttamente filtrati da `canEditProcedure`/`canViewProcedure`, rule 4
rispettata), ma zero copertura test su una logica comunque rilevante per
la sicurezza: `isAllowedAttachmentType` è una whitelist, non una
blacklist, e la storage key non deriva mai dal nome file originale
(oltre alla sua estensione, già validata) proprio per restare immune a
un path traversal tipo `evil.pdf/../../etc/passwd` — 12 nuovi test
provano anche questo caso esplicitamente, non solo i casi comuni. **Nota
sull'ambiente, non un bug**: `POST /api/attachments` controlla
`storage.isStorageConfigured()` come prima cosa, prima di qualunque
validazione — in questo sandbox niente Object Storage S3-compatible è
raggiungibile (nessun demone Docker per MinIO, nessun accesso di rete per
scaricarne il binario), quindi quella route restituisce sempre 503 e la
sua logica di validazione (oltre a quella già estratta e testata) non è
verificabile dal vivo qui, a differenza di `DELETE`/`download` che sono
gate-ate dal permesso *prima* di toccare lo storage. **Verificato dal
vivo** proprio quei due: procedura di scarto impostata `RESTRICTED` in
Legal & Compliance, un `Attachment` inserito direttamente (bypassando
l'upload reale, irraggiungibile qui) — `viewer@demo.com` (VIEWER solo in
HR) riceve 403 sia su download sia su delete; `editor@demo.com` (EDITOR
in Legal & Compliance) supera il controllo di permesso su download
(bloccato solo dal 503 "storage non configurato", non da un 403 — prova
che il gate RBAC funziona indipendentemente dal limite d'ambiente) e
riesce a cancellare l'allegato, con una riga `AuditLog` scritta
correttamente. `npx tsc --noEmit` pulito, `npm test` 108/108. Dati di
scarto rimossi (stesso 500 innocuo di MeiliSearch non raggiungibile già
documentato altrove sulla `DELETE` della procedura).

**25 ago 2026 (3)**: Roadmap #6, continuazione — copertura test per la
ricerca (`tests/search.test.ts`, `tests/permissions-search-visibility.test.ts`).
**Bug RBAC reale trovato scrivendo questi test, corretto nello stesso
passaggio**: `GET /api/search` non applicava alcun filtro di visibilità —
un utente autenticato qualunque poteva vedere titolo/sommario/dipartimento
di una procedura DEPARTMENT o RESTRICTED anche senza appartenenza a quel
dipartimento, perché sia il percorso MeiliSearch sia il fallback Postgres
filtravano solo per `status = PUBLISHED`, mai per `visibility` (regola
architetturale 4 violata: i controlli di permesso vanno sempre da
`lib/permissions`, non reimplementati/omessi in una route). Nuovo
`filterVisibleProcedureHits()` in `lib/permissions/index.ts`: dato un
elenco di id "candidati" da un motore di ricerca, restituisce solo quelli
che l'utente può davvero vedere (status PUBLISHED **e** la stessa regola
di `canViewProcedure`), nello stesso ordine di rilevanza — lo stesso
pattern "il motore di ricerca propone, Postgres decide la visibilità" che
`api/ai/ask/route.ts` già usava per sé stesso (per lo stesso motivo:
citare una fonte in una risposta AI richiede la stessa garanzia), ora
condiviso da entrambe le route invece che duplicato. **Secondo bug
correlato, trovato nello stesso passaggio**: `lib/search.ts` interpolava
`departmentId`/`type`/`tags` — tutti presi da query string, quindi
manipolabili dal chiamante — senza escaping dentro l'espressione filtro
di MeiliSearch (`tags = "${t}"`), la stessa classe di difetto di una SQL
costruita per concatenazione: un valore con una `"` avrebbe potuto uscire
dalla stringa e alterare il filtro, incluso il vincolo `status =
PUBLISHED` stesso. Nuovo `escapeMeiliFilterValue()` applicato a tutti e
tre i valori. Il primo bug (RBAC) è quello che conta di più in pratica
— anche se l'injection avesse aggirato `status = PUBLISHED`, avrebbe
comunque incontrato il ricontrollo Postgres di `filterVisibleProcedureHits`
per bloccarla; ma erano due difetti reali indipendenti nella stessa area,
corretti entrambi. Applicato anche a `api/ai/ask/route.ts`, che aveva già
il pattern giusto ma senza il ricontrollo `status`. 13 nuovi test.
**Verificato anche dal vivo**, non solo con i test contro il tenant di
prova: procedura reale duplicata, impostata `RESTRICTED` nel dipartimento
Legal & Compliance — `viewer@demo.com` (VIEWER solo in HR) non la trova
più in `/api/search`, mentre `editor@demo.com` (membro di Legal &
Compliance) e l'ADMIN la trovano entrambi correttamente. `npx tsc
--noEmit` pulito, `npm test` 96/96. Procedura di scarto rimossa (stesso
500 innocuo di MeiliSearch non raggiungibile già documentato altrove,
confermato via query diretta a Postgres). MeiliSearch non è comunque
raggiungibile in questo sandbox, quindi il percorso Meili vero e proprio
non è stato eseguibile dal vivo end-to-end — solo il fallback Postgres
(che condivide la stessa `filterVisibleProcedureHits`, coperta a sua volta
dai 13 test contro il DB reale) — verificato dal vivo.

**25 ago 2026 (2)**: Roadmap #5, continuazione — header `Authorization`
opzionale sull'azione `SEND_WEBHOOK` del motore di automazioni (Traccia
3.3, già esistente dal 21 ago 2026). Quel webhook generico sbloccava già
Jira via il suo trigger "Automation for Jira — Incoming webhook" (segreto
nell'URL, come Teams/Slack), ma non ServiceNow/Freshdesk chiamati
direttamente sulle loro API REST native, che vogliono un header
`Authorization` (Basic/Bearer) su ogni richiesta. Nuovo
`SendWebhookConfig.authHeader` (`lib/automations/types.ts`): l'intero
valore dell'header, incollato così com'è dall'admin — non un selettore
Basic/Bearer/altro, perché Jira/ServiceNow/Freshdesk usano già 3 forme
diverse e "aiutare" con un campo strutturato sposterebbe solo il problema
a un quarto provider. `executeSendWebhook` lo inoltra quando presente; UI
in `create-automation-dialog.tsx` (campo password, sotto l'URL). Mascherato
per nome campo (non c'è un regex generico che lo becchi come fa
`GET /api/admin/integrations` sui suoi `token|secret|key|password`) in
entrambe le route che possono restituire una regola salvata — scritto
così fin dalla prima stesura. **Nota collaterale trovata verificando
questo, non corretta (fuori scope)**: `GET /api/admin/integrations`
stesso non maschera `webhookUrl` di Slack/Google Chat/Teams nonostante un
URL di incoming webhook sia esso stesso un segreto — non una falla nuova
(route già ADMIN-only per tenant), solo un'incoerenza pre-esistente
segnalata qui. 7 nuovi test (`tests/automations-webhook-action.test.ts`).
**Verificato anche dal vivo**: un server di eco locale che risponde 401
se l'Authorization non combacia esattamente, regola reale creata via API,
procedura di scarto critica portata a mano attraverso l'intera pipeline
(submit → compliance → management, ognuna via `decide` reale) fino a
`PUBLISHED` — il server di eco ha ricevuto l'header corretto insieme al
payload procedura, `AutomationRun` con `status: SUCCESS`; mascheramento
confermato sul `GET` successivo alla creazione. `npx tsc --noEmit`
pulito, `npm test` 83/83. Dati di scarto rimossi (regola, procedura —
quest'ultima con lo stesso 500 innocuo di MeiliSearch non raggiungibile
già documentato altrove). Dettagli completi in Traccia 3.3 (estensione)
di `docs/REDESIGN-FEATURE-AUTOMATION-PLAN.md`.

**25 ago 2026**: Roadmap #5 — adapter Microsoft Teams
(`src/lib/integrations/teams.ts`), stesso ruolo di `slack.ts`/`gchat.ts`
nel fan-out di `notifyEvent()` (regola architetturale 6): nuovo
`NotificationChannel.TEAMS` e `NotificationPreference.teamsEnabled`
(migration `add_teams_notification_channel`, default `false` come
`gchatEnabled` — opt-in esplicito, non opt-out come Slack). Solo modalità
webhook implementata (`config = { mode: "webhook", webhookUrl }`): il
payload è un Adaptive Card avvolto in `attachments`, non il vecchio
formato `MessageCard` — Microsoft ha ritirato i connector "Incoming
Webhook" di Office 365 per Teams (dismissione completata nel 2025),
sostituiti dall'app "Workflows" (un flusso Power Automate con trigger
HTTP) che si aspetta esattamente questa busta. Modalità bot (DM diretta
per utente) lasciata come TODO esplicito, stesso motivo del TODO di
`gchat.ts`: richiede un Azure Bot registrato con canale Teams abilitato
più una conversation reference per utente salvata altrove — non
verificabile senza un tenant Azure reale, quindi non implementata "a
tentativi". Toccati anche `lib/ack-token.ts` (union del `channel` estesa
a `"TEAMS"`, per il link "Conferma lettura" da Teams) e il certificato
PDF di compliance (`ack-certificate/route.ts`, mancava l'etichetta
"Microsoft Teams" — sarebbe comunque comparso "TEAMS" grezzo grazie al
fallback esistente, non un crash, ma impreciso su un documento di
compliance). **Bug reale trovato mentre si cercava dove agganciare
l'adapter, non introdotto da questo lavoro**: non esiste (e non è mai
esistita) nessuna UI admin per configurare le integrazioni — la pagina
`/admin/settings` promette un link "Slack, Google Chat, e canali di
notifica" che in realtà punta alla dashboard KPI (`/admin`), che non ha
alcuna sezione integrazioni; l'unico modo reale di configurare Slack o
Google Chat oggi è una chiamata diretta a `POST /api/admin/integrations`.
Non corretto in questo passaggio (fuori scope per l'item #5 della
roadmap, serve la sua UI dedicata), solo verificato e segnalato qui
perché altrimenti si sarebbe scoperto di nuovo alla prossima sessione.
6 nuovi test (`tests/integrations-teams.test.ts`, `fetch` mockato — è
I/O di rete, non DB — per verificare la busta Adaptive Card, azioni
condizionali, e che né una config incompleta né un fallimento di rete
facciano mai propagare un'eccezione fuori dal fan-out). **Verificato
anche dal vivo**: server dev + worker notifiche reali contro
Postgres/Redis locali, un listener HTTP locale come sostituto del
webhook Workflows di Teams, integrazione registrata via
`POST /api/admin/integrations`, una procedura di scarto critica
(`isCritical: true`, così `resolveDefaultRecipients` notifica l'intero
tenant) sottoposta a `submitForReview` reale — il listener ha ricevuto
un vero payload Adaptive Card con titolo, azione "Apri in Procedure Hub"
e URL corretti. `npx tsc --noEmit` pulito, `npm test` 76/76. Dati di
test rimossi a fine verifica (riga `Integration`, riga
`NotificationPreference` di scarto, procedura di scarto — quest'ultima
con lo stesso 500 innocuo di MeiliSearch non raggiungibile già
documentato altrove, confermato via query diretta a Postgres).

**24 ago 2026 (5)**: Traccia 4.4 — segnalibri PDF/Word reali per il
blocco `TABLE_OF_CONTENTS` esportato: prima era una lista puntata con lo
stesso testo dei titoli, non collegata a nulla. `lib/export/content-blocks.ts`
(fonte condivisa dei tre export) ora produce un `tocEntry` con
`headingIndex` (posizione 0-based del titolo tra tutte le intestazioni
del documento) invece di un `listItem`; `pdf.ts`/`docx.ts` numerano le
proprie intestazioni nello stesso ordine, così le due numerazioni
combaciano sempre. **PDF**: nuovo `lib/export/pdf-bookmarks.ts` costruisce
a mano l'albero `/Outlines` sul `PDFContext` di basso livello di
`pdf-lib` (nessuna API alto livello disponibile) con annidamento reale
(un H2 diventa figlio dell'H1 precedente) e `PageMode=UseOutlines`;
ogni voce dell'indice diventa anche un'annotazione `/Link` reale. Insidia
di `pdf-lib`: `context.obj()` converte una stringa nuda in `PDFName`, non
`PDFString` — un titolo di segnalibro va costruito con
`PDFHexString.fromText()`. **Word**: usa `Bookmark`/`InternalHyperlink`
nativi di `docx`. **Bug reale trovato nella libreria `docx` stessa (non
nel nostro codice)**, verificando l'XML generato: `Bookmark` genera il
proprio `w:id` chiamando un generatore di id fresco dentro il costruttore
di *ogni* istanza, quindi tutti i segnalibri del documento finiscono con
`w:id="1"` — viola lo schema OOXML ma non rompe la navigazione, perché
Word risolve `InternalHyperlink` per **nome** (`w:anchor`), non per id
numerico, e i nostri segnalibri non sono mai annidati/sovrapposti.
Documentato, non "corretto" (interno a `node_modules/docx`). 14 nuovi
test (`export-content-blocks`/`export-pdf-bookmarks`/`export-docx-bookmarks`,
questi ultimi due generano file reali e li ri-ispezionano con l'API di
lettura di `pdf-lib`/`jszip`, non mock). **Verificato anche dal vivo**
oltre ai test: procedura duplicata con un blocco TOC messo *prima* delle
sue stesse intestazioni (il caso più difficile), pubblicata, PDF/Word
scaricati ed ispezionati con strumenti indipendenti da quelli usati per
generarli — `pypdf` per il PDF (3 segnalibri corretti, 3 link con
destinazioni Y distinte), ispezione XML grezza per il `.docx`
(`w:bookmarkStart`/`w:hyperlink` con nomi/anchor corretti). `npx tsc
--noEmit` pulito, `npm test` 70/70. Dati di test rimossi (due 500 durante
la pulizia, entrambi lo stesso problema pre-esistente e innocuo di
MeiliSearch non raggiungibile in questo sandbox dopo il commit della
transazione DB — confermato via `dev.log` e query dirette a Postgres, non
una regressione). Dettagli completi in Traccia 4.4 del piano.

**24 ago 2026 (4)**: Traccia 4.3 — gli ultimi tre tipi di blocco
Notion-standard: `EMBED` (qualunque URL iframe-abile, non solo YouTube),
`DIAGRAM` (Mermaid — anteprima live nell'editor con import dinamico,
nuova dipendenza `mermaid`; sul lato lettura un componente client,
`mermaid-renderer.tsx`, idrata il sorgente base64 in un SVG reale dopo
il mount, perché a differenza di `EMBED` non c'è equivalente
server-side), `COLUMN_LIST`/`COLUMN` (layout a 2 colonne, `/colonne` —
prima esistevano solo come `BlockType` mai renderizzabili/inseribili;
prima vera necessità di aggiungere un blocco come *figlio* di un
blocco esistente, non solo come fratello — nuovo `onAddChild` in
`block-editor.tsx`). Stesso pattern segnaposto-sentinella già usato per
`TABLE_OF_CONTENTS` (4.2), esteso a due varianti (iframe statico per
EMBED, hydration client per DIAGRAM). **Bug reale trovato non specifico
alle colonne**: eliminare un blocco rimuoveva dallo stato client solo i
figli diretti, non ogni discendente — il database cascata
correttamente, ma un nipote (blocco dentro una colonna la cui
`COLUMN_LIST` viene eliminata) sopravviveva come blocco radice orfano
fino al reload; stesso gap pre-esistente su Toggle/liste annidate.
Corretto con un `collectDescendantIds()` condiviso. Verificato dal vivo
(Playwright): diagramma Mermaid reale con nodi/frecce nell'editor,
pubblicato e confermato che l'SVG (non il segnaposto) compaia in
lettura — attenzione per chi riverifica: il primo caricamento del
bundle `mermaid` nel browser richiede qualche secondo, non affidarsi a
un'attesa fissa breve. `npm test` 56/56 (7 nuovi). Dettagli completi in
Traccia 4.3 del piano.

**24 ago 2026 (2)**: Traccia 4 avviata in
`docs/REDESIGN-FEATURE-AUTOMATION-PLAN.md` — parità UX con Notion sulla
pagina procedura, identità visiva Control Room invariata (richiesta
esplicita: pattern di interazione, non un pivot di palette). **4.1
fatta**: menu opzioni pagina "⋯" (`page-options-menu.tsx` — copia
link/contenuto, Duplica, Testo piccolo/Larghezza intera come preferenze
di sola visualizzazione per-utente via `localStorage`, Blocca/Sblocca
pagina), azioni per blocco nell'editor (hover → "+" inserisci
sotto, menu "⋮" → Duplica blocco/Trasforma in/Elimina). Nuovo
`Procedure.isLocked` + `canMutateProcedureContent()` in
`lib/permissions/index.ts`, applicato a ogni superficie che scrive
contenuto incluso `collab-server/server.ts` stesso (non solo la route
che emette il token). Due bug reali trovati verificando dal vivo (non
solo `tsc --noEmit`): `CALLOUT` mancava da `BLOCK_COMMANDS` fin dalla
Fase 1 (nessun modo di inserirne uno via `/`); duplicare la procedura
demo copiava zero blocchi perché il suo `contentJson` seed è `{}` e
niente applicava il backfill lazy che `GET .../blocks` fa normalmente —
la route duplicate ora lo applica anch'essa. Verificato con Playwright
contro Postgres/Redis locali: menu completo, preferenze persistite dopo
reload, duplicazione con contenuto reale, blocco/sblocco incrociato tra
un Admin e un EDITOR non-Owner sulla stessa procedura. `npm test`
42/42 (5 nuovi). **4.2 (TOC/modalità lettura) fatta subito dopo, vedi
voce successiva.**

**24 ago 2026 (3)**: Traccia 4.2 — pannello "Indice" (outline che segue
lo scroll, `reading-outline.tsx`, scrollspy reale via
`IntersectionObserver`) sulla pagina procedura, più il blocco
`TABLE_OF_CONTENTS` reso finalmente funzionante (era un `BlockType` dalla
Fase 1, mai renderizzato, mancava perfino dal menu `/`). Nuovo
`lib/toc.ts`: un'unica passata su `contentHtml` assegna id-ancora a ogni
titolo e sostituisce il blocco TOC con link reali agli stessi id — usato
sia dal pannello di lettura sia da "Copia contenuto pagina" (4.1). 7 test
puri in `tests/toc.test.ts`. **Due bug reali trovati verificando dal
vivo**, uno serio e pre-esistente: `prisma/seed.ts` salvava
`contentJson: {}` per la procedura demo (corretto, ora un vero documento
ProseMirror); e `hooks/use-collaborative-editor.ts` esponeva `doc`/
`provider` non appena *costruiti*, non quando la connessione andava
davvero a buon fine — con `collab-server` irraggiungibile (come in
questo ambiente di verifica) l'editor a blocchi credeva la sessione
collaborativa attiva e mostrava **ogni** blocco vuoto, testo reale in
Postgres o meno, non solo il blocco TOC. Corretto: `doc`/`provider`
esposti solo dentro `onStatus` a connessione confermata. Verificato dal
vivo (Playwright): pannello con 3 titoli reali, scrollspy corretto,
blocco TOC inserito via `/indice` su un duplicato con contenuto vero,
pubblicato e confermato che la pagina mostri link reali (non il testo
segnaposto). `npx tsc --noEmit` pulito, `npm test` 49/49. Dettagli
completi in Traccia 4 del piano — non fatti per scelta: `EMBED`/
`DIAGRAM`/colonne, bookmark PDF/Word reali per il blocco TOC esportato.

**24 ago 2026**: piano `docs/REDESIGN-FEATURE-AUTOMATION-PLAN.md`
**completato fino a 3.5** (resta aperto solo 3.6, fuori scope per
scelta) — Traccia 2 (2.1-2.6) e Traccia 3 (3.1-3.4) erano già state
implementate ma mai committate (rimaste solo nel working tree tra
sessioni); prima azione di questa sessione è stata verificarle
(`npx tsc --noEmit` pulito, `npm test` 35/35) e committarle in 6 commit
separati per area. Poi **3.5**: `runStatusAutomations`/
`runAckCompletionAutomations`/`runCommentAddedAutomations`
(`src/lib/automations/engine.ts`) prendevano `crypto.randomUUID()` come
`fireKey` a ogni chiamata — nessun deduplicamento reale sul vincolo
`@@unique([ruleId, entityId, fireKey])`, a differenza dei trigger a
tempo. Ora richiedono un `fireKey` passato dal chiamante, riusando un id
già stabile a disposizione di ognuno: l'id del `WorkflowStep` per
submit/decide, l'id dell'`AuditLog` per archive, l'id dell'`AckCampaign`
per il completamento ACK, l'id del `Comment` per il trigger commenti.
Verificato con `npm test` (37 test, prima 35) — riscritti i test che
documentavano esplicitamente il gap in test che provano il
comportamento opposto ora vero (stesso `fireKey` → una riga, `fireKey`
diverso → due righe, entrambe scattano). Dettagli completi in
`docs/REDESIGN-FEATURE-AUTOMATION-PLAN.md` (3.5).

**21 ago 2026**: alberatura Dipartimento → Processo → Procedura → Istruzione
di Lavoro **navigabile** (`src/components/layout/department-tree.tsx`) —
prima di oggi la gerarchia esisteva solo nel modello dati (`Process`,
`Procedure.processId`/`parentId`), verificato che in tutto il tenant demo
non c'era **nessun** `Process` né **nessuna** Work Instruction reali, e la
pagina dipartimento era una tabella piatta senza espandi/collassa. Stesso
pattern di `page-tree.tsx` (fetch flat, albero costruito client-side,
chevron/click come Notion): riusato sia in `sidebar.tsx` (un dipartimento
espanso = un fetch, lazy) sia in `departments/[slug]/page.tsx` (righe più
ricche, primo livello aperto di default). Corretta anche una lacuna di
visibilità reale trovata riscrivendo la query: la pagina dipartimento non
filtrava per `visibilityWhereClause`, quindi una procedura RESTRICTED era
visibile a chiunque conoscesse lo slug del dipartimento — ora
`GET /api/departments/[id]/tree` applica la stessa regola di
`canViewProcedure`. Aggiunto anche un tocco "più innovativo" richiesto
esplicitamente: il breadcrumb sulla pagina procedura
(`procedures/procedure-breadcrumb.tsx`) ha un dropdown "salta ai fratelli"
su ogni livello navigabile (dipartimento, procedura padre se Work
Instruction, procedura corrente) — il livello Processo resta testo
semplice, non ha ancora una pagina propria. Verificato dal vivo: creato un
Processo reale con 2 procedure assegnate + 1 Work Instruction vera,
navigazione sidebar e pagina dipartimento entrambe corrette (icone
distinte Layers/FileText/ListChecks, indentazione, stato colorato), salto
tra fratelli dal breadcrumb testato e funzionante; tutti i dati di test
rimossi a fine verifica.

Aggiunto nella stessa giornata, su richiesta esplicita ("come Git — Go to
file, sa sempre dove sei, resta fisso"): **auto-reveal** in stile GitHub/VS
Code. Aprire una procedura da un punto che non è l'albero stesso (ricerca,
breadcrumb, notifica, link diretto) ora espande automaticamente la sidebar
sul ramo giusto (dipartimento → processo → eventuale procedura padre) e fa
scroll fino alla riga, evidenziata — mai in modo distruttivo, non collassa
mai un ramo che l'utente aveva già aperto a mano. Nuovo
`GET /api/procedures/[id]/location` (lookup minimo, non l'intera
`GET /api/procedures/[id]` con contenuto/versioni) usato solo da questo.
La ricerca full-text esistente (`⌘K`, `command-palette.tsx`) è già di
fatto il "Go to file" — non ne serviva una seconda. **Bug reale trovato e
corretto nello stesso passaggio**: il primo livello dei Processi nella
vista pagina (`variant="page"`) non si apriva mai di default come
documentato sopra — la chiave usata per marcare "aperto" non combaciava
con quella letta da `renderProcess` (`id` nudo vs `process:${id}`).
Verificato dal vivo: aperta una Work Instruction via URL diretto (mai
cliccata nell'albero) → sidebar si apre da sola su
Dipartimento → Processo → Procedura padre → riga evidenziata e scrollata
in vista; ricaricata la pagina dipartimento → il Processo ora è aperto di
default davvero (prima richiedeva un click). Dati di test rimossi.

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
gerarchia Department → Process → Procedure → Work Instruction (navigabile
ad albero, vedi 21 ago 2026 sopra) · workflow di approvazione con audit
trail · RBAC a due livelli · Read &
Acknowledge (con escalation multi-canale e certificato PDF) · notifiche
in-app + Slack/Google Chat (modalità webhook) · ricerca full-text con filtri
· dashboard KPI · tag/template · upload allegati reale (`POST /api/attachments`,
presigned URL S3-compatible, download/delete con stessa RBAC della procedura)
· sync automatico indice di ricerca (pubblicazione, archiviazione ed
eliminazione tengono MeiliSearch coerente entro la stessa richiesta; backfill
con `scripts/reindex.ts`) · promemoria di revisione periodica ed escalation
Read & Acknowledge, entrambi sul motore di automazioni come regole
predefinite per-tenant (`GET /api/cron/automations`, `vercel.json`,
`lib/automations/defaults.ts` — dettagli in Roadmap #4, 9 set 2026) · rate
limiting su login/AI/quick-confirm (`lib/rate-limit.ts`, fail-open su Redis
irraggiungibile).

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
4. **Migrare review-reminders/ack-escalation sul motore di automazioni —
   fatta, 9 set 2026**, su richiesta esplicita di procedere subito
   (deliberatamente rimandata il 19 ago 2026 in attesa di un ciclo di
   produzione senza incidenti — impossibile da verificare davvero in
   questo sandbox, che non ha traffico di produzione reale: la decisione
   di procedere comunque è stata dell'utente, non un giudizio autonomo di
   Claude). Vedi la voce di changelog sotto per i dettagli — `lib/review-reminders.ts`
   e `scripts/send-ack-reminders.ts` sono stati rimossi, non lasciati
   come fallback.
5. **Teams / SharePoint / Jira / Freshdesk / ServiceNow**: `Integration.type`
   li prevede già nello schema. **Microsoft Teams fatto, 25 ago 2026**
   (`lib/integrations/teams.ts`, modalità webhook — vedi voce di changelog
   sotto per i dettagli); modalità bot (DM diretta) resta un TODO esplicito
   per lo stesso motivo del bot mode di `gchat.ts`: serve un Azure Bot
   registrato + una conversation reference per utente, non verificabile
   senza un tenant Azure reale. **Jira/ServiceNow/Freshdesk: non più "da
   fare da zero" come scritto qui il 25 ago 2026 mattina** — non sono
   canali di notifica come Slack/Teams/Google Chat (sono sistemi di
   ticketing, l'integrazione naturale è "crea un ticket quando succede X",
   non "manda un messaggio di chat"), ma l'azione `SEND_WEBHOOK` del
   motore di automazioni (Traccia 3.3, 21 ago 2026) già li sblocca senza
   un adapter dedicato per provider — esteso lo stesso giorno pomeriggio
   con un header `Authorization` opzionale (`SendWebhookConfig.authHeader`)
   proprio per poter chiamare le loro API REST native direttamente, non
   solo un incoming webhook stile Teams/Slack con il segreto nell'URL.
   Vedi Traccia 3.3 in `docs/REDESIGN-FEATURE-AUTOMATION-PLAN.md` per i
   dettagli e la verifica dal vivo. **SharePoint fatto, 2 set 2026** —
   vedi voce di changelog sotto per i dettagli (disegno proprio via
   Graph API + OAuth client-credentials, non un webhook come gli altri
   quattro). **Roadmap #5 ora completa su tutti i fronti indicati.**
6. **Test automatici** — **avviata, 21 ago 2026**: prima infrastruttura
   Vitest (`vitest.config.mts`, `npm test`), 37 test in `tests/`, i quattro
   flussi indicati come priorità sono coperti — `tests/permissions.test.ts`
   (RBAC: visibilità, edit/publish, isolamento multi-tenant su un
   `departmentId` incrociato), `tests/workflow.test.ts` (pipeline di
   approvazione incluso lo skip di `COMPLIANCE_APPROVAL` per contenuto non
   critico/non taggato e la sua eccezione, rejection, `archiveProcedure`,
   immutabilità di `ProcedureVersion`), `tests/automations.test.ts`
   (`matchesConditions`, dedup reale su *tutti* i trigger — a tempo via
   `@@unique([ruleId, entityId, fireKey])` fin dall'inizio, event-driven da
   quando 3.5 ha tolto il `fireKey` casuale, 24 ago 2026, vedi sopra). Sono
   test di
   integrazione reali contro il Postgres di dev (non mock) — ogni file crea
   un Tenant isolato (`tests/helpers/test-tenant.ts`) e lo cancella in
   `afterAll`; solo Slack/Google Chat (BullMQ) e l'indicizzazione
   MeiliSearch sono mockati (`tests/setup.ts`, infrastruttura esterna già
   verificata altrove, non l'oggetto di questo test). **Motore di export
   coperto il 24 ago 2026** (Traccia 4.4, vedi sopra — bookmark PDF/Word).
   **Ricerca coperta il 25 ago 2026**, vedi voce di changelog sotto: un
   bug RBAC reale trovato scrivendo quei test (`/api/search` non filtrava
   per visibilità) è stato corretto nello stesso passaggio, non solo
   documentato. **Upload allegati coperto il 25 ago 2026 (pomeriggio)**:
   logica pura estratta in `lib/attachments.ts` (whitelist estensioni,
   content-type, costruzione della storage key) e testata; RBAC di
   `GET .../download` e `DELETE /api/attachments/[id]` verificato dal vivo
   contro un tenant reale — il flusso di upload vero e proprio
   (`POST /api/attachments` oltre il controllo "storage configurato") non
   è verificabile in questo sandbox: nessun demone Docker disponibile e
   nessun accesso di rete per scaricare un binario MinIO, quindi nessun
   object storage S3-compatible reale in questo ambiente (a differenza di
   Postgres/Redis, avviati nativamente). **Playwright introdotto il 25 ago
   2026 (sera)** (`playwright.config.ts`, `npm run test:e2e`, cartella
   `e2e/`) — vedi voce di changelog sotto: **due bug RBAC reali trovati
   nel primo giro di sviluppo di questa suite**, non nel codice che la
   suite doveva coprire in origine (il fix di `/api/search`), corretti
   nello stesso passaggio: la dashboard e la creazione di un preferito non
   applicavano `visibilityWhereClause`/`canViewProcedure`. Item #6 della
   roadmap ora completo su tutti i fronti indicati.

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
