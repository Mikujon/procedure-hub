# Fase 5a — AI-readiness (fondamenta, non feature)

## Prerequisito

Fase 2b (modello di contenuto unificato) e Fase 3a (ruoli/mansioni)
completate. Fase 2 (Database/relazioni) consigliata ma non bloccante.

## Obiettivo

Questa fase **non introduce nessuna funzionalità visibile all'utente**. È la
risposta diretta al principio guida posto esplicitamente per questo piano:
*i dati devono essere strutturati pensando all'uso da parte di un'AI fin
dall'inizio, non aggiunto in coda*. Prima di costruire Q&A interattivo o
generazione da multimediale (Fase 5, esistente), serve una fondazione
condivisa che ogni feature AI futura riusa invece di reinventare — altrimenti
ogni feature avrà la propria serializzazione ad hoc del contenuto, gli stessi
dati raccontati in modi leggermente diversi a modelli diversi, con derive
silenziose nel tempo.

## Perché farlo così (contesto per Claude Code)

Due decisioni prese qui, e il perché:

1. **Niente vector store dedicato per ora.** Alla scala dichiarata (~200
   utenti, migliaia di procedure), MeiliSearch — già in produzione, già
   multi-tenant per costruzione (`src/lib/search.ts`, un indice per tenant) —
   è sufficiente come motore di retrieval per un Q&A grounded. Aggiungere
   `pgvector` o un vector store esterno ora sarebbe complessità non
   giustificata da un bisogno misurato. Rivalutare solo se, in fase di test
   della Fase 5, il retrieval per parole chiave si dimostra insufficiente
   per domande formulate in linguaggio naturale molto lontano dal testo
   esatto della procedura.
2. **Una funzione sola per "che aspetto ha una pagina per un'AI".** Non un
   endpoint AI che legge `Block` direttamente a modo suo — ogni feature
   futura chiama la stessa `buildAiContext()`. È questo, concretamente, che
   rende i dati "pronti": non una proprietà astratta, una funzione condivisa
   che nessuno bypassa.

## Backend

`src/lib/ai/client.ts` — wiring centralizzato del client Anthropic
(`@anthropic-ai/sdk`, come già indicato in
`New plan/05-analisi-funzionali-ai.md` per la Fase 5 vera e propria — la
scrivi qui perché è infrastruttura, non una feature specifica di quella
fase):

```ts
import Anthropic from "@anthropic-ai/sdk";

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
export const AI_MODEL = "claude-sonnet-4-6"; // mai hardcoded altrove
```

`src/lib/ai/context.ts` — la funzione chiave di questa fase:

```ts
interface AiContext {
  markdown: string;      // contenuto pulito, leggibile, gerarchia intatta
  metadata: {
    title: string;
    department: string;
    jobRoles: string[];       // da Fase 3a
    tags: string[];
    complianceTags: string[]; // sottoinsieme di tags note come normative
    status: string;
    versionNumber: number;
    lastUpdated: string;      // ISO date
  };
}

export async function buildAiContext(procedureId: string): Promise<AiContext> {
  // 1. Carica Procedure + currentVersion + tags + jobRoles (Fase 3a) + department
  // 2. Carica l'albero Block via buildBlockTree() (src/lib/blocks/tree.ts, già scritta)
  // 3. Converte l'albero in Markdown pulito (non HTML, non ProseMirror JSON —
  //    Markdown è il formato che un LLM legge in modo più efficiente ed è
  //    meno soggetto ad allucinazioni sulla struttura rispetto a JSON annidato)
  // 4. Compone l'header di metadati + il markdown, ritorna AiContext
}
```

Nota implementativa: il passo 2-3 è concettualmente l'inverso di
`src/lib/blocks/serialize.ts::blocksToProseMirrorDoc` (Fase 1) — lì si va da
`Block[]` a ProseMirror/HTML per `ProcedureVersion`; qui si va da `Block[]` a
Markdown per il consumo AI. Stessa struttura ad albero, output diverso:
valuta se estrarre un walker comune parametrizzato sul renderer del nodo
finale, invece di duplicare la logica di attraversamento dell'albero.

**Aggancio dell'indice di ricerca — collegamento mai fatto, roadmap
`CLAUDE.md` punto 2.** `indexProcedure()`/`removeFromIndex()`
(`src/lib/search.ts`) esistono ma nessuna route le chiama. Aggancia:
- `POST /api/procedures/[id]/blocks/publish` (Fase 1) — dopo il commit della
  transazione, come già fa con `notifyEvent`.
- `PATCH /api/procedures/[id]/route.ts` (percorso legacy, ancora usato per
  titolo/summary su procedure non ancora aperte nell'editor a blocchi) —
  stesso punto.
- `POST /api/procedures/[id]/archive` — chiama `removeFromIndex` (una
  procedura archiviata non deve comparire nei risultati di ricerca né nelle
  risposte del futuro Q&A).

Senza questo aggancio, nessuna feature di retrieval — ricerca o AI — lavora
mai su dati aggiornati.

Script di backfill una tantum: `scripts/reindex.ts` (già nominato in
`docs/ARCHITECTURE.md` come lavoro roadmap) — itera tutte le `Procedure`
pubblicate del tenant e chiama `indexProcedure()`.

## Checklist di verifica

- [ ] `buildAiContext(procedureId)` ritorna markdown leggibile e metadata
      completi per una procedura di test con blocchi annidati (liste,
      checklist, tabella)
- [ ] Pubblicare una nuova versione (sia via `blocks/publish` sia via il
      `PATCH` legacy) aggiorna l'indice MeiliSearch entro la stessa richiesta
- [ ] Archiviare una procedura la rimuove dai risultati di ricerca
- [ ] `npx tsx scripts/reindex.ts` popola l'indice da zero per un tenant
      senza duplicati se rilanciato (idempotente)
- [ ] Nessuna chiave `ANTHROPIC_API_KEY` finisce committata — verifica che
      sia solo in `.env`/`.env.example` come placeholder
- [ ] `npx tsc --noEmit` pulito
