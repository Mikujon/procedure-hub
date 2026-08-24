# Piano di lavoro: identità visiva, gap feature, automazioni

*Scritto il 19 ago 2026 per essere ripreso da una sessione Claude Code nuova
(anche su un altro account), senza il contesto della conversazione che l'ha
prodotto. Se stai leggendo questo file all'inizio di una sessione: leggi
prima `CLAUDE.md` (architettura, regole non negoziabili, mappa del codice),
poi questo documento, poi comincia dal primo elemento non spuntato.*

## Come è nato questo piano

Un audit di sicurezza/prodotto ha portato a un redesign ("Control Room" —
vedi `docs/DESIGN.md`) e a un motore di automazioni nei workflow (vedi
`src/lib/automations/`). Dopo il primo giro di lavoro, l'utente ha
verificato di persona e ha segnalato che il risultato **sembrava molto più
superficiale di quanto documentato**: pagine con solo il font del titolo
cambiato, l'editor di contenuto intoccato, un'automazione che sembrava non
esserci. Una revisione onesta (tre esplorazioni indipendenti del codice,
non un'autovalutazione) ha confermato che la critica era fondata — i
dettagli sono nel piano completo sotto.

**Non ripetere l'errore**: dopo ogni fase, verifica *nel browser reale*
(non solo `tsc --noEmit`) che il cambiamento sia visibile e funzionante —
è esattamente il tipo di gap tra "il codice esiste" e "l'utente lo vede"
che ha causato questa situazione.

## Stato attuale — cosa è già fatto (verificato, non solo scritto)

### Fondamenta (fatte prima di questo documento)
- Palette "Control Room" (teal-cyan `--primary: 186 78% 32%`, cool paper
  `--background: 180 12% 97%`), font Archivo/Inter/IBM Plex Mono, dark
  mode reale con `next-themes` e toggle nel topbar, 4 primitive di
  movimento (`pill-settle`/`rise`/`pulse-ring`/`scan-sweep`) — tutto in
  `src/app/globals.css` + `tailwind.config.ts`.
- Motore di automazioni: `AutomationRule`/`AutomationRun`, 4 trigger
  (`PROCEDURE_STATUS_ENTERED`, `REVIEW_DATE_DUE`, `ACK_CAMPAIGN_AGE`,
  `ACK_CAMPAIGN_COMPLETED`), 2 azioni (`SEND_NOTIFICATION`,
  `CHANGE_PROCEDURE_STATUS`→solo `ARCHIVED`) — `src/lib/automations/`,
  UI in `/admin/automations`. Due regole di esempio reali già seedate nel
  tenant demo.

### Traccia 1 — Identità visiva in profondità: **fatta (1.0-1.4), 20 ago 2026**
- **1.0**: due colori esadecimali hardcoded dalla primissima direzione
  grafica (`#2F5D8C` sui cursori di collaborazione) sostituiti con una
  palette derivata dai token — `src/lib/collab-colors.ts` (nuovo).
- **1.1**: i titoli scritti *dentro* il contenuto (non solo la UI intorno)
  ora usano `--font-display` (Archivo) invece di ereditare il font body —
  fix in `src/components/blocks/block-renderer.tsx` (`HEADING_CLASS`) e,
  **più importante**, in `src/app/globals.css` (`.ProseMirror h1/h2/h3` e
  `.prose :where(h1,h2,h3)` — quest'ultimo controlla come si vede *ogni*
  procedura pubblicata, verificato dal vivo sulla procedura GDPR DSAR
  seed). Entrambi i menu slash-command (`src/components/blocks/slash-command-menu.tsx`
  e `src/components/editor/slash-command.tsx`, file gemelli) ora hanno
  `font-display` sui titoli voce e comparsa `animate-rise`.
- **1.2**: `src/components/procedures/workflow-panel.tsx` e
  `attachments-panel.tsx` — card con `animate-rise`, righe allegati in
  sequenza, spinner reale sui pulsanti durante un'azione invece di un
  blocco silenzioso. `export-menu.tsx` lasciato com'è (già animato via
  Radix/tailwindcss-animate, nulla da aggiungere).

