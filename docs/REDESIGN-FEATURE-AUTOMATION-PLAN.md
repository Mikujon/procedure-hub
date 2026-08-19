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

### Traccia 1 — Identità visiva in profondità: **1.0, 1.1, 1.2 fatte**
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

### Cosa NON è ancora fatto — tutto il resto di questo documento

---

## Traccia 1 — Identità visiva in profondità (continua da 1.3)

### 1.3 Viste database (Table/Board) — **fare insieme a 2.3 sotto**

`src/components/databases/table-view.tsx`, `board-view.tsx` — trattamento
visivo (motion, eventuali micro-interazioni). Non farla come task isolato:
lo stesso codice va toccato per aggiungere Gallery/Calendario (2.3), farle
insieme evita di ritoccare due volte gli stessi file.

### 1.4 Le altre pagine — un passaggio vero, non il titolo

Pagine che oggi hanno *solo* `font-display` sull'`<h1>` e nient'altro
(nessun `animate-*`, verificato via grep + lettura diretta il 19 ago
2026): `procedures/new/page.tsx`, `procedures/[id]/edit/page.tsx`,
`procedures/[id]/versions/compare/page.tsx`, `databases/[id]/page.tsx`
(il wrapper; il vero lavoro è su `database-app.tsx`, vedi 2.3),
`pages/[id]/page.tsx`, `admin/settings/page.tsx`,
`admin/automations/page.tsx`, `departments/[slug]/page.tsx`,
`notifications/page.tsx`, `ask/page.tsx`, `settings/notifications/page.tsx`,
`(auth)/login/page.tsx`, `(auth)/change-password/page.tsx`.

Applicare lo stesso pattern già validato: liste con `animate-rise` e
`animationDelay` scalare (`index * 60ms`, vedi `ProcedureListRow` o
`AttachmentsPanel` come riferimento), non solo un cambio di font.
`favorites/page.tsx` va verificato ma probabilmente eredita già
abbastanza da `ProcedureListRow` — controllare prima di modificare.

**Quando questa traccia è finita**: aggiornare `docs/DESIGN.md` con la
lista onesta e aggiornata di cosa ha ricevuto lavoro vero vs trattamento
minimo per scelta esplicita (non lasciarla implicita di nuovo).

**Verifica**: dopo ogni pagina, `npx tsc --noEmit` + apertura reale nel
browser (screenshot o lettura DOM/computed-style) — non fidarsi della sola
lettura di codice.

---

## Traccia 2 — Colmare il gap rispetto a Notion/leader di mercato

Ordine per rapporto valore/sforzo (confermato da esplorazione diretta del
codice il 19 ago 2026, non stimato a occhio).

### 2.1 UI Commenti — backend già pronto, serve solo il frontend

Il modello `Comment` (`prisma/schema.prisma`) e l'API
(`GET /api/procedures/[id]` include già `comments`, con `replies`
annidate) esistono e funzionano — **oggi vengono scaricati a ogni
caricamento pagina e buttati via**, nessun componente li mostra. Costruire
un thread sotto il contenuto della procedura (lista + form di risposta),
badge "N commenti" visibile. Nessuna migrazione, nessun cambio di API.

### 2.2 Galleria template — più ampiezza

`src/components/layout/template-picker-dialog.tsx` è già una vera gallery
in stile Notion (card grid in un modal), non un dropdown — il gap è
l'ampiezza: solo 5 template seed (`prisma/seed-templates.ts`). Aggiungere
10-15 template realistici per procedure aziendali (Onboarding, Checklist
audit, Verbale riunione compliance, Piano di formazione, Registro non
conformità, ecc.). Valutare se serve anche una pagina `/templates`
dedicata, non solo il dialog.

### 2.3 Viste database Gallery e Calendario — fare insieme a 1.3

Lo schema Prisma (`ViewType` enum: `TABLE`, `BOARD`, `CALENDAR`,
`GALLERY`, `LIST`, `TIMELINE`) prevede già questi valori — **il frontend
no**: `src/components/databases/types.ts` ha `type: "table" | "board"`,
un'unione letterale che non corrisponde all'enum Prisma. Lavoro concreto:
- Allargare l'unione di tipo in `types.ts` a tutti i valori dell'enum.
- `src/components/databases/database-app.tsx` ha un ternario fisso
  (`activeView.type === "table" ? <TableView/> : <BoardView/>` — qualsiasi
  cosa non sia `"table"` cade su `BoardView`) — convertirlo in uno
  switch/registry reale.
