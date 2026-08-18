# Fase 2a — Fondamenta di scalabilità (prerequisito)

## Prerequisito

Fase 1 completata e verificata (motore a blocchi + collaborazione real-time).

## Obiettivo

Prima di costruire altro sopra le fondamenta attuali, correggere due problemi
trovati durante l'audit architetturale — uno di correttezza (permessi), uno
di scalabilità già misurabile oggi, non ipotetico (notifiche bloccanti) — e
introdurre **una sola volta** l'infrastruttura di coda/cache (Redis) che
servirà a più cose contemporaneamente più avanti nel piano: fan-out
notifiche, estensione multi-istanza del collab-server (Fase 1), e la futura
coda di trascrizione multimediale (Fase 5). Farlo ora evita tre migrazioni
separate in tre fasi diverse.

## Perché farlo così (contesto per Claude Code)

Questa non è una fase "nuova feature" — è debito tecnico trovato per lettura
diretta del codice (non ipotesi), da ripagare prima che altre fasi ci
costruiscano sopra. Le due correzioni sono indipendenti tra loro; l'ordine
interno non conta, ma vanno fatte entrambe prima di procedere a 02b.

## 1. Fix permessi — `GET /api/procedures`

`src/app/api/procedures/route.ts` filtra oggi solo per `tenantId`,
`departmentId`, `status`, `tag` — **nessun controllo di `visibility` o
membership di dipartimento**, a differenza di
`GET /api/procedures/[id]/route.ts` che chiama correttamente
`canViewProcedure` prima di rispondere. Un utente qualsiasi del tenant può
oggi vedere in lista procedure marcate `RESTRICTED` a cui non dovrebbe avere
accesso.

Correggi aggiungendo, nella query esistente, l'equivalente in `WHERE` della
logica già in `lib/permissions/index.ts::canViewProcedure` (visibilità
`PUBLIC` sempre visibile; `ADMIN` bypassa tutto; `DEPARTMENT`/`RESTRICTED`
richiedono una `DepartmentMembership` dell'utente su quel `departmentId`) —
non richiamare `canViewProcedure` riga per riga dopo la query (N+1), tradurla
in condizione SQL/Prisma unica. Non reinventare la logica: se cambia in
`lib/permissions`, deve cambiare in un solo posto — valuta se estrarre la
condizione in una funzione `visibilityWhereClause(user)` riusabile da
entrambe le route.

## 2. Fix notifiche bloccanti — `notifyEvent()`

`src/lib/integrations/notify.ts` (righe 50-72) fa, dentro al ciclo
richiesta/risposta HTTP che il chiamante aspetta:

```ts
for (const recipient of recipients) {
  const prefs = await prisma.notificationPreference.findUnique(...); // N+1
  if (...) await sendSlackNotification({...});   // HTTP esterno, sequenziale
  if (...) await sendGoogleChatNotification({...}); // HTTP esterno, sequenziale
}
```

Per una procedura critica, `resolveDefaultRecipients` restituisce fino a 200
utenti — fino a 200 query + 200 chiamate HTTP esterne in sequenza, una alla
volta, prima che la richiesta risponda. Correggi in due passi:

1. **Subito, senza nuova infrastruttura**: `prisma.notificationPreference.findMany({ where: { userId: { in: recipients.map(r => r.id) } } })` una volta sola invece di N `findUnique`; le chiamate Slack/Google Chat via `Promise.all` invece di sequenziali.
2. **Con la coda (sotto)**: il chiamante di `notifyEvent()` non aspetta più il fan-out — accoda un job e ritorna subito. Il fan-out (passo 1 già corretto) gira dentro il worker.

## 3. Infrastruttura coda/cache — Redis

`docker-compose.yml`, aggiungi:

```yaml
redis:
  image: redis:7-alpine
  restart: unless-stopped
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
```

(più `redis_data` in `volumes:`).

Nuove dipendenze: `bullmq`, `ioredis`. Nuovo `.env`/`.env.example`:
`REDIS_URL="redis://localhost:6379"`.

Nuovo `src/lib/queue.ts` — connessione Redis condivisa (stesso pattern
singleton di `src/lib/prisma.ts`) più un piccolo helper per definire code
BullMQ senza ripetere boilerplate:

```ts
import { Queue, Worker, type Processor } from "bullmq";
import IORedis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: IORedis };
export const redis = globalForRedis.redis ?? new IORedis(process.env.REDIS_URL!, { maxRetriesPerRequest: null });
if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

export function defineQueue<T>(name: string) {
  return new Queue<T>(name, { connection: redis });
}

export function defineWorker<T>(name: string, processor: Processor<T>) {
  return new Worker<T>(name, processor, { connection: redis });
}
```

Nuova coda `notifications`: `src/lib/queue/notifications.ts` esporta
`notificationsQueue = defineQueue<NotifyJobPayload>("notifications")` e un
worker (avviato come processo separato, stesso pattern di `collab-server/` —
script `workers/notifications.ts`, script npm `"worker:notifications": "tsx watch workers/notifications.ts"`,
incluso in un nuovo `dev:all` esteso o in un `dev:workers` separato).
`notifyEvent()` in `src/lib/integrations/notify.ts` diventa: crea sempre la
riga `Notification` in-app in modo sincrono (è la fonte di verità per la
campanella, deve essere immediata), poi accoda un job per il fan-out
Slack/Google Chat invece di eseguirlo inline.

## Checklist di verifica

- [ ] Un utente `VIEWER` senza membership sul dipartimento di una procedura
      `RESTRICTED` non la vede più in `GET /api/procedures`
- [ ] `npx prisma migrate dev` non necessario per questa fase (nessuna
      modifica schema) — solo `npm install` per le nuove dipendenze
- [ ] `docker compose up -d` avvia anche Redis senza errori
- [ ] Pubblicare una procedura critica risponde immediatamente (non più
      bloccato dal fan-out); il worker `notifications` processa il job e le
      notifiche Slack/Google Chat arrivano comunque, solo in modo asincrono
- [ ] Riavviando il worker a metà di un batch di notifiche, nessun utente
      riceve la stessa notifica due volte (BullMQ garantisce at-least-once —
      verifica che il job sia idempotente o deduplicato)
- [ ] `npx tsc --noEmit` pulito
