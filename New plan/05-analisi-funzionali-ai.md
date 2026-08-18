# Fase 5 — Modulo Analisi Funzionali & Product Documents (con AI)

## Prerequisito

Fasi 1-3 completate (serve il motore a blocchi e il concetto di `Page`).
Fase 4 non è un prerequisito tecnico stretto, ma è consigliato averla fatta.
**Fase 5a (AI-readiness) è un prerequisito stretto**: questa fase usa
`src/lib/ai/client.ts` e `src/lib/ai/context.ts` da lì — non reintrodurli qui.

## Obiettivo

Template strutturati (PRD, Analisi Funzionale, User Story, RFC/ADR, Meeting
Notes) costruiti sul motore a blocchi, più assistenza AI in **Suggest
Mode**: l'AI propone contenuto, non lo pubblica mai da sola.

## Parte A — Template strutturati

### Modello dati

```prisma
model PageTemplate {
  id          String   @id @default(cuid())
  tenantId    String?  // null = template globale disponibile a tutti i tenant
  tenant      Tenant?  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name        String   // "PRD", "Analisi Funzionale", "User Story", "RFC/ADR", "Meeting Notes"
  category    TemplateCategory
  description String?
  icon        String?

  /// Struttura di blocchi iniziale, stesso formato di Block.content
  /// (fase 1) ma senza id/pageId — un albero "stampo" da clonare in una
  /// Page nuova. Include placeholder di sezione (es. heading "Requisiti
  /// Funzionali" seguito da un blocco TABLE_SIMPLE vuoto con colonne
  /// pre-intestate "ID | Descrizione | Priorità | Stato").
  blockTemplate Json

  /// Se valorizzato, creare una pagina da questo template crea anche una
  /// riga nel AppDatabase indicato (fase 2) — es. ogni PRD creato finisce
  /// anche nel database "Product Documents" con colonna Stato.
  trackingDatabaseId String?

  createdAt   DateTime @default(now())

  @@map("page_templates")
}

enum TemplateCategory {
  PRD
  FUNCTIONAL_ANALYSIS
  USER_STORY
  TECH_SPEC_RFC
  MEETING_NOTES
  CUSTOM
}
```

Aggiungi relazione inversa `Tenant.pageTemplates PageTemplate[]`.

### Seed dei 5 template di base

In `prisma/seed.ts` (o un nuovo `prisma/seed-templates.ts` per non
appesantire il seed principale), crea i `PageTemplate` globali
(`tenantId: null`) descritti nel piano prodotto:

- **PRD**: Problema, Obiettivi, Non-obiettivi, Utenti target, User Stories
  (lista), Requisiti Funzionali (`TABLE_SIMPLE` con colonne ID/Descrizione/
  Priorità), Requisiti Non Funzionali, Metriche di Successo, Rischi,
  Timeline
- **Analisi Funzionale**: Contesto, Attori, Casi d'Uso (tabella
  Precondizioni/Flusso/Postcondizioni), Regole di Business, Matrice
  Tracciabilità (tabella Requisito↔Test)
- **User Story**: blocco formattato "Come... voglio... affinché...",
  Criteri di Accettazione (`CHECKLIST_ITEM` multipli)
- **RFC/ADR**: Contesto, Alternative Considerate (tabella Pro/Contro),
  Decisione, Conseguenze
- **Meeting Notes**: Partecipanti, Agenda, Decisioni Prese, Action Item
  (checklist con owner e scadenza — riusa `CHECKLIST_ITEM` con
  `content.assigneeId`/`content.dueDate`, già previsto nel piano prodotto
  come proprietà del blocco checklist)

### Backend

`src/app/api/templates/route.ts` — `GET` lista template disponibili
(globali + quelli del tenant)

`src/app/api/pages/from-template/route.ts` — `POST`: dato un
`templateId` e uno `spaceId`, crea una `Page` nuova, clona
`blockTemplate` in `Block` reali (nuovi id, `pageId` valorizzato), e se
`trackingDatabaseId` è presente crea anche la `DatabaseRow` collegata
(riusa la logica già scritta in fase 2 per righe collegate a contenuto).

### Frontend

`src/app/(app)/spaces/[slug]/new/page.tsx` — picker di template quando si
crea una pagina nuova ("Pagina vuota" vs uno dei template), con anteprima
della struttura prima di confermare.

## Parte B — Assistenza AI

**Principio guida, non negoziabile**: l'AI non scrive mai direttamente in
una pagina pubblicata o in un blocco esistente senza passare da una
proposta accettabile/rifiutabile. Implementalo con un solo meccanismo
riusato in tutti i casi sotto: **Suggestion**.

### Modello dati