- Costruire `gallery-view.tsx` (card grid — stesso pattern del template
  picker) e `calendar-view.tsx` (vista mese/settimana, un campo data di
  riferimento configurabile per database).
- Aggiungere un controllo "+ Aggiungi vista" — oggi assente, le viste
  esistono solo se già create lato dati, non c'è modo di crearne una
  nuova dalla UI.

### 2.4 Verifica/staleness sulle Page

`Page` (a differenza di `Procedure`) non ha **nessun** campo di revisione
— confermato leggendo `prisma/schema.prisma` per intero. Aggiungere un
pattern leggero (non il workflow formale di Procedure): `lastVerifiedAt`/
`verifiedById` su `Page`, un pulsante "Segna come ancora valido", un badge
"Verificato N giorni fa" / "Da verificare" oltre una soglia (es. 90
giorni). Nuova migration piccola, non tocca `Procedure`.

### 2.5 Cruscotto "salute dei contenuti" — c'è anche un bug vero

`GET /api/admin/kpi` (`src/app/api/admin/kpi/route.ts`) oggi guarda solo
*in avanti* 30 giorni (`upcomingReviews`) — **non intercetta le procedure
già scadute** (la query filtra `nextReviewDate: { lte: now + 30gg }` ma
non ha un limite inferiore, quindi tecnicamente le include se sono già
passate... verificare comunque il comportamento reale con dati di test
prima di assumere sia già corretto). Aggiungere: % di conferme completate
su procedure che le richiedono (join con `AckCampaign`), conteggio Page
"da verificare" (una volta fatta 2.4).

### 2.6 @Mention

`NotificationType.MENTION` esiste nello schema, **nulla lo produce mai**
(verificato via grep — zero occorrenze di logica di menzione). Ambito
naturale: dentro 2.1 (i commenti). Autocompletamento `@nome` nell'editor +
produzione reale della notifica.

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

### 3.1 Vista dettaglio esecuzioni — il dato c'è già, manca la UI

`AutomationRun` (`prisma/schema.prisma`) cattura già `firedAt`/`status`/
`error`, ma `src/components/settings/automations-panel.tsx` mostra solo
`_count.runs` (un numero). Aggiungere un pannello a comparsa (click sulla
regola) con la lista delle ultime esecuzioni, stato ed errore — stesso
pattern a lista con `animate-rise`. Nessun cambio di schema.

### 3.2 Condizioni per tag nella UI

`tagNameIn`/`tagNameNotIn` esistono già nel motore
(`src/lib/automations/conditions.ts`) e nello schema zod
(`src/lib/automations/types.ts`), ma **non hanno alcun controllo nel
form** (`src/components/settings/create-automation-dialog.tsx` ha solo un
checkbox `onlyCritical` → `isCriticalEquals`) — oggi raggiungibili solo
via chiamata API diretta. Aggiungere un selettore multiplo di tag nel
dialog. Zero lavoro di backend.

### 3.3 Azione "webhook generico"

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
nuovo schema zod in `types.ts`, campo URL nel form.

### 3.4 Nuovi trigger, in coppia con la Traccia 2

"Page verificata" (si aggancia a 2.4), "Commento aggiunto" (si aggancia a
2.1) — costruirli quando quelle feature esistono, non prima.

### 3.5 Irrobustire il dedup sugli eventi

`PROCEDURE_STATUS_ENTERED` e `ACK_CAMPAIGN_COMPLETED`
(`src/lib/automations/engine.ts`) generano una chiave casuale
(`crypto.randomUUID()`) a ogni chiamata — solo storico, **nessun
deduplicamento reale**, a differenza dei trigger a tempo (protetti dal
vincolo `@@unique([ruleId, entityId, fireKey])` con una `fireKey`
stabile). Rischio concreto solo in caso di richiesta doppia/retry lato
client. Irrobustire con una chiave stabile se si osserva il problema in
pratica, non preventivamente come primo passo.

### 3.6 Esplicitamente fuori scope per ora

Un builder visuale di regole (nodi/frecce) — il valore reale si ottiene
prima e a costo molto minore con 3.1-3.3.

**Verifica**: stesso standard di 2.x — creare una regola vera, farla
scattare per davvero (non simulare), controllare `automation_runs` e la
notifica risultante nel database.

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
