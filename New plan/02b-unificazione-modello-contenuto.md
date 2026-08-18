# Fase 2b — Unificazione del modello di contenuto (Page → Block)

## Prerequisito

Fase 1 e Fase 2a completate e verificate.

## Obiettivo

Il progetto ha oggi **due modelli di contenuto "stile Notion" che coesistono
senza essere unificati**, scoperto durante l'audit architetturale — non
documentato né in `CLAUDE.md` né in `docs/ARCHITECTURE.md`:

| | `Procedure` → `Block` (Fase 1) | `Page` → `content` (preesistente) |
|---|---|---|
| Modello contenuto | Albero di righe `Block` tipizzate | Un blob JSON Tiptap singolo (`Page.content`) |
| UI | `src/components/blocks/*`, editor a blocchi reale | `src/app/(app)/pages/[id]/page.tsx`, il vecchio `ProcedureEditor` a documento singolo |
| Collaborazione real-time | Sì (Yjs/Hocuspocus) | No |

Questa fase migra `Page.content` al modello `Block` (stessa logica già usata
per `Procedure` in Fase 1), così che **un solo modello di contenuto** serva
tutto il prodotto. È una precondizione tecnica per la Fase 2 esistente
(`New plan/02-database-relazioni.md` — il Registro Procedure e le righe di
un database utente devono sapere a quale modello di contenuto agganciarsi) e
per rendere i dati leggibili in modo uniforme da un'AI (Fase 5a) — due
rappresentazioni diverse della "stessa cosa" significano due serializzazioni
diverse da mantenere per sempre.

## Perché farlo così (contesto per Claude Code)

Non stiamo scegliendo se il modello a blocchi sia giusto — lo è già,
verificato in Fase 1. Stiamo solo estendendo `Block` (che oggi punta solo a
`procedureId`) perché possa appartenere anche a una `Page`, esattamente come
`New plan/03-governance-layer.md` (Fase 3, non ancora eseguita) già
prevedeva di fare quando avrebbe introdotto il concetto di `Page` — solo che
`Page` esiste già nello schema, quindi questo pezzo va anticipato qui invece
di aspettare la Fase 3.

## Modello dati — modifiche a `prisma/schema.prisma`

Su `Block` (aggiunto in Fase 1, oggi scoped solo a `procedureId`):

```prisma
model Block {
  // ...campi esistenti invariati...

  procedureId String?   // ora opzionale
  procedure   Procedure? @relation(fields: [procedureId], references: [id], onDelete: Cascade)

  pageId      String?
  page        Page?     @relation(fields: [pageId], references: [id], onDelete: Cascade)

  // un Block appartiene esattamente a uno dei due — applica il vincolo in
  // codice (zod/route), Prisma non esprime "esattamente uno dei due" nativamente
}
```

Aggiungi relazione inversa `Page.blocks Block[]`. **Non rimuovere ancora
`Page.content`** (il campo Json esistente) — resta come snapshot storico
dell'ultimo contenuto pre-migrazione, utile per rollback manuale se la
migrazione rivela un caso limite non gestito; rimuovilo in una fase futura
solo dopo aver verificato in produzione che tutte le letture passano da
`Block`.

## Script di migrazione

`scripts/migrate-pages-to-blocks.ts` — stessa struttura di
`scripts/migrate-to-blocks.ts` (Fase 1), riusa direttamente
`createBlocksFromProseMirrorDoc()` da `src/lib/blocks/from-prosemirror.ts`
(già scritta in modo generico, non specifica a `Procedure`):

```ts
import { createBlocksFromProseMirrorDoc } from "../src/lib/blocks/from-prosemirror";
// per ogni Page con content non nullo e senza Block esistenti (idempotente,
// stesso check via prisma.block.count({ where: { pageId } })):
await createBlocksFromProseMirrorDoc(prisma, page.tenantId, page.id, page.content, { pageId: page.id });
```

Nota: `createBlocksFromProseMirrorDoc` oggi accetta solo `procedureId` in
firma — estendila per accettare `{ procedureId } | { pageId }` invece di
duplicare la funzione, dato che tutta la logica di conversione nodo-per-nodo
è identica.

Manuale, non automatico: `npx tsx scripts/migrate-pages-to-blocks.ts`.

## Backend — nuove API

`src/app/api/pages/[id]/blocks/route.ts` e `src/app/api/blocks/[id]/route.ts`
(quest'ultima già esiste da Fase 1) — la route blocks esistente già opera per
`id` di blocco senza assumere il genitore, verifica solo che la logica di
permesso al suo interno (`canEditProcedure` via `existing.procedure...`)
gestisca anche il caso `existing.page` quando `procedureId` è null: per una
`Page` libera senza `Procedure` collegata, il controllo permessi è quello
già descritto in `lib/permissions/index.ts::canEditWorkspace` (non
`canEditProcedure`, che richiede un `departmentId` che una Page libera non ha).

## Frontend

Riscrivi `src/app/(app)/pages/[id]/page.tsx` per usare
`src/components/blocks/block-editor.tsx` invece del vecchio
`ProcedureEditor` — stesso lavoro già fatto in Fase 1 per
`procedures/[id]/edit/page.tsx`: fetch dell'albero blocchi
(`GET /api/pages/[id]/blocks`), niente collaborazione real-time per le Page
libere in questa fase (fuori scope: il collab-token oggi è scoped a
`procedureId`, estenderlo a `pageId` è un'estensione naturale ma non
necessaria per chiudere questa fase — nota come possibile fase successiva se
serve).

## Checklist di verifica

- [ ] `npx prisma migrate dev` applica la migration senza errori
- [ ] `npx tsx scripts/migrate-pages-to-blocks.ts` converte le Page esistenti
      senza perdita di contenuto visibile
- [ ] Aprendo una Page migrata, il contenuto appare identico a prima ma ora
      composto da blocchi separati, editabile con lo stesso editor a blocchi
      usato dalle Procedure
- [ ] Creare una Page nuova, libera, funziona con l'editor a blocchi fin
      dall'inizio (nessun bootstrap da contenuto vuoto rotto)
- [ ] Le Procedure esistenti (Fase 1) continuano a funzionare esattamente
      come prima — questa fase non tocca `Block.procedureId`, solo lo rende
      opzionale
- [ ] `npx tsc --noEmit` pulito
