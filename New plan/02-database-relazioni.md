# Fase 2 — Database e Relazioni

## Prerequisito

Fase 1 completata e verificata (motore a blocchi funzionante).

## Obiettivo

Costruire un motore Database generico stile Notion: collezioni di righe
(dove ogni riga è essa stessa una Pagina/Procedure — riusa `Block` dalla
fase 1), colonne tipizzate, viste multiple (Tabella, Kanban, Calendario,
Galleria, Lista, Timeline), relazioni tra database, campi rollup/formula.

Due usi, stesso motore:
1. **Registro Procedure** — un database di sistema generato automaticamente
   con una riga per `Procedure` esistente.
2. **Database utente** — chiunque può crearne uno da zero per qualsiasi
   scopo (tracker fornitori, asset IT, roadmap).

## Modello dati — aggiunte a `prisma/schema.prisma`

```prisma
model AppDatabase {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name        String
  icon        String?
  description String?

  /// true per il Registro Procedure generato di sistema — non cancellabile
  /// dall'utente, le sue righe sono sincronizzate 1:1 con Procedure.
  isSystemManaged Boolean @default(false)

  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  columns     DatabaseColumn[]
  rows        DatabaseRow[]
  views       DatabaseView[]

  @@index([tenantId])
  @@map("app_databases")
}

model DatabaseColumn {
  id          String       @id @default(cuid())
  databaseId  String
  database    AppDatabase  @relation(fields: [databaseId], references: [id], onDelete: Cascade)
  name        String
  type        ColumnType
  sortOrder   Int

  /// Per SELECT/MULTI_SELECT: opzioni disponibili con colore, es.
  /// [{ "value": "In Review", "color": "#B8863B" }, ...]
  /// Per RELATION: { "targetDatabaseId": "..." }
  /// Per ROLLUP: { "relationColumnId": "...", "targetColumnId": "...", "aggregate": "count|sum|avg" }
  /// Per FORMULA: { "expression": "..." } — vedi nota sotto su motore formule
  /// Per SYSTEM_STATUS: { "workflowBound": true } — colonna agganciata al
  /// vero Procedure.status, sola lettura qui, si aggiorna solo via
  /// lib/workflow (mai scritta direttamente da una PATCH su questa colonna)
  config      Json         @default("{}")

  @@index([databaseId])
  @@map("database_columns")
}

enum ColumnType {
  TEXT
  NUMBER
  DATE
  SELECT
  MULTI_SELECT
  PERSON
  CHECKBOX
  URL
  EMAIL
  PHONE
  FILE
  RELATION
  ROLLUP
  FORMULA
  SYSTEM_STATUS   // sola lettura, riflette Procedure.status per righe collegate a una Procedure
  CREATED_TIME
  UPDATED_TIME
}

model DatabaseRow {
  id          String      @id @default(cuid())
  databaseId  String
  database    AppDatabase @relation(fields: [databaseId], references: [id], onDelete: Cascade)

  /// Se questa riga rappresenta una Procedure esistente (registro di
  /// sistema), il collegamento vive qui. Null per righe di database
  /// utente generici che non sono Procedure.
  procedureId String?     @unique
  procedure   Procedure?  @relation(fields: [procedureId], references: [id], onDelete: Cascade)

  /// Valori delle colonne non-relazionali, chiave = DatabaseColumn.id,
  /// valore tipizzato secondo ColumnType. Le colonne RELATION non vivono
  /// qui — vedi DatabaseRowRelation sotto, per poter interrogare la
  /// relazione in entrambe le direzioni senza deserializzare Json.
  properties  Json        @default("{}")

  sortOrder   Int
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  relationsFrom DatabaseRowRelation[] @relation("rowRelFrom")
  relationsTo   DatabaseRowRelation[] @relation("rowRelTo")

  @@index([databaseId])
  @@map("database_rows")
}

/// Collegamento tra due righe (anche di database diversi), per colonne di
/// tipo RELATION. Bidirezionale per costruzione: creare una relazione da A
/// a B la rende visibile anche interrogando da B, così un Rollup può
/// aggregare "quante righe di X puntano a me" senza query separate.
model DatabaseRowRelation {
  id            String      @id @default(cuid())
  columnId      String      // quale DatabaseColumn ha generato questo collegamento
  fromRowId     String
  fromRow       DatabaseRow @relation("rowRelFrom", fields: [fromRowId], references: [id], onDelete: Cascade)
  toRowId       String
  toRow         DatabaseRow @relation("rowRelTo", fields: [toRowId], references: [id], onDelete: Cascade)
  createdAt     DateTime    @default(now())

  @@unique([columnId, fromRowId, toRowId])
  @@index([toRowId])
  @@map("database_row_relations")
}

model DatabaseView {
  id          String       @id @default(cuid())
  databaseId  String
  database    AppDatabase  @relation(fields: [databaseId], references: [id], onDelete: Cascade)
  name        String
  type        ViewType

  /// Filtri, ordinamento, raggruppamento — struttura libera interpretata
  /// dal frontend, es. { "groupBy": "columnId", "filters": [...], "sort": [...] }
  config      Json         @default("{}")

  /// null = vista condivisa/vista di default del database; valorizzato =
  /// vista personale visibile solo al creatore (requisito: "utenti diversi
  /// possono avere viste personali sullo stesso database condiviso")
  createdById String?
  createdAt   DateTime     @default(now())

  @@index([databaseId])
  @@map("database_views")
}

enum ViewType {
  TABLE
  BOARD      // Kanban
  CALENDAR
  GALLERY
  LIST
  TIMELINE
  MAP
}
```

