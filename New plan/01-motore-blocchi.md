# Fase 1 — Motore a Blocchi

## Obiettivo

Oggi il contenuto di una Procedura è un unico documento Tiptap/Yjs
(`ProcedureVersion.contentJson`). Questa fase lo trasforma in un **albero di
blocchi indipendenti, riordinabili e tipizzati** — la base su cui si
costruiranno Database (fase 2), Governance (fase 3) e tutto il resto.

Un blocco è l'unità atomica di contenuto: un paragrafo, un heading, un
callout, un'immagine, una tabella, un embed, un blocco database (in fase 2).
Ogni pagina è semplicemente un array ordinato di blocchi, annidabili
(un blocco può avere blocchi figli — es. un toggle-list contiene blocchi al
suo interno).

## Perché farlo così (contesto per Claude Code)

Non stiamo buttando via l'editor collaborativo Yjs già costruito — lo stiamo
facendo operare a grana più fine. Invece di un Y.Doc per l'intera procedura,
ogni **blocco** ha la propria porzione di stato Yjs (via `Y.XmlFragment`
annidati in un unico `Y.Doc` per pagina — Yjs supporta nativamente strutture
annidate in un solo documento, non serve un Y.Doc per blocco). Questo
permette in futuro di riordinare blocchi via drag&drop senza conflitti di
merge, e di far diventare un blocco "riga di database" senza cambiare
motore.

## Modello dati — modifiche a `prisma/schema.prisma`

Aggiungi (non rimuovere nulla di esistente in questa fase):

```prisma
/// Un blocco di contenuto. Sostituisce concettualmente
/// ProcedureVersion.contentJson come sorgente di verità del contenuto vivo;
/// ProcedureVersion resta com'è (vedi sotto) per lo storico immutabile.
model Block {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  /// La pagina a cui appartiene. In questa fase "pagina" è ancora
  /// Procedure — in fase 3 diventa un concetto Page indipendente. Non
  /// anticipare qui la generalizzazione: tienilo scoped a procedureId per
  /// ora, si generalizza in fase 3 senza reinventare Block.
  procedureId String
  procedure   Procedure @relation(fields: [procedureId], references: [id], onDelete: Cascade)

  parentBlockId String?  // per blocchi annidati (es. dentro un toggle o una colonna)
  parentBlock    Block?  @relation("BlockChildren", fields: [parentBlockId], references: [id], onDelete: Cascade)
  children       Block[] @relation("BlockChildren")

  type        BlockType
  /// Contenuto specifico del tipo — struttura libera per tipo, es.
  /// { text: [...ProseMirror inline nodes] } per paragraph,
  /// { url, caption } per image, { language, code } per code, ecc.
  /// Tenerlo Json invece di colonne dedicate: i tipi di blocco cresceranno
  /// (fase 2 aggiunge "database_view"), non vogliamo una migration per ognuno.
  content     Json
  sortOrder   Int      // ordine tra fratelli (stesso parentBlockId, o root se null)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([procedureId, parentBlockId, sortOrder])
  @@map("blocks")
}

enum BlockType {
  PARAGRAPH
  HEADING_1
  HEADING_2
  HEADING_3
  BULLETED_LIST_ITEM
  NUMBERED_LIST_ITEM
  TOGGLE_LIST_ITEM
  CHECKLIST_ITEM
  CALLOUT
  QUOTE
  DIVIDER
  COLUMN_LIST
  COLUMN
  CODE
  IMAGE
  VIDEO
  AUDIO
  FILE
  EMBED
  DIAGRAM
  TABLE_SIMPLE
  TABLE_OF_CONTENTS
  PAGE_LINK
  SYNCED_BLOCK_SOURCE
  SYNCED_BLOCK_REFERENCE
}
```

Aggiungi la relazione inversa su `Tenant` e `Procedure`:
```prisma
// su Tenant, accanto alle altre relazioni:
blocks Block[]

// su Procedure, accanto alle altre relazioni:
blocks Block[]
```

**Non toccare `ProcedureVersion`**: resta lo snapshot immutabile — quando si
crea una versione formale (fase 3 riaggancia questo), si serializza l'intero
albero di `Block` in `ProcedureVersion.contentJson` come oggi, congelato.
`Block` è lo stato *live*, `ProcedureVersion` lo stato *pubblicato*. Stessa
distinzione già esistente tra `Procedure.collaborativeStateB64` (Yjs live) e
`ProcedureVersion` — non stai inventando un terzo concetto, stai facendo sì
che lo stato Yjs live sia strutturato a blocchi invece che monolitico.

