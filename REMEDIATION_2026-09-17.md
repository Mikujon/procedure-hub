# Remediation — Procedure Hub

Basato su: audit del 17 set 2026 (`AUDIT_2026-09-17.md`), tier T3.

Per ogni punto: applica la modifica, poi spunta. Non chiudere un punto
senza l'evidenza richiesta a fianco. **I tre punti Alta priorità
(#30, #6/#9/#10) non sono chiudibili da un assistente AI in autonomia —
richiedono una decisione umana/organizzativa, vedi ciascuno.**

## Da correggere

### Priorità Alta

- [ ] **#30 — Nessun business/technical owner nominato** — manca il nome
      della persona accountable per Procedure Hub. Evidenza richiesta:
      un nome per ciascun ruolo, registrato in `PROJECT.md`. *Non
      risolvibile da codice — richiede una decisione umana.*
- [ ] **#6/#9/#10 — Tre gate item T3 falliti** (valutazione
      prompt-injection, penetration test, approvazione security scritta)
      — per `AI_PROJECT_AUDIT.md` §6, questi vanno **escalati al
      Consiglio di Governance**, non semplicemente corretti. Evidenza
      richiesta: una decisione registrata del Consiglio (Chair + seat
      Security, quest'ultimo oggi `TBD` — instradato al Chair per
      default, `GOVERNANCE.md` §7) su se il progetto continua a girare
      durante la remediation o si ferma. *Non risolvibile da codice.*

### Priorità Media

- [ ] **#8 — 43 vulnerabilità nelle dipendenze** (1 critical, 2 high) —
      eseguire `npm audit fix` (verificare che non rompa nulla — 3
      pacchetti richiedono `--force` con breaking change, vedi output
      di `npm audit`) e rieseguire `npm test` (155 test) dopo. Evidenza
      richiesta: output di `npm audit` con 0 critical/high residui, più
      `npm test` verde.
- [ ] **Pipeline CI assente** (`.github/workflows/` non esiste) — collega
      i 155 test già esistenti (`npm test`) e `npx tsc --noEmit` a un
      workflow che gira su ogni PR, più `npm audit` come step. Evidenza
      richiesta: un run verde del workflow su una PR reale.
- [ ] **#6 (componente tecnico, oltre l'escalation sopra)** — documentare
      per iscritto la superficie di rischio prompt-injection per `/ask`
      (il contenuto che entra nel prompt è scritto da editor interni con
      permessi di modifica, non solo da admin fidati) e le mitigazioni
      esistenti (RBAC + `filterVisibleProcedureHits` filtrano chi legge
      l'output). Evidenza richiesta: un documento (es.
      `docs/AI-PROMPT-INJECTION-RISK.md`).
- [ ] **#22 — Nessun log versione modello/prompt** — `lib/ai/client.ts`
      usa l'alias `gemini-flash-latest`, non una versione pinnata, e non
      logga token/latenza/versione per chiamata. Evidenza richiesta: un
      log strutturato per chiamata AI (anche solo in `AuditLog` o
      equivalente) con il nome/versione modello usato.
- [ ] **#16 — Nessuna policy di retention/deletion dati formalizzata** —
      `docs/BACKUP-RESTORE.md` testa backup/restore ma non definisce una
      cadenza né una cancellazione dati personali scaduti (diritto
      all'oblio GDPR). Evidenza richiesta: un documento di policy con
      cadenza e meccanismo di cancellazione.
- [ ] **#5 — Provider AI terzo (Gemini) non ancora verificato/risolto** —
      `docs/AI-DATA-POLICY.md` già analizza il problema (free tier vs
      paid/Vertex, eccezione EEA) ma non è ancora stato verificato con
      Google né firmato un DPA. Evidenza richiesta: conferma scritta da
      Google/referente Cloud, o passaggio al tier a pagamento/Vertex AI.

### Priorità Bassa

- [ ] **#18/#19 — Nessun diagramma architetturale/data-flow reale** —
      `docs/ARCHITECTURE.md` è solo narrativa. Evidenza richiesta: un
      diagramma (Mermaid è sufficiente) aggiunto al documento esistente.
- [ ] **#20 — Nessun runbook** (deploy/rollback/on-call) — non esiste.
      Evidenza richiesta: `docs/runbook.md`.
- [ ] **#25/#27/#28 — Problem statement incompleto** rispetto al
      template Appendix C (in/out-of-scope espliciti, metrica di
      successo con baseline) — `CLAUDE.md` copre il problema in prosa
      ma non nel formato a campi. Evidenza richiesta: sezione dedicata
      in `PROJECT.md` nel formato Appendix C.
- [ ] **#31 — Nessuna matrice RACI** — non esiste. Evidenza richiesta:
      la tabella Appendix B compilata in `PROJECT.md`, possibile solo
      dopo aver chiuso #30.
- [ ] **#39–42 — Nessuna registrazione in un Hub aziendale** — non
      esiste ancora un Hub a livello aziendale a cui registrarsi
      (`GOVERNANCE.md`: solo il seat Chair è assegnato). *Bloccato su
      infrastruttura aziendale, non su questo progetto — non
      chiudibile finché l'Hub non esiste.*
- [ ] **#12/#13/#14/#15 — Data dictionary/contratto API non formalizzati**
      — `prisma/schema.prisma` ha buoni commenti inline ma nessun
      documento standalone pubblicato; nessuna API versionata per le
      integrazioni SharePoint/webhook. Evidenza richiesta: un
      `docs/data-dictionary.md` e un contratto dati per ciascuna
      integrazione esterna.
- [ ] **#21 — Fallback manuale documentato solo per il DB** — nessuna
      procedura scritta per MeiliSearch/Redis/storage S3 giù (il codice
      ha già fail-open per alcuni casi, ma non è una procedura per un
      umano). Evidenza richiesta: sezione aggiunta a
      `docs/BACKUP-RESTORE.md` o un nuovo `docs/exceptions.md`.

## Struttura di riferimento

Allinea la correzione a `PROJECT_STARTER_T3_CRITICAL.md` — non
reinventare la struttura, quella del tier confermato è già quella
giusta.

## Quando richiedere un nuovo audit

Solo dopo aver chiuso tutti i punti a priorità Alta — che qui includono
l'escalation stessa, non solo #30. I punti a priorità Media/Bassa non
bloccano una ri-verifica, ma un audit ri-eseguito mentre un gate item T3
resta aperto senza una decisione del Consiglio registrata ripeterebbe lo
stesso esito "Non conforme — escalation".
