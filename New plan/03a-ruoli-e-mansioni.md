# Fase 3a — Ruoli e mansioni (assegnazione per ruolo)

## Prerequisito

Fase 2a completata. Non dipende da 02b/02, può essere eseguita in parallelo
concettualmente, ma va fatta prima della Fase 3 esistente
(`New plan/03-governance-layer.md`) perché quella introduce `Space`/`Page` e
conviene avere già chiaro il modello di assegnazione-per-ruolo prima di
disegnare come le pagine ereditano visibilità.

## Obiettivo

Requisito emerso dall'analisi dei trend di mercato, non coperto da nessun
piano esistente: **assegnare procedure in base alla mansione/ruolo aziendale
di una persona (es. "Magazziniere", "Responsabile Onboarding"), non solo in
base al dipartimento o al singolo utente**. Oggi `User.jobTitle` esiste ma è
testo libero — non interrogabile, non usabile per filtrare o assegnare nulla.

## Perché farlo così (contesto per Claude Code)

**Non confondere `JobRole` con `GlobalRole`/`DepartmentRole`.** Quei due
restano esattamente come sono — governano *chi può modificare/pubblicare
cosa* (sicurezza/permessi). `JobRole` è un concetto ortogonale e puramente
informativo/di assegnazione: *a chi si applica* una procedura, per finalità
di onboarding e visibilità mirata (es. "mostra al nuovo assunto solo le SOP
della sua mansione"). Un utente ha un `DepartmentRole` che decide se può
editare, e un `JobRole` che decide quali procedure gli vengono segnalate
come rilevanti — le due cose non si sostituiscono a vicenda.

## Modello dati — aggiunte a `prisma/schema.prisma`

```prisma
model JobRole {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name        String   // "Magazziniere", "Responsabile Onboarding", ...
  description String?

  users       User[]
  procedures  ProcedureJobRole[]

  @@unique([tenantId, name])
  @@map("job_roles")
}
```

Su `User`, aggiungi (accanto a `jobTitle`, che resta come label libera
visualizzata — non la rimuovere, non tutti i tenant vorranno strutturare
subito ogni utente):

```prisma
jobRoleId String?
jobRole   JobRole? @relation(fields: [jobRoleId], references: [id])
```

Tabella di giunzione, stesso pattern di `ProcedureTag`
(`prisma/schema.prisma:533-540`):

```prisma
model ProcedureJobRole {
  procedureId String
  procedure   Procedure @relation(fields: [procedureId], references: [id], onDelete: Cascade)
  jobRoleId   String
  jobRole     JobRole   @relation(fields: [jobRoleId], references: [id], onDelete: Cascade)

  @@id([procedureId, jobRoleId])
  @@map("procedure_job_roles")
}
```

Aggiungi relazioni inverse `Tenant.jobRoles JobRole[]` e
`Procedure.jobRoles ProcedureJobRole[]`.

## Backend — nuove API

`src/app/api/job-roles/route.ts` — `GET` (lista per tenant), `POST` (crea,
solo `ADMIN`/`DEPARTMENT_OWNER`, stesso controllo di
`lib/permissions::isTenantAdmin` già usato altrove).

`src/app/api/procedures/route.ts` (esistente) — aggiungi parametro
`?jobRoleId=` al filtro `GET`, stesso pattern di `?departmentId=`/`?tag=`
già presenti (riga ~30 del file).

`src/app/api/procedures/[id]/route.ts` (`PATCH`, esistente) — accetta un
array opzionale `jobRoleIds: string[]` nel body, sincronizza
`ProcedureJobRole` (delete-then-create nella stessa transazione, stesso
pattern già usato per `ProcedureTag` se presente, altrimenti introdurlo per
entrambi in modo coerente).

`src/app/api/admin/users/[id]/route.ts` (o dove già vive la gestione utenti
admin) — accetta `jobRoleId` per assegnare la mansione a un utente.

## Frontend

- Form di creazione/modifica procedura: selettore multi-scelta "Mansioni a
  cui si applica", accanto al selettore Tag già esistente.
- Gestione utenti admin: campo "Mansione" come select da `JobRole` del
  tenant, invece del testo libero attuale (o accanto, se si vuole mantenere
  `jobTitle` come display name separato).
- `src/app/(app)/dashboard/page.tsx` — sezione "Procedure per il tuo ruolo",
  accanto a quella già esistente per dipartimento: query
  `GET /api/procedures?jobRoleId={session.user.jobRoleId}`.

## Checklist di verifica

- [ ] `npx prisma migrate dev` applica la migration senza errori
- [ ] Creare un `JobRole` "Magazziniere", assegnarlo a un utente e a 2-3
      procedure, verificare che `GET /api/procedures?jobRoleId=...` le
      restituisca correttamente
- [ ] La dashboard dell'utente con `jobRoleId` impostato mostra la sezione
      "Procedure per il tuo ruolo" con i contenuti corretti
- [ ] Un utente senza `jobRoleId` impostato non causa errori (sezione vuota o
      nascosta, non un crash)
- [ ] I permessi di editing (`DepartmentRole`) continuano a funzionare
      esattamente come prima — `JobRole` non li tocca in nessun modo
- [ ] `npx tsc --noEmit` pulito
