# Fase 4 — Read & Acknowledge con Escalation Multi-Canale

## Prerequisito

Fasi 1-3 completate. Questa fase è meno rischiosa delle precedenti: estende
sistemi già esistenti (`Acknowledgment`, `notifyEvent`, adapter
Slack/Google Chat) invece di introdurre un nuovo modello di contenuto.

## Obiettivo

Il modello `Acknowledgment` e la route `POST /api/acknowledgments` esistono
già e funzionano (conferma singola, per versione). Questa fase aggiunge:

1. Calcolo della platea obbligata al momento della pubblicazione
2. Invio del sollecito iniziale su tutti i canali contemporaneamente, con
   bottone "Conferma lettura" azionabile **direttamente da Slack/Google
   Chat** senza aprire l'app
3. Dashboard di completamento in tempo reale
4. Solleciti automatici scalati nel tempo (3gg / 7gg / 14gg con escalation)
5. Certificato di conformità esportabile al 100% di completamento

## Modello dati — aggiunte a `prisma/schema.prisma`

```prisma
/// Una campagna di Read & Acknowledge per una specifica versione
/// pubblicata. Creata automaticamente alla pubblicazione se
/// Procedure.requiresAck = true (hook in lib/workflow/index.ts).
model AckCampaign {
  id              String    @id @default(cuid())
  tenantId        String
  tenant          Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  procedureId     String
  procedure       Procedure @relation(fields: [procedureId], references: [id], onDelete: Cascade)
  versionNumber   Int       // quale versione richiede conferma — le vecchie conferme non contano più

  /// Calcolata alla creazione: elenco userId della platea obbligata,
  /// congelato qui (non ricalcolato dinamicamente) così che l'aggiunta di
  /// un dipendente a metà campagna non lo obblighi retroattivamente né
  /// tolga l'obbligo a chi ha lasciato il dipartimento nel frattempo.
  targetUserIds   String[]

  startedAt       DateTime  @default(now())
  completedAt     DateTime? // valorizzato quando targetUserIds.length === acknowledgments count

  reminders       AckReminder[]

  @@index([tenantId, procedureId])
  @@map("ack_campaigns")
}

/// Uno per ogni sollecito effettivamente inviato — traccia cosa è già
/// stato mandato per non rimandarlo due volte se il cron gira più spesso
/// della cadenza dei solleciti.
model AckReminder {
  id          String      @id @default(cuid())
  campaignId  String
  campaign    AckCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  stage       AckReminderStage
  sentAt      DateTime    @default(now())

  @@unique([campaignId, stage])
  @@map("ack_reminders")
}

enum AckReminderStage {
  INITIAL       // giorno 0, tutti i canali
  DAY_3         // in-app
  DAY_7         // chat + email
  DAY_14        // escalation al manager/owner
}
```

Aggiungi relazione inversa `Tenant.ackCampaigns AckCampaign[]` e
`Procedure.ackCampaigns AckCampaign[]`.

**Nota su "manager"**: se non esiste già un campo gerarchico
(`User.managerId`), aggiungilo:
```prisma
// su User, opzionale
managerId String?
manager   User?   @relation("managerOf", fields: [managerId], references: [id])
reports   User[]  @relation("managerOf")
```
Se il tenant non lo popola, l'escalation di giorno 14 ricade sul
`Procedure.ownerId` invece che sul manager — gestiscilo come fallback nel
codice, non bloccare la feature se la gerarchia non è mappata.

## Backend

**Hook alla pubblicazione** — in `lib/workflow/index.ts`, dentro
`decideWorkflowStep` quando lo stato diventa `PUBLISHED` e
`procedure.requiresAck === true`:
- Calcola `targetUserIds` (stessa logica già esistente in
  `resolveDefaultRecipients` di `lib/integrations/notify.ts` — riusala,
  non duplicarla; se serve, esportala da lì)
- Crea `AckCampaign`
- Invia il sollecito `INITIAL` su tutti i canali via `notifyEvent`, tipo
  `ACK_REQUIRED` (già esiste come `NotificationType`), con
  `channel`-specific payload che include il deep-link di conferma diretta

**Deep-link di conferma da chat** — nuova route
`POST /api/acknowledgments/quick-confirm`:
- Accetta un token firmato (non la sessione utente — l'azione arriva da un
  click su un bottone Slack/Google Chat, non da un browser loggato)
