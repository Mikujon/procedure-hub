# Fase 3 — Layer di Governance (unificare Pagina e Documento Controllato)

## Prerequisito

Fasi 1 e 2 completate e verificate.

## Obiettivo

Oggi "Procedure" è un modello a sé, distinto concettualmente da una
generica pagina wiki (che in questo progetto ancora non esiste come
concetto separato). Questa fase introduce il concetto generale di **Page**
e fa sì che una Procedure sia "una Page con proprietà di governance",
implementando i tre livelli descritti nel piano prodotto:

```
Pagina libera → Pagina governata → Documento Controllato
```

**Attenzione**: questa è la fase più delicata perché tocca il modello che
tutto il workflow, RBAC e audit trail esistenti già usano
(`lib/workflow/index.ts`, `lib/permissions/index.ts`,
`src/app/api/procedures/**`). L'obiettivo è **non riscrivere quella logica
da zero** — è già corretta — ma farla agganciare a un modello Page più
generale senza perdita di comportamento.

## Strategia di migrazione (leggi prima di scrivere schema)

Non rinominare `Procedure` in `Page`. Invece:
1. Introduci un nuovo modello `Space` (generalizzazione di `Department` —
   `Department` resta per compatibilità ma diventa concettualmente "uno
   `Space` con `type=DEPARTMENT`", vedi sotto).
2. Introduci `Page` come contenitore generico di blocchi con gerarchia
   libera (sotto-pagine).
3. `Procedure` guadagna un campo `pageId` che la collega 1:1 a una `Page` —
   la Procedure resta il modello che porta le proprietà di governance
   (status, workflow, versioning, requiresAck), la Page porta il contenuto
   a blocchi e la posizione nella gerarchia/spazio.
4. Una pagina "libera" è semplicemente una `Page` senza `Procedure`
   collegata. Passare da libera a "Documento Controllato" significa
   creare la riga `Procedure` collegata — non spostare contenuto.

Questo evita di riscrivere `lib/workflow`, `lib/permissions`, e tutte le
route `api/procedures/**` esistenti: continuano a operare su `Procedure`
esattamente come oggi, con l'aggiunta che il suo contenuto ora vive in
`Page`/`Block` (fase 1) invece che direttamente embeddato.

## Modello dati — aggiunte a `prisma/schema.prisma`

```prisma
model Space {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name        String
  slug        String
  icon        String?
  color       String?

  /// DEPARTMENT = generato per compatibilità da un Department esistente
  /// (vedi migrazione sotto). TEAM/PROJECT/PUBLIC_WIKI = spazi creati
  /// liberamente dagli utenti per altri scopi.
  type        SpaceType @default(TEAM)

  /// Se è pubblicabile come wiki esterna (sezione 7 del piano prodotto)
  isPublic    Boolean  @default(false)
  publicSlug  String?  @unique

  createdAt   DateTime @default(now())

  pages       Page[]

  @@unique([tenantId, slug])
  @@map("spaces")
}

enum SpaceType {
  DEPARTMENT
  TEAM
  PROJECT
  PUBLIC_WIKI
}

model Page {
  id            String   @id @default(cuid())
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  spaceId       String
  space         Space    @relation(fields: [spaceId], references: [id], onDelete: Cascade)

  parentPageId  String?
  parentPage    Page?    @relation("PageChildren", fields: [parentPageId], references: [id])
  children      Page[]   @relation("PageChildren")

  title         String
  icon          String?
  coverImageUrl String?

  /// Se questa pagina è stata "resa Documento Controllato", il
  /// collegamento vive qui — nullable perché una pagina libera non ce l'ha.
  procedure     Procedure?

  /// null = pagina governata senza owner esplicito ancora assegnato
  ownerId       String?

  createdById   String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  /// Blocchi di primo livello di questa pagina — riusa Block dalla fase 1,
  /// che oggi punta a procedureId: aggiungi pageId opzionale lì (vedi nota)
  blocks        Block[]

  @@index([tenantId, spaceId])
  @@index([parentPageId])
  @@map("pages")
}
```

**Modifica a `Block` (fase 1)**: aggiungi `pageId String?` e la relativa
relazione, mantenendo `procedureId` così com'è per ora. Un blocco appartiene
o a una `Procedure` (percorso legacy, fase 1) o a una `Page` (nuovo, questa
fase) — dopo aver migrato tutte le Procedure esistenti a possedere una
`Page` (vedi script sotto), `procedureId` su `Block` diventa ridondante e va
deprecato, ma non rimuoverlo in questa fase per non rompere nulla a metà
percorso: rimuovilo solo dopo aver verificato che tutte le letture leggano
da `pageId`.

**Modifica a `Procedure`**: aggiungi
```prisma
pageId String? @unique
page   Page?   @relation(fields: [pageId], references: [id])
```

## Script di migrazione

`scripts/migrate-to-spaces-and-pages.ts`:
1. Per ogni `Department` esistente, crea uno `Space` con `type=DEPARTMENT`
   e lo stesso `name`/`slug`.
2. Per ogni `Procedure` esistente, crea una `Page` nello `Space`
   corrispondente al suo `Department`, con `title = Procedure.title`, e
   collega `Procedure.pageId`.
3. Riassegna i `Block` esistenti (dalla fase 1, oggi su `procedureId`) alla
   nuova `Page` via `pageId`.

Idempotente, comando manuale, non automatico.

## "Rendi Pagina Ufficiale" — il flusso che unifica i tre livelli

Nuova route `POST /api/pages/[id]/promote-to-procedure`:
- Input: `departmentId` (o meglio ormai `spaceId`), `code`, `type`
  (PROCEDURE/POLICY/SOP/...), `requiresAck`, `isCritical`.
- Crea la riga `Procedure` collegata alla `Page` esistente (`pageId`),
  stato iniziale `DRAFT`, riusando `authorId`/`ownerId` dalla sessione
  corrente — stessa logica già presente in `POST /api/procedures`, ma senza
  ricreare i blocchi (sono già lì, sulla `Page`).
- Da questo momento in poi, la pagina ha accesso a workflow, versioning
  immutabile (fase esistente, invariata), Read & Ack (fase 4).

Nuova route inversa `PATCH /api/pages/[id]/owner` per il livello intermedio
"pagina governata" (owner + data di revisione, senza workflow di
approvazione) — riusa `Page.ownerId`, non richiede creare una `Procedure`.

## Frontend

- `src/app/(app)/spaces/[slug]/page.tsx` sostituisce concettualmente
  `departments/[slug]/page.tsx` (che può restare come redirect per
  compatibilità link esistenti)
- `src/app/(app)/pages/[id]/page.tsx` — vista di una pagina generica:
  se ha `procedure` collegata, mostra gli stessi pannelli già esistenti
  (`WorkflowPanel`, `AcknowledgeButton`, cronologia versioni); se non ce
  l'ha, mostra un bottone "Rendi Pagina Ufficiale" che apre un form e
  chiama `promote-to-procedure`
- Aggiorna la Sidebar (`src/components/layout/sidebar.tsx`) per mostrare
  `Space` con gerarchia di `Page` annidabile, non solo la lista piatta di
  Department esistente

## Checklist di verifica

- [ ] Dopo la migrazione, ogni Procedure esistente è raggiungibile sia dal
      vecchio URL `/procedures/[id]` (mantieni compatibilità) sia dal nuovo
      `/pages/[id]`, stesso contenuto
- [ ] Workflow, versioning, RBAC, audit trail sulle Procedure esistenti
      continuano a funzionare esattamente come prima (nessuna regressione)
- [ ] Creare una pagina nuova, libera, senza governance — è editabile da
      chiunque abbia accesso allo Space, nessun workflow
- [ ] Cliccare "Rendi Pagina Ufficiale" su quella pagina la trasforma in
      Documento Controllato senza spostare o duplicare il contenuto
      (stessi blocchi, stesso id pagina)
- [ ] Il Registro Procedure (fase 2) continua a riflettere correttamente lo
      stato delle Procedure dopo la migrazione
- [ ] `npx tsc --noEmit` pulito
