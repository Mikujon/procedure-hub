# Piano di evoluzione — Procedure Hub v1 → v2 (motore a blocchi)

Questo è l'indice. Dai a Claude Code **un file fase alla volta**, nell'ordine
sotto — non tutti insieme. Ogni file presuppone che la fase precedente sia
stata completata e funzionante (`npm run dev` senza errori, migration
applicata). Non passare alla fase successiva finché quella corrente non
compila e non è stata verificata a mano.

## Perché in fasi separate

La Fase 1 è una riscrittura architetturale profonda (il modello di
contenuto cambia da "un documento Tiptap per procedura" a "albero di
blocchi indipendenti"). Se va storta, tutto il resto costruito sopra eredita
l'errore. Dare una fase alla volta permette di validare prima di procedere.

## Ordine

1. **`01-motore-blocchi.md`** — ✅ **fatta**. Generalizza l'editor esistente
   in un vero motore a blocchi componibili, con collaborazione real-time
   (base di tutto il resto).
2. **`02a-fondamenta-scalabilita.md`** — nuova, inserita dopo un audit
   architetturale: corregge un gap di permessi e un loop di notifiche
   bloccante trovati per lettura diretta del codice, e introduce Redis una
   volta sola (serve a questa fase, alla collaborazione multi-istanza, e
   alla futura coda di trascrizione multimediale in Fase 5).
3. **`02b-unificazione-modello-contenuto.md`** — nuova: risolve una
   duplicazione trovata durante l'audit — `Page.content` (preesistente, un
   blob JSON singolo) e il nuovo `Block` (Fase 1) sono oggi due modelli di
   contenuto diversi e incompatibili. Va fatta prima della Fase 2 sotto,
   altrimenti il Registro Procedure non saprebbe a quale modello agganciarsi.
4. **`02-database-relazioni.md`** — costruisce il motore Database (tabelle,
   colonne tipizzate, viste multiple, relazioni/rollup). Invariata, ma va
   eseguita dopo 02a/02b, non prima.
5. **`03a-ruoli-e-mansioni.md`** — nuova, richiesta esplicitamente per
   allinearsi ai trend di mercato: assegnazione di procedure per
   mansione/ruolo aziendale (es. "Magazziniere"), non solo per dipartimento
   o singolo utente — gap non coperto da nessuna fase precedente.
6. **`03-governance-layer.md`** — retro-adatta le Procedure esistenti al
   nuovo modello: una Procedura diventa una Pagina + proprietà di
   governance, senza perdere il workflow già costruito.
7. **`04-read-ack-escalation.md`** — estende Read & Acknowledge con
   solleciti scalati multi-canale e conferma azionabile dalla chat.
8. **`05a-ai-readiness.md`** — nuova: **prima** di costruire qualunque
   feature AI, mette in piedi la fondazione condivisa (client Anthropic,
   serializzazione canonica del contenuto per un'AI, aggancio mai fatto tra
   pubblicazione e indice di ricerca). Senza questa fase, ogni feature AI
   successiva reinventerebbe la propria rappresentazione dei dati.
9. **`05-analisi-funzionali-ai.md`** — modulo template PRD/Analisi
   Funzionale + assistenza AI generativa in Suggest Mode, più (Parte C,
   aggiunta) Q&A interattivo sul campo e generazione da multimediale.

## Prima di iniziare, in ogni sessione

Dì a Claude Code di leggere, in quest'ordine:
1. `CLAUDE.md` nella root del progetto (contesto generale, regole
   architetturali da rispettare — multi-tenancy, audit trail, versioning
   immutabile, RBAC centralizzato)
2. `docs/ARCHITECTURE.md` (spiegazione estesa delle scelte esistenti)
3. Il file della fase corrente

## Regola che vale per tutte le fasi

Le regole in `CLAUDE.md` non sono sospese da questo piano, si applicano
anche al codice nuovo:
- Ogni query su dati aziendali filtra per `tenantId` risolto lato server.
- Ogni azione che cambia stato scrive una riga `AuditLog`.
- I controlli di permesso passano sempre da `lib/permissions/index.ts`.
- Le notifiche passano sempre da `notifyEvent()`.
- Le versioni formali (`ProcedureVersion`) restano immutabili.

Ogni file di fase, in fondo, ha una sezione **"Checklist di verifica"** —
prima di considerare la fase chiusa, tutti i punti vanno confermati veri.