- Il token è generato al momento dell'invio del sollecito, JWT-signed
  (stesso pattern di `COLLAB_JWT_SECRET` già usato per il collab-server —
  crea `ACK_JWT_SECRET` separato), payload `{ userId, procedureId,
  versionNumber }`, scadenza lunga (30 giorni, copre tutta la campagna)
- Verifica il token, registra l'`Acknowledgment` esattamente come la route
  esistente, risponde con una paginetta di conferma minimale (per il click
  da email) o un payload JSON per il bottone interattivo Slack (Slack
  block actions richiedono una risposta rapida — vedi nota sotto)

**Aggiorna `lib/integrations/slack.ts`**: il messaggio `ACK_REQUIRED` deve
includere un bottone Slack interattivo (`type: "button"` dentro
`actions`), non solo il link "Apri in Procedure Hub" già esistente. I
bottoni interattivi Slack richiedono un endpoint separato che riceve il
callback POST da Slack (`SLACK_SIGNING_SECRET` per verificarne
l'autenticità) — aggiungi `POST /api/integrations/slack/interactions` che
instrada l'azione `confirm_ack` verso la stessa logica di
`quick-confirm`.

**Aggiorna `lib/integrations/gchat.ts`**: stesso pattern con
`cardsV2` → `buttonList` (già presente nel codice esistente per il link
"Apri in Procedure Hub" — estendilo con una seconda azione `onClick` che
punta a `quick-confirm` con il token nell'URL invece che aprire l'app).

**Cron solleciti** — `scripts/send-ack-reminders.ts`, da schedulare
giornalmente insieme a `scripts/send-digests.ts` già esistente:
- Trova `AckCampaign` non `completedAt`, calcola giorni trascorsi da
  `startedAt`
- Per ogni soglia raggiunta (3/7/14) non ancora presente in `AckReminder`
  per quella campagna, invia il sollecito allo stage corrispondente,
  filtrato solo sugli utenti che NON hanno ancora confermato (join
  `targetUserIds` contro `Acknowledgment` esistenti)
- Stage `DAY_14`: destinatario è il manager (o owner come fallback), non
  la persona stessa — messaggio diverso: "N persone del tuo team non hanno
  ancora confermato la lettura di [procedura]"

**Chiusura campagna**: quando un `Acknowledgment` viene registrato
(route esistente + la nuova `quick-confirm`), verifica se
`targetUserIds.length === count(Acknowledgment per quella versione)`; se sì,
imposta `completedAt` e notifica il `Procedure.ownerId` con link al
certificato.

**Certificato PDF** — `GET /api/procedures/[id]/ack-certificate`:
genera un PDF (usa la skill `pdf` del repository se disponibile in Claude
Code, altrimenti libreria `pdf-lib` già ragionevole per Node) con: titolo
procedura, versione, elenco nominativo di chi ha confermato con
timestamp e canale (in-app/email/Slack/Google Chat), data di completamento
al 100%.

## Frontend

`src/components/procedures/ack-dashboard.tsx` — barra di progresso
"X/Y hanno confermato", con drill-down espandibile su chi manca (nome,
data ultimo sollecito ricevuto). Va nella pagina procedura, visibile a
Owner/Admin/Compliance Officer.

`src/app/api/acknowledgments/quick-confirm` deve avere anche una pagina
di conferma HTML minimale (non solo JSON) per il caso "click da email" —
`src/app/ack-confirmed/page.tsx`, pagina pubblica (fuori dal gruppo
`(app)` autenticato) che mostra un messaggio di conferma senza richiedere
login, dato che il token stesso è la prova di autorizzazione.

## Checklist di verifica

- [ ] Pubblicare una procedura con `requiresAck=true` crea una
      `AckCampaign` e invia il sollecito iniziale su in-app + Slack (se
      configurato) + email (se configurata)
- [ ] Cliccare il bottone di conferma in Slack registra l'ack senza dover
      aprire l'app
- [ ] La dashboard di completamento si aggiorna correttamente
- [ ] Lanciando manualmente `scripts/send-ack-reminders.ts` con una
      campagna finta a >7 giorni, i solleciti giusti vengono inviati e non
      duplicati se rilanciato lo script
- [ ] Al 100% di completamento, `completedAt` si valorizza e il
      certificato PDF è generabile e corretto
- [ ] Aggiornare la procedura a una nuova versione azzera l'obbligo:
      le vecchie conferme non contano più, si apre una nuova
      `AckCampaign`
- [ ] `npx tsc --noEmit` pulito