## Migrazione dei dati esistenti

Scrivi `scripts/migrate-to-blocks.ts`:
- Per ogni `Procedure` con una `currentVersion` esistente, parsa
  `contentJson` (ProseMirror JSON) e crealo come albero di `Block` —
  ogni nodo di primo livello del documento ProseMirror diventa un `Block`
  root con `sortOrder` progressivo; nodi con figli (liste, blockquote)
  creano `Block` figli via `parentBlockId`.
- Idempotente: salta le Procedure che hanno già righe in `Block`.
- Non eseguire in automatico — è un comando manuale (`npx tsx
  scripts/migrate-to-blocks.ts`), lancialo tu una volta pronto lo schema.

## Backend — nuove API

`src/app/api/procedures/[id]/blocks/route.ts`:
- `GET` — ritorna l'albero di blocchi della procedura (ordinati, annidati)
- `POST` — crea un blocco (con `parentBlockId`/`sortOrder`)

`src/app/api/blocks/[id]/route.ts`:
- `PATCH` — aggiorna `content` o `sortOrder`/`parentBlockId` (per il
  drag&drop di riordino)
- `DELETE` — cancella un blocco (e i suoi figli, via cascade)

Ricorda: ogni route filtra per `tenantId` risolto da `getServerSession` +
verifica `canEditProcedure`/`canViewProcedure` da `lib/permissions`, come
tutte le altre route esistenti — non reinventare il controllo permessi qui.

## Frontend — componenti nuovi

`src/components/blocks/`:
- `block-renderer.tsx` — dato un `Block`, renderizza il componente giusto
  in base a `type` (dispatch/switch)
- `block-editor.tsx` — sostituisce (in `procedures/[id]/edit/page.tsx`)
  l'attuale `ProcedureEditor` a documento singolo con un contenitore che
  renderizza la lista di `Block` in ordine, ognuno editabile inline
- Un componente per tipo di blocco più comune (paragraph, heading, callout,
  image, code, toggle, checklist) — riusa dove possibile le estensioni
  Tiptap già presenti (`src/components/editor/`), non buttarle via: un
  blocco `PARAGRAPH`/`HEADING`/`CALLOUT` può internamente usare una mini
  istanza Tiptap per il rich text inline, solo che ora ogni blocco ne ha una
  propria invece che un editor monolitico per l'intera pagina.
- `slash-command-menu.tsx` — il menu `/` per inserire un nuovo blocco,
  con ricerca fuzzy tra i tipi disponibili
- Drag handle per riordino (libreria consigliata: `@dnd-kit/core`, già
  compatibile con React 18 usato nel progetto — aggiungila a
  `package.json`)

## Collaborazione realtime

Il `collab-server/` esistente non cambia nella sua logica di persistenza
(continua a salvare su `Procedure.collaborativeStateB64`), ma la *struttura*
del `Y.Doc` condiviso ora rappresenta l'albero di blocchi invece di un
documento piatto. Aggiorna `useCollaborativeEditor` 
(`src/hooks/use-collaborative-editor.ts`) perché esponga non un singolo
editor Tiptap, ma una mappa `blockId → Y.XmlFragment`, cosicché
`block-editor.tsx` possa montare un'istanza Tiptap+Collaboration per
ciascun blocco attivo (quello in editing), condividendo lo stesso `Y.Doc` e
`HocuspocusProvider` di pagina.

## Checklist di verifica

- [ ] `npx prisma migrate dev` applica la migration senza errori
- [ ] `npm run dev:all` avvia senza errori
- [ ] Aprendo una procedura esistente (post-migrazione), il contenuto
      appare identico a prima ma ora composto da blocchi separati
- [ ] Digitando `/` in un punto vuoto della pagina si apre il menu
      d'inserimento blocco
- [ ] Trascinando un blocco se ne cambia l'ordine, persistito (ricaricando
      la pagina l'ordine resta)
- [ ] Aprendo la stessa procedura da due browser diversi, editando un
      blocco in uno, l'altro vede l'aggiornamento in tempo reale
- [ ] I commenti ancorati (`CommentMark`, esistenti) continuano a
      funzionare dentro un blocco di testo
- [ ] `npx tsc --noEmit` non introduce nuovi errori rispetto a prima della
      fase