Relazioni inverse da aggiungere: `Tenant.appDatabases AppDatabase[]`,
`Procedure.databaseRow DatabaseRow?` (inversa di `DatabaseRow.procedure`).

**Nota sul motore formule**: non costruire un vero linguaggio di
espressioni in questa fase. Limita `FORMULA` a un piccolo set di operazioni
predefinite selezionabili da UI (es. "giorni tra [colonna data] e oggi",
"concatena [colonna A] + [colonna B]") — un parser di formule arbitrarie
stile Notion è un progetto a sé, fuori scope qui. Documentalo come
limitazione nota in `docs/ARCHITECTURE.md` a fine fase.

## Sincronizzazione col Registro Procedure di sistema

In `lib/workflow/index.ts`, agli hook esistenti di creazione/pubblicazione
Procedure, aggiungi la sincronizzazione verso il `AppDatabase` di sistema:
- Alla creazione di una `Procedure`, crea automaticamente la
  `DatabaseRow` collegata (se il database di sistema esiste per quel
  tenant — crealo al provisioning del tenant, vedi `prisma/seed.ts`).
- Ai cambi di stato (`submitForReview`, `decideWorkflowStep`,
  `archiveProcedure`), aggiorna la colonna `SYSTEM_STATUS` della riga
  collegata — questa è l'unica scrittura ammessa su quella colonna, mai
  da una PATCH generica sulle righe.

## Backend — nuove API

`src/app/api/databases/route.ts` — `GET` (lista), `POST` (crea database
utente, con colonne iniziali)

`src/app/api/databases/[id]/route.ts` — `GET` (dettaglio + colonne + viste),
`PATCH`, `DELETE` (blocca se `isSystemManaged`)

`src/app/api/databases/[id]/columns/route.ts` — `POST` (aggiungi colonna)
`src/app/api/databases/[id]/columns/[columnId]/route.ts` — `PATCH`, `DELETE`

`src/app/api/databases/[id]/rows/route.ts` — `GET` (con query filtri/sort
per popolare una vista), `POST` (crea riga — se il database è
`isSystemManaged`, crea anche la `Procedure` collegata riusando la logica
esistente in `POST /api/procedures`, non duplicarla)

`src/app/api/databases/[id]/rows/[rowId]/route.ts` — `PATCH` (aggiorna
`properties`; se la colonna toccata è `RELATION`, scrivi anche
`DatabaseRowRelation` invece che in `properties`)

`src/app/api/databases/[id]/views/route.ts` — `POST` (crea vista, con
`createdById` per viste personali)

Permessi: un `AppDatabase` eredita la logica di visibilità/edit già
esistente se collegato a un dipartimento (aggiungi `departmentId?` opzionale
su `AppDatabase` per gli usi "registro procedure di un dipartimento"); per
database generici senza dipartimento, per questa fase basta "chiunque nel
tenant vede, il creatore e ADMIN modificano" — un sistema di permessi per
database granulare è fuori scope qui, notalo come possibile fase futura.

## Frontend — componenti nuovi

`src/components/database/`:
- `database-view-switcher.tsx` — tab per cambiare tra le viste salvate
- `views/table-view.tsx` — tabella con colonne ridimensionabili, editing
  inline cella per cella
- `views/board-view.tsx` — Kanban, drag&drop tra colonne di uno `SELECT` o
  del `SYSTEM_STATUS` (se la colonna è `SYSTEM_STATUS`, il drag chiama
  l'endpoint di workflow reale — `submit`/`decide` — non una PATCH diretta,
  e va bloccato via UI se l'utente non ha il permesso, con tooltip che
  spiega perché, coerente con `WorkflowPanel` esistente)
- `views/calendar-view.tsx`, `views/gallery-view.tsx`, `views/list-view.tsx`
- `column-type-picker.tsx`, `row-editor-panel.tsx` (side panel che apre una
  riga come mini-pagina a blocchi, riusando `block-renderer.tsx` dalla
  fase 1)
- Nuovo `BlockType.DATABASE_VIEW` (aggiungilo all'enum `BlockType` della
  fase 1) — un blocco che, inserito in una pagina, embedda una vista di un
  `AppDatabase` esistente (il "blocco database inline" del piano prodotto)

## Checklist di verifica

- [ ] Al primo avvio di un tenant esiste un `AppDatabase` "Registro
      Procedure" con `isSystemManaged=true`, popolato con una riga per ogni
      `Procedure` esistente
- [ ] Cambiare stato di una Procedura via `WorkflowPanel` (fase esistente)
      aggiorna la colonna Stato visibile nella vista Kanban del registro,
      senza bisogno di refresh manuale (o con refresh minimo accettabile)
- [ ] Creare un nuovo database utente da zero, aggiungere 2-3 colonne di
      tipi diversi, aggiungere righe, funziona
- [ ] Una colonna RELATION collega righe di due database diversi;
      interrogando dal lato "to" si vede il collegamento
- [ ] Cambiare vista (Tabella → Kanban → Calendario) sullo stesso database
      mostra gli stessi dati organizzati diversamente
- [ ] Due utenti diversi possono avere viste personali diverse sullo stesso
      database condiviso, senza interferire
- [ ] `npx tsc --noEmit` pulito