```prisma
model AiSuggestion {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  pageId      String
  page        Page     @relation(fields: [pageId], references: [id], onDelete: Cascade)

  /// null per un blocco nuovo proposto (non ancora esistente);
  /// valorizzato se la proposta è una modifica a un blocco esistente
  targetBlockId String?

  kind        AiSuggestionKind
  /// Contenuto proposto, stesso formato di Block.content
  proposedContent Json
  /// Per GAP_ANALYSIS: non è un blocco proposto ma una lista di
  /// osservazioni testuali, es. [{ "section": "Rischi", "issue": "..." }]
  notes       Json?

  status      AiSuggestionStatus @default(PENDING)
  requestedById String
  createdAt   DateTime @default(now())
  decidedAt   DateTime?
  decidedById String?

  @@index([pageId, status])
  @@map("ai_suggestions")
}

enum AiSuggestionKind {
  DRAFT_FROM_CONVERSATION   // genera bozza iniziale da testo incollato
  GAP_ANALYSIS               // osservazioni, non blocchi da inserire
  SECTION_COMPLETION          // completa una sezione vuota specifica
  RELATED_DOCUMENT_LINK       // suggerisce una Relation verso altra pagina
  EXECUTIVE_SUMMARY           // genera/aggiorna un riepilogo
}

enum AiSuggestionStatus {
  PENDING
  ACCEPTED
  REJECTED
  PARTIALLY_ACCEPTED   // per suggerimenti multi-blocco accettati in parte
}
```

Aggiungi relazione inversa `Page.aiSuggestions AiSuggestion[]` e
`Tenant.aiSuggestions AiSuggestion[]`.

### Backend

Tutte le route sotto usano il client Anthropic — vedi
`docs/ARCHITECTURE.md` esistente per come il progetto già invoca l'API
Claude (se non c'è ancora un pattern stabilito, usa l'SDK ufficiale
`@anthropic-ai/sdk`, modello `claude-sonnet-4-6`, **mai hardcoded altrove**
— centralizza in `src/lib/ai/client.ts`).

`POST /api/pages/[id]/ai/draft-from-conversation`:
- Input: testo incollato (trascrizione, chat, note libere)
- Il prompt istruisce il modello a: (1) riconoscere se il contenuto si presta
  meglio a PRD / Analisi Funzionale / User Story, (2) produrre l'output
  come array di blocchi nel formato `Block.content`, seguendo la struttura
  del `PageTemplate` scelto
- Crea una `AiSuggestion` di kind `DRAFT_FROM_CONVERSATION` con
  `targetBlockId: null` (proposta di contenuto per pagina vuota o in coda)
  — non scrive `Block` reali finché non accettata

`POST /api/pages/[id]/ai/gap-analysis`:
- Legge tutti i `Block` correnti della pagina, li serializza in testo
  leggibile, chiede al modello di confrontarli con la struttura attesa dal
  `PageTemplate` collegato (se assente, con pattern generici per il
  `TemplateCategory` più vicino)
- Crea una `AiSuggestion` di kind `GAP_ANALYSIS` con `notes` popolato,
  `proposedContent` vuoto (non genera blocchi, solo osservazioni)

`POST /api/blocks/[id]/ai/complete-section`:
- Input: `blockId` di un blocco vuoto/sezione da completare
- Il prompt riceve il resto del contenuto della pagina come contesto,
  genera una proposta scoped a quel blocco
- Crea `AiSuggestion` con `targetBlockId` valorizzato

`POST /api/pages/[id]/ai/suggest-related`:
- Cerca pagine esistenti nel tenant con sovrapposizione semantica (per
  questa fase: full-text search via MeiliSearch già esistente, non serve
  costruire embedding — riusa `lib/search.ts`) sopra una soglia di
  rilevanza, propone una `AiSuggestion` di kind `RELATED_DOCUMENT_LINK`

`POST /api/pages/[id]/ai/executive-summary`:
- Genera un riassunto breve; se già esiste un blocco `EXECUTIVE_SUMMARY`
  in cima alla pagina (nuovo tipo o riusa `CALLOUT` con un flag), propone
  l'aggiornamento come `AiSuggestion` con `targetBlockId` su quel blocco.
  Chiamalo automaticamente (non solo su richiesta) come hook in
  `lib/workflow/index.ts` quando una `ProcedureVersion` viene creata per
  una pagina che ha un `PageTemplate` di categoria PRD/FUNCTIONAL_ANALYSIS
  — genera la proposta, non la applica.

**Route di decisione**, comune a tutti i kind:
`PATCH /api/ai-suggestions/[id]`:
- Body `{ decision: "ACCEPTED" | "REJECTED" | "PARTIALLY_ACCEPTED",
  acceptedBlockIds?: string[] }`