**Nota per chi riprende**: `CardTitle` (`src/components/ui/card.tsx`) ha
*già* `font-display` incorporato di default — non serve aggiungerlo di
nuovo componente per componente, un controllo grep sul singolo file può
dare un falso negativo (l'ho scoperto a metà di 1.2, ha risparmiato lavoro
inutile). Verifica sempre leggendo il componente condiviso prima di
assumere che manchi qualcosa.

- **1.3 + 2.3** (fatte insieme, 20 ago 2026): `ViewType` allargato a
  `table | board | gallery | calendar` in `lib/database.ts` e
  `components/databases/types.ts` (prima solo `table | board`, disallineato
  dall'enum Prisma che già prevedeva tutti e 6 i valori). Nuovi
  `gallery-view.tsx` (card grid) e `calendar-view.tsx` (vista mese/settimana,
  colonna Data di riferimento configurabile, salvata nel nuovo campo
  `DatabaseView.config` — piccola migration). `database-app.tsx`: il
  ternario `table ? TableView : BoardView` (bug: qualsiasi altro tipo
  cadeva su Board) sostituito da un branch esplicito per tipo, più un
  controllo reale "+ Aggiungi vista" (prima assente — le viste esistevano
  solo se create lato dati). Motion aggiunta anche a `table-view.tsx`/
  `board-view.tsx` (righe/schede con `animate-rise` a cascata). Verificato
  dal vivo: creazione di ognuna delle 4 viste, righe con date reali
  posizionate correttamente sul calendario (mese e settimana), nessun
  bug da fuso orario sulla data.
- **1.4** (fatta, 20 ago 2026): passaggio motion reale (non solo font) su
  tutte le pagine rimaste — `procedures/new`, `procedures/[id]/edit`,
  `procedures/[id]/versions/compare` (incluso lo stagger sui blocchi di
  `VersionDiffView`), `databases/[id]` (wrapper, nessun lavoro necessario —
  il vero lavoro è su `database-app.tsx`, già fatto in 1.3+2.3),
  `pages/[id]`, `admin/settings`, `admin/automations` (+ il pannello regole,
  che aveva ancora zero motion), `departments/[slug]`, `notifications`,
  `ask`, `settings/notifications`, `(auth)/login`, `(auth)/change-password`.
  `favorites/page.tsx`: verificato come suggerito — *quasi* ok, ma non
  passava `index` a `ProcedureListRow`, quindi tutte le righe comparivano
  insieme invece che in sequenza; corretto passando `index={i}` nel map
  (bug reale trovato verificando, non solo leggendo). Ogni pagina
  verificata dal vivo nel browser (screenshot), non solo `tsc --noEmit`.
  `docs/DESIGN.md` aggiornato con la lista onesta finale.

### Cosa NON è ancora fatto — solo 3.6 (fuori scope per scelta)

Traccia 1, Traccia 2 e Traccia 3 (3.1-3.5) sono **tutte complete**
(20-24 ago 2026). Resta aperto solo 3.6, deliberatamente fuori scope
(vedi sotto).

---

## Traccia 2 — Colmare il gap rispetto a Notion/leader di mercato

Ordine per rapporto valore/sforzo (confermato da esplorazione diretta del
codice il 19 ago 2026, non stimato a occhio).

### 2.1 UI Commenti — **fatta, 20 ago 2026**

Il modello `Comment` esisteva già ma **nessun endpoint di scrittura**
esisteva davvero (`GET /api/procedures/[id]` includeva `comments` in
lettura, ma senza `author` sulle `replies` — gap corretto qui). Aggiunti
`POST /api/procedures/[id]/comments` (top-level + risposte, un solo
livello — una risposta deve puntare a un commento senza a sua volta un
`parentId`, altrimenti 400) e `DELETE /api/comments/[id]` (autore o
ADMIN; cancella prima le eventuali risposte in transazione, non c'è
`onDelete: Cascade` sulla self-relation). Nessun `AuditLog` — stesso
livello di `favorites`/`acknowledgments` (azione di partecipazione, non di
governance), non quello di blocchi/allegati.

Nuovo `components/procedures/comment-thread.tsx`: form + lista con
`animate-rise` a cascata, badge "N commenti" cliccabile accanto ai tag
(link a `#commenti`) e contatore nell'header della card, aggiornamento
locale ottimistico dopo post/delete. `procedures/[id]/page.tsx` ora
include `comments` nella propria query (prima assente — la card commenti
non esisteva). Verificato dal vivo: commento → risposta → contatore a 2 →
elimina risposta → elimina commento → torna a "Nessun commento ancora",
badge in testata scompare correttamente sotto 1.

### 2.2 Galleria template — **fatta, 20 ago 2026**

Aggiunti 10 nuovi template in `prisma/seed-templates.ts` (totale 15, da 5):
Onboarding Nuovo Dipendente, Checklist Audit Interno, Verbale Riunione
Compliance, Piano di Formazione, Registro Non Conformità (CAPA),
Segnalazione Incidente, Richiesta di Modifica (Change Request), Offboarding
Dipendente, Valutazione Rischio Fornitore, Piano di Risposta a Data Breach
— tutti `category: "CUSTOM"` (verificato: `TemplateCategory` non guida
filtri/raggruppamenti in nessun componente oggi, quindi non vale una
migration per estendere l'enum con valori mai letti). **Scoperta durante
l'esecuzione**: lo script non era mai stato lanciato su questo database —
i 5 template "già seedati" secondo `CLAUDE.md` non esistevano affatto
(`created`, non `updated`, in log per tutti e 5). Pagina `/templates`
dedicata: valutata e scartata — 15 card in una griglia 3 colonne stanno
comode in un modal, non serve una pagina a sé finché il conteggio non
cresce molto oltre questo.

Verificato dal vivo: dialog mostra tutte e 15 le card con icona/descrizione
corrette; istanziato "Piano di Formazione" da `+ → Da modello` → pagina
creata con titoli, bullet e tabella (Modulo/Durata/Formatore/Data) clonati
correttamente in blocchi reali, editabili (`+ riga`/`+ colonna` presenti).

### 2.3 Viste database Gallery e Calendario — **fatta, vedi 1.3 sopra** (fatte insieme, 20 ago 2026)

### 2.4 Verifica/staleness sulle Page — **fatta, 20 ago 2026**

Nuova migration `page_verification`: `lastVerifiedAt`/`verifiedById` su
`Page` (+ relazione `verifiedPages` su `User`, stesso pattern di
`ownedPages`/`createdPages`). Nuovo `POST /api/pages/[id]/verify` (stesso
gate RBAC di `PATCH /api/pages/[id]`: department-gated se promossa a
Procedure, workspace altrimenti — imposta `lastVerifiedAt`/`verifiedById`.
Badge in `pages/[id]/page.tsx`: verde "Verificato N giorni fa / oggi da
{nome}" se ≤90 giorni, ambra "Da verificare" se mai verificata o oltre
soglia; pulsante "Segna come ancora valido" solo per chi può modificare.
Verificato dal vivo: badge parte da "Da verificare" su una pagina mai
confermata, click → "Verificato oggi da Alessia Admin" (verde), persistito
lato server (non solo stato locale).

### 2.5 Cruscotto "salute dei contenuti" — **fatta, 20 ago 2026**

**Il sospetto bug non esisteva**: verificato con dati di test reali (una
procedura resa scaduta di 10 giorni via script, poi ripristinata) — la
query `nextReviewDate: { lte: now+30gg }` senza limite inferiore include
già correttamente le procedure scadute, non serviva alcun fix. Non
fidarsi solo della rilettura del codice ha comunque avuto senso: ha
chiuso il dubbio con certezza invece di lasciarlo aperto.

Aggiunto invece, in `GET /api/admin/kpi`: `ackCompletionRate` (% di
`AckCampaign` completate tra quelle *correnti* — solo la campagna della
versione attualmente pubblicata conta, una campagna di una versione
superata non è "ancora aperta" anche se non ha mai raggiunto il 100%) e
`pagesNeedingVerification` (conteggio Page non archiviate mai verificate o
oltre i 90 giorni, stessa soglia del badge 2.4). Lato UI
(`admin-dashboard.tsx`): due nuove `StatCard` (mostra "—" quando non ci
sono campagne, non "0%" che sembrerebbe un fallimento) e le righe
"Prossime revisioni" ora distinguono le scadute (badge rosso "Scaduta" +
data in rosso) dalle imminenti.

Verificato dal vivo (via `get_page_text`, non screenshot — i contatori
`CountUp` animano su `IntersectionObserver` e uno screenshot può
catturarli a metà corsa, dando l'impressione fuorviante di numeri
"instabili" da un caricamento all'altro: non è un bug, è solo il
momento dello scatto): la procedura resa scaduta appare nella lista con
badge "Scaduta" e data corretta.

### 2.6 @Mention — **fatta, 21 ago 2026 — Traccia 2 completa**

Nuovo `GET /api/users?q=` (directory minima del tenant — id/nome/avatar,
nessun endpoint del genere esisteva già per un utente non-admin).
`comment-thread.tsx`: digitare `@` nella textarea apre un dropdown con gli
utenti che matchano, filtrato via l'endpoint sopra con un debounce di
150ms. **Deliberatamente non parso "@Nome" dal testo per capire chi è
stato menzionato** — il client tiene già una mappa id→nome di ogni utente
scelto dal dropdown e la manda esplicita (`mentionedUserIds`) col
commento: matchare nomi via regex si romperebbe con due colleghi
omonimi. Se l'utente cancella/modifica il testo dopo aver scelto una
menzione, il submit la scarta controllando che "@Nome" sia ancora presente
nel testo — non a prova di bomba ma sufficiente per lo scopo.

Backend (`POST /api/procedures/[id]/comments`): rivalida gli id lato
server (mai fidarsi di quelli nel body), scarta l'auto-menzione, poi
`notifyEvent({type:"MENTION", ...})` — mai un invio diretto, rispetta la
regola 6. Aggiunto un campo `linkSuffix` opzionale a `notifyEvent()`
(`lib/integrations/notify.ts`) così il link della notifica punta a
`/procedures/[id]#commenti` invece che in cima alla pagina — cambio
retrocompatibile, tutti i chiamanti esistenti restano invariati.

Verificato dal vivo: digitato "@Car" → dropdown mostra "Carlo Compliance"
con avatar → selezionato → testo inserito correttamente con cursore
riposizionato → commento pubblicato → **riga `Notification` con
`type: MENTION` confermata via query diretta al DB**, `linkUrl` corretto
con `#commenti`, titolo e corpo (troncato a 140 caratteri) corretti.

### 2.7 Esplicitamente fuori scope per ora

Cattura procedure da registrazione schermo (stile Scribe — zero
scaffolding esistente, sforzo grande) e pagina dedicata di navigazione per
ruolo/mansione (oggi solo un widget nella dashboard). Pianificarli a parte
quando 1/2/3 sono chiuse.

**Verifica**: per ognuna, test end-to-end su dati reali (crea un dato,
esegui l'azione vera, controlla il risultato nel database) — non solo
`tsc --noEmit`. Vedi il pattern già usato per l'automazione ACK
(nell'audit di oggi: procedura pubblicata → 5 utenti confermano → regola
scatta → verificato via query SQL diretta, non a occhio).

---

## Traccia 3 — Automazioni più ricche

Ordine per rapporto valore/sforzo (confermato da esplorazione diretta del
motore attuale il 19 ago 2026).

### 3.1 Vista dettaglio esecuzioni — **fatta, 21 ago 2026**

Nuovo `GET /api/admin/automations/[id]/runs` (admin-only, tenant-scoped):
ultime 25 `AutomationRun`, con la procedura risolta in un secondo batch
lookup — `entityId` è sempre un procedureId anche quando `entityType`
vale `"AckCampaign"` (vedi come `engine.ts` chiama `fireRule` in
`runAckCampaignAgeRule`), quindi un'unica query copre entrambe le
famiglie di trigger senza bisogno di un `if` per tipo. In
`automations-panel.tsx`: click sulla riga regola espande un pannello con
icona verde/rossa, procedura, tempo relativo ed eventuale errore —
caricato pigramente solo all'apertura, non in coda a `GET /api/admin/automations`.

### 3.2 Condizioni per tag nella UI — **fatta, 21 ago 2026**

Aggiunto `GET /api/tags` (nessun endpoint per elencare i tag esisteva —
piccola deviazione dal piano che diceva "zero lavoro di backend": un
selettore a chip contro i tag *reali* del tenant è stato preferito a un
campo di testo libero, che avrebbe fallito in silenzio su un tag scritto
con un refuso, senza validazione). `create-automation-dialog.tsx`: chip
multi-selezionabili sotto "Solo per procedure critiche", inviati come
`conditions.tagNameIn`. `tagNameNotIn` resta raggiungibile solo via API
diretta — il piano chiedeva "un selettore", non entrambe le direzioni, e
l'uso reale (includere, non escludere) copre il caso comune.

### 3.3 Azione "webhook generico" — **fatta, 21 ago 2026**

Solo Slack e Google Chat hanno un invio reale
(`src/lib/integrations/notification-fanout.ts` interroga solo quei due
tipi); gli altri 6 valori di `IntegrationType`
(`MICROSOFT_TEAMS`/`JIRA`/`SERVICENOW`/`FRESHDESK`/`SHAREPOINT`/
`ENTRA_ID`) sono solo configurazione salvata, mai usata — confermato,
nessun file `microsoft-teams.ts`/`jira.ts`/ecc. esiste. Non esiste
nemmeno una primitiva webhook generica riusabile: `slack.ts`/`gchat.ts`
hanno ciascuno la propria `fetch()` diretta con il payload specifico del
provider, non condivisa. Nuovo `AutomationActionType.SEND_WEBHOOK` che
riusa quel pattern (fetch diretta a un URL webhook in ingresso, payload
semplice) — sblocca Teams/Jira/ServiceNow via i loro webhook nativi senza
bisogno di OAuth. Nuovo executor in `src/lib/automations/actions.ts`,
nuovo schema zod in `types.ts`, campo URL nel form. A differenza del
fan-out Slack/Google Chat in `notify.ts` (che inghiotte l'errore ed emette
solo un `console.error`, per non far fallire tutta la notifica per un
canale), qui una risposta non-2xx **rilancia** l'errore: la chiamata
webhook è l'intera azione, quindi il suo fallimento deve arrivare in
`AutomationRun.error` (visibile in 3.1), non sparire in un log che
nessuno guarda. Migration `automation_webhook_action` per il nuovo
valore enum.

Verificato dal vivo, non solo `tsc --noEmit`: creata una regola reale
("Notifica GDPR a Jira quando pubblicata", tag GDPR + webhook verso un
server di eco locale) dal form → invocato il motore reale
(`runStatusAutomations`) per la procedura GDPR DSAR con stato PUBLISHED →
il server di eco ha ricevuto un POST JSON corretto (codice, titolo,
stato, dipartimento, URL) → `AutomationRun` con `status: SUCCESS` →
confermato anche nel pannello 3.1 (spunta verde, "LEG-PRO-001 — ... · 2
min fa"). Dati di test rimossi a fine verifica (regola, run iniettati,
notifica, pagine di prova create per errore durante i test precedenti).

### 3.4 Nuovi trigger, in coppia con la Traccia 2 — **"Commento aggiunto" fatto, 21 ago 2026; "Page verificata" no, per scelta**

"Page verificata" (si aggancia a 2.4) e "Commento aggiunto" (si aggancia a
2.1) erano entrambi tecnicamente sbloccati — entrambe le feature esistono
— ma solo il secondo si inseriva nel motore senza attrito: `fireRule`,
ogni executor in `actions.ts` e `AutomationRun.entityType` presuppongono
ovunque un `procedureId` centrale, e `Comment.procedureId` esiste già.
"Page verificata" no: una Page libera (non promossa a Documento
Controllato) non ha alcun `procedureId` — estenderla richiederebbe un
caso speciale in ogni executor o un secondo path di esecuzione parallelo,
non semplicemente un altro trigger. **Non costruita**, lasciata a una
decisione esplicita se/quando serve.

**"Commento aggiunto"**: nuovo `AutomationTriggerType.COMMENT_ADDED`
(migration `comment_added_trigger`), `commentAddedConfigSchema` vuoto
(stessa categoria di `ACK_CAMPAIGN_COMPLETED` — solo storico, fireKey
casuale, un commento è un evento one-shot che non può plausibilmente
doppio-scattare per lo stesso fireKey). Nuovo
`runCommentAddedAutomations()` in `engine.ts`, agganciato in
`POST /api/procedures/[id]/comments` subito dopo la creazione del
commento (stessa convenzione "await inline" di `runStatusAutomations`/
`runAckCompletionAutomations` — mai fire-and-forget). Aggiunta l'opzione
al form e alla label del trigger.

Verificato dal vivo tramite **richiesta HTTP reale** (non uno script che
bypassa la route): creata una regola "Nuovo commento → notifica il
proprietario" dal form → postato un commento vero sulla procedura GDPR
DSAR dall'interfaccia commenti (2.1) → `AutomationRun` con
`status: SUCCESS` → riga `Notification` reale per Carlo Compliance
(l'owner, non l'autore del commento) con titolo e `linkUrl` corretti.
Dati di test rimossi.

### 3.5 Irrobustire il dedup sugli eventi — **fatta, 24 ago 2026**

`runStatusAutomations`, `runAckCompletionAutomations` e
`runCommentAddedAutomations` (`src/lib/automations/engine.ts`) prendevano
`crypto.randomUUID()` come `fireKey` a ogni chiamata — solo storico,
**nessun deduplicamento reale**, a differenza dei trigger a tempo
(protetti dal vincolo `@@unique([ruleId, entityId, fireKey])` con una
`fireKey` stabile: `nextReviewDate.toISOString()`, `String(days)`). Il
`fireKey` casuale è stato tolto dall'engine: le tre funzioni ora
**richiedono** un `fireKey` passato dal chiamante, stabile per la stessa
transizione reale, distinto per una transizione successiva genuina nello
stesso stato. Ogni chiamante aveva già a disposizione un id stabile
naturale senza bisogno di inventarne uno:
- `submitForReview`/`decideWorkflowStep` (`src/lib/workflow/index.ts`):
  l'id della riga `WorkflowStep` creata/decisa — uno `step` riceve una
  sola decisione nel flusso reale, quindi il suo id è già
  stabile-e-unico. `submitForReview` ora cattura il risultato di
  `$transaction([...])` invece di scartarlo.
- `archiveProcedure`: l'id della riga `AuditLog` appena scritta (nessun
  `WorkflowStep` su questo percorso da riusare).
- `maybeCompleteCampaign` (`src/lib/ack.ts`): l'id della `AckCampaign` —
  `completedAt` si imposta una sola volta per campagna, quindi una race
  tra due ACK concorrenti che superano entrambi la soglia del 100% ora
  deduplica correttamente invece di far scattare la regola due volte.
- `POST /api/procedures/[id]/comments`: l'id del `Comment` appena creato.

Nessuna migration necessaria — `fireKey` era già una colonna stringa
libera, cambia solo cosa il chiamante ci mette dentro. Verificato con
`npm test` (37 test, prima 35): riscritto il test che documentava
esplicitamente il gap ("firing twice creates two rows, not deduped") in
due test che provano il comportamento opposto ora vero — stesso
`fireKey` due volte → una sola riga `AutomationRun`; `fireKey` diverso
(transizione realmente separata) → due righe, entrambe scattano. Stesso
per `runCommentAddedAutomations`. `npx tsc --noEmit` pulito.

### 3.6 Esplicitamente fuori scope per ora

Un builder visuale di regole (nodi/frecce) — il valore reale si ottiene
prima e a costo molto minore con 3.1-3.3.

**Verifica**: stesso standard di 2.x — creare una regola vera, farla
scattare per davvero (non simulare), controllare `automation_runs` e la
notifica risultante nel database.

---

## Traccia 4 — Parità UX con Notion sulla pagina procedura

*Aggiunta 24 ago 2026, su richiesta esplicita ("come Notion, ma con
un'identità propria"): non un pivot di palette (Control Room resta —
vedi `docs/DESIGN.md`, terza direzione visiva, deliberatamente non un
clone Notion), ma i pattern di interazione — menu opzioni pagina,
controlli a comparsa sul singolo blocco.*

### 4.1 Menu opzioni pagina ("⋯") + azioni per blocco — **fatta, 24 ago 2026**

Nuovo `components/procedures/page-options-menu.tsx` sulla pagina
procedura (accanto a Preferiti/Esporta/Modifica): Copia link, Copia
contenuto pagina (estratto testo reale via `stripHtml`, non
ricalcolato lato client), Duplica, due preferenze di sola
visualizzazione per-utente (Testo piccolo/Larghezza intera — persistite
in `localStorage`, mai sul modello dati: sono un gusto del singolo
lettore, non una proprietà della procedura — vedi
`procedure-view-shell.tsx`), Blocca/Sblocca pagina.

**Duplica** (`POST /api/procedures/[id]/duplicate`): copia l'intero
albero di Block live (non solo l'ultimo `contentHtml` pubblicato — una
bozza mai pubblicata viene duplicata comunque), più tag e metadati
(dipartimento/processo/parent/tipo/criticità/visibilità), genera una
nuova `ProcedureVersion` v1 dalla stessa copia (stesso pattern di
`promote-to-procedure`) così la copia si legge bene anche prima di un
primo publish. Storia (versioni, commenti, ack, workflow, allegati)
deliberatamente NON copiata — una copia parte pulita. Codice reso unico
con suffisso `-COPY`, `-COPY-2`, ... invece di chiedere all'utente.
**Bug reale trovato verificando**: la procedura demo `LEG-PRO-001`
(seed) ha `ProcedureVersion.contentJson = {}` (mai stato un documento
ProseMirror vero — solo `contentHtml` è popolato nel seed) — duplicarla
copiava zero blocchi anche col codice corretto, perché
`prisma.block.findMany` sulla sorgente restituiva un array vuoto e
niente triggerava il backfill lazy che `GET .../blocks` applica normalmente.
Il fix: la route duplicate applica lo stesso backfill lazy (da
`contentJson`) prima di copiare, se la sorgente non ha ancora righe
`Block` — verificato aggiungendo blocchi reali via API a una copia di
prova e confermando che la nuova procedura li riceve intatti (query
diretta sul DB), poi ripulito. Non è stato toccato `prisma/seed.ts` —
il `contentJson: {}` lì resta un gap di dati demo pre-esistente, non
nel percorso di questo lavoro.

**Blocca pagina** (`Procedure.isLocked`, nuova migration): azione di
governance, stesso livello di permesso di "pubblica"
(`canPublishProcedure`) — non un edit qualunque. Nuovo
`canMutateProcedureContent()` in `lib/permissions/index.ts` (regola
architetturale 4: i controlli passano sempre da lì) centralizza la
regola e sostituisce `canEditProcedure` in ogni punto che scrive
contenuto: `PATCH /api/procedures/[id]` (percorso legacy), le tre route
Block (`POST .../blocks`, `PATCH`/`DELETE /api/blocks/[id]` via
`canEditBlockParent`), il token di collaborazione
(`GET .../collab-token`) e **anche** `collab-server/server.ts` stesso
(che riverifica sempre lato server, non si fida del claim nel JWT — non
sarebbe bastato aggiornare solo la route che emette il token). Un
locked nega tutti tranne chi potrebbe pubblicare (Owner di
dipartimento/Admin); non tocca le transizioni di workflow
(submit/decide/archive restano invariate — bloccare i contenuti non è
congelare l'approvazione). `POST /api/procedures/[id]/lock` scrive
`AuditLog` (`UPDATE`, `metadata.field = "isLocked"`). Badge "Bloccata"
sullo `StatusStamp`, banner esplicativo nella pagina di modifica quando
l'utente corrente non può bypassare il lock.

**Azioni per blocco** (`block-renderer.tsx`/`block-editor.tsx`): hover
su un blocco rivela un "+" (inserisce un paragrafo subito sotto,
riusa `onSelectBlockType` già esistente) e un menu "⋮" — Duplica blocco
(non copia i figli annidati, raro nella pratica: solo Toggle/liste ne
hanno), Trasforma in (sottomenu, riusa la stessa lista icone/etichette
di `BLOCK_COMMANDS` filtrata ai soli tipi "testuali" — cambia il `type`
del blocco esistente mantenendone il contenuto, via `PATCH
/api/blocks/[id]`; distinto dal comando slash, che inserisce sempre un
blocco nuovo), Elimina (spostata dentro il menu, prima era un'icona
cestino sempre a sé). **Bug reale trovato nello stesso passaggio**:
`CALLOUT` è un `BlockType` renderizzato da `BlockRenderer` fin dalla
Fase 1 ma **assente** da `BLOCK_COMMANDS`
(`slash-command-menu.tsx`) — non esisteva alcun modo di inserirne uno
via `/`. Aggiunto (icona `Megaphone`); il menu "Trasforma in" eredita
il fix gratis, riusando la stessa lista.

Verificato dal vivo (browser reale, Playwright headless contro un
Postgres/Redis locali in questa sessione, non solo `tsc --noEmit`):
menu opzioni con tutte le voci, copia link/contenuto, toggle
Testo piccolo/Larghezza intera persistiti dopo reload, duplicazione con
contenuto reale (vedi bug sopra), blocco/sblocco incrociato tra due
utenti — Admin blocca, un EDITOR (non Owner) sulla stessa procedura
vede il badge "Bloccata" e un banner in modifica con campi disabilitati,
un Owner/Admin può ancora modificare — hover/menu/duplica/trasforma-in
sul singolo blocco. `npx tsc --noEmit` pulito, `npm test` 42/42 (5
nuovi su `canMutateProcedureContent`). Dati di test rimossi a fine
verifica.

### 4.2 Non ancora fatto — prossimo passo naturale

Il terzo pilastro discusso con l'utente ("come si apre/legge una
procedura, modi di visualizzarla") resta aperto: modalità lettura vs
modifica più distinte, un pannello indice/TOC che segue lo scroll nella
pagina procedura (`TABLE_OF_CONTENTS` esiste già come `BlockType` ma
senza renderer — oggi cade nel placeholder "tipo non supportato" di
`block-renderer.tsx`), tipi di blocco Notion-standard ancora assenti
(`EMBED`, `DIAGRAM`, `COLUMN_LIST`/`COLUMN` per layout a colonne). Non
iniziato in questa sessione per scelta — 4.1 da solo è già una
superficie ampia (schema, permessi su 5 file, 2 nuove route, UI); meglio
un pilastro verificato bene che tre superficiali (vedi cronologia in
cima a questo piano sul rischio opposto).

---

## Regole architetturali da rispettare (invariate, vedi anche `CLAUDE.md`)

Le più rilevanti per questo piano specifico:
- **Multi-tenancy**: ogni nuova query filtra per `tenantId` risolto lato
  server (mai fidarsi di un valore dal client).
- **Audit trail**: ogni azione che cambia stato scrive una riga in
  `AuditLog`.
- **Automazioni**: nessuna azione generica "avanza/pubblica stato" — solo
  `CHANGE_PROCEDURE_STATUS` verso `ARCHIVED` (vedi il commento in
  `src/lib/automations/actions.ts` per il perché: `resolveNextStage()` in
  `lib/workflow/index.ts` già auto-pubblica, una regola concorrente
  bypasserebbe uno stage di approvazione compliance senza una decisione
  umana dietro).
- **Notifiche**: sempre tramite `notifyEvent()`
  (`src/lib/integrations/notify.ts`), mai chiamando un sender
  direttamente da una route o da un nuovo executor di automazione.

## Comandi utili per riprendere il lavoro

```bash
npm install
docker compose --env-file .env.docker up -d   # Postgres + MeiliSearch + Redis
npx tsc --noEmit                               # dopo OGNI modifica
npm run dev                                    # o npm run cron:dev per lo scheduler locale
```

Login demo: tenant `demo`, `admin@demo.com` / `password123` (o gli altri
utenti seed — vedi `CLAUDE.md`). Nota: `.claude/launch.json` e
`NEXTAUTH_URL` in `.env` sono allineati sulla porta 3001 (non 3000) — non
disallinearli di nuovo, ha causato confusione reale in questa sessione.