- Se accettata: crea/aggiorna i `Block` reali da `proposedContent`
  (rispettando `targetBlockId` se presente), scrive `AuditLog` con
  `action: "UPDATE"` e `metadata: { source: "ai_suggestion", suggestionId }`
  — importante per audit: deve sempre essere chiaro in retrospettiva che
  quel contenuto è passato da una proposta AI accettata da una persona
  specifica, mai anonimo

### Frontend

`src/components/ai/suggestion-panel.tsx` — pannello (simile a
`CommentPanel` della fase esistente) che lista le `AiSuggestion` pendenti
per la pagina corrente, con diff visivo (proposto vs vuoto/esistente) e
bottoni Accetta/Rifiuta per blocco.

`src/components/ai/ai-toolbar-trigger.tsx` — punto di ingresso nell'editor
(analogo al bottone "Commenta" già esistente in `ProcedureEditor`): un
bottone "Chiedi all'AI" che apre un piccolo menu con le azioni disponibili
(Genera da conversazione / Gap analysis / Completa questa sezione /
Documenti correlati).

`src/app/(app)/spaces/[slug]/new/page.tsx` (stessa pagina della Parte A) —
opzione aggiuntiva "Incolla una conversazione, genero io la bozza" che
chiama `draft-from-conversation` prima ancora di creare la pagina vuota.

## Parte C — Q&A interattivo sul campo e generazione da multimediale

Due richieste aggiuntive (trend di mercato 2026), diverse per natura dalla
Parte B — non sono "assistenza alla scrittura in Suggest Mode", sono un uso
diverso dello stesso client AI. Trattale come sotto-feature separate, non
varianti delle route sopra.

**Q&A interattivo** (*"qual è la procedura per l'errore X?"*, tipo Notion
AI): `POST /api/ai/ask` — riceve una domanda in linguaggio naturale, cerca
via `searchProcedures()` (`src/lib/search.ts`, Fase 5a) i documenti
pertinenti, costruisce il contesto con `buildAiContext()` (Fase 5a) per i
primi risultati, chiama il modello con streaming (`anthropic.messages.stream`,
non `.create` — la latenza percepita conta più della latenza totale per un
uso "sul campo") e cita sempre le procedure da cui la risposta deriva
(nessuna risposta senza fonte). Endpoint e componente UI separati dal
Suggest Mode della Parte B — condividono solo `src/lib/ai/client.ts` e
`buildAiContext()`.

**Generazione da multimediale** (foto/audio/video → procedura scritta):
**prerequisito non ancora soddisfatto** — richiede l'upload reale allegati
(`POST /api/attachments`, roadmap `CLAUDE.md` punto 1, non ancora costruito).
Non implementare questa parte finché quel prerequisito non è chiuso. Una
volta disponibile: **mai come endpoint sincrono** — trascrizione
audio/video è lavoro lento (non risponde in sub-secondo), lo stesso errore
già corretto in Fase 2a per `notifyEvent`. Va costruita come job asincrono
sulla coda BullMQ introdotta in Fase 2a (`src/lib/queue.ts`): upload →
job di trascrizione/estrazione → genera `AiSuggestion` (stesso meccanismo
Suggest Mode della Parte B, mai contenuto reale diretto) → notifica
l'utente via `notifyEvent()` quando pronto.

## Checklist di verifica

- [ ] Creare una pagina dal template PRD produce la struttura a blocchi
      attesa (sezioni, tabella requisiti con colonne corrette)
- [ ] Incollando una trascrizione di riunione fittizia e chiedendo
      "Genera da conversazione", il sistema propone blocchi (visibili come
      suggerimento pendente, non ancora salvati come contenuto reale)
- [ ] Accettare un suggerimento crea i `Block` reali e una riga `AuditLog`
      che referenzia la suggestion
- [ ] Rifiutare un suggerimento non lascia traccia nel contenuto della
      pagina
- [ ] Gap analysis su un'Analisi Funzionale con una sezione vuota segnala
      correttamente la sezione mancante
- [ ] Nessuna chiamata AI scrive mai direttamente un `Block` senza passare
      da `AiSuggestion` + accettazione esplicita
- [ ] `POST /api/ai/ask` risponde in streaming e ogni risposta cita almeno
      una procedura sorgente; una domanda senza risultati pertinenti dice
      esplicitamente di non saperlo, non inventa una risposta
- [ ] La generazione da multimediale (se il prerequisito upload è pronto)
      non blocca mai la richiesta HTTP che la avvia — verifica che la
      risposta torni immediatamente con uno stato "in elaborazione"
- [ ] `npx tsc --noEmit` pulito
