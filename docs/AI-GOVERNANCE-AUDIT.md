# Audit di governance AI — Procedure Hub

*Primo audit, 17 set 2026. Eseguito da Claude Code contro
`reference/AI_Development_Standard.docx` §7 (checklist a 42 punti),
`wearefiber/ai-governance-kit` versione `v1.3.1`. Tier: **T3 — Critico/
Regolamentato** (vedi `PROJECT.md` per il ragionamento di classificazione).*

*Ogni riga qui sotto è verificata contro il codice/repo reale — non
assunta. Dove non verificabile da questa sandbox (deployment, vault
aziendale, hub condiviso che non esiste ancora), è segnato `N/A` con il
motivo, non `Pass` per default.*

**Nota architetturale preliminare**: `AI_PROJECT_STRUCTURE.md` §1 dice
esplicitamente di seguire lo stack di un codebase esistente e annotare
l'eccezione, invece di forzare NestJS/OpenFGA su un progetto già in
sviluppo. Procedure Hub è Next.js + Prisma + RBAC custom
(`lib/permissions/index.ts`), non NestJS/ReBAC-OpenFGA. Questa è
un'eccezione dichiarata, non una non-conformità di per sé — eccetto dove
il gap ha conseguenze pratiche reali (vedi item 13, 31).

---

## 5.1 — Security & cyber approval (1–10)

| # | Requisito | Esito | Evidenza |
|---|---|---|---|
| 1 | Classificazione dati (Public/Internal/Confidential/Restricted) assegnata | **Fail** | Esiste `Visibility` (`PUBLIC`/`DEPARTMENT`/`RESTRICTED`, `prisma/schema.prisma:569`) — ma è un concetto di **controllo accesso** (chi può vedere una procedura), non la tassonomia di **sensibilità del dato** richiesta da Appendix A. Nessun campo/etichetta mappa un dato a Public/Internal/Confidential/Restricted. |
| 2 | Autenticazione SSO/OAuth2; nessuna credenziale hardcoded | **Partial** | NextAuth con Credentials + Azure AD SSO pronto (`lib/auth.ts`) — SSO reale non ancora verificato con un tenant Azure vero (roadmap #1, ancora bloccato). Scan di credenziali hardcoded nel codice: nessuna trovata. |
| 3 | Segreti nel vault aziendale, mai in source control | **Partial** | `.env`/`.env.local`/`.env.docker` correttamente in `.gitignore`. Nessun vault aziendale condiviso in uso — i segreti vivono in variabili d'ambiente locali/deploy, non in un vault centralizzato (perché quel vault non esiste ancora a livello aziendale, per quanto emerso da questo kit). |
| 4 | TLS 1.2+ in transito; cifratura a riposo | **N/A** | Dipende dall'ambiente di deployment reale (non ancora scelto/verificato — vedi `docs/BACKUP-RESTORE.md`, "non ancora deciso... dipende da dove verrà effettivamente ospitato l'ambiente di produzione"). Non verificabile da questa sandbox. |
| 5 | Provider AI terzi verificato per residenza/retention dati; DPA firmato se i dati personali escono dall'azienda | **Partial — già il più maturo di questo audit** | `docs/AI-DATA-POLICY.md` (scritto **prima** di questo audit, come remediation di un altro finding) affronta esattamente questo punto: Gemini free tier vs paid/Vertex, l'eccezione EEA, raccomandazione esplicita di verificare o passare al tier a pagamento **prima** di usare l'AI su contenuto reale. Non ancora risolto (nessuna verifica scritta con Google, nessun DPA firmato) — ma è l'unico item di questo intero audit già analizzato per iscritto con una remediation chiara proposta. |
| 6 | Rischio prompt-injection/data-leakage valutato e documentato per componenti generativi | **Fail** | Nessun documento lo tratta. Rischio reale e non ipotetico: `/ask` costruisce il prompt da contenuto procedura (`buildAiContext()`, `lib/ai/context.ts`) — testo scritto da utenti interni con permessi di editing, non solo da admin fidati; un editor malizioso o compromesso potrebbe scrivere istruzioni nel corpo di una procedura per influenzare l'output AI mostrato ad altri utenti che fanno una domanda. |
| 7 | Logging accessi/utilizzo abilitato, conservato ≥12 mesi | **Partial** | `AuditLog` registra ogni azione che cambia stato (regola architetturale 2) e non viene **mai** cancellato (`ARCHITECTURE.md`: "Non cancellare mai righe di audit") — quindi la conservazione è di fatto illimitata per quelle azioni. Non copre però l'accesso in **lettura** (chi ha aperto/visualizzato una procedura) — il requisito parla di "access and usage logging", più ampio del solo audit di stato. |
| 8 | Scan dipendenze/vulnerabilità completato prima del go-live | **Fail** | `npm audit` eseguito ora per questo audit: **43 vulnerabilità (40 moderate, 2 high, 1 critical)**. Nessun workflow CI esiste (`.github/workflows/` assente) — quindi nessuno scan gira automaticamente su nessuna PR. |
| 9 | Penetration test completato prima del go-live (tier High) e annualmente | **Fail** | Non eseguito — nessun ambiente di produzione reale esiste ancora da testare. |
| 10 | Approvazione scritta registrata nell'Hub (approvatore, tier, data, scadenza) | **Fail** | Nessun Hub esiste ancora lato azienda (`GOVERNANCE.md`: solo il seat Chair è assegnato, Security/Legal sono `TBD`) — non c'è dove registrarla. |

## 5.2 — Shared data architecture & integration (11–17)

| # | Requisito | Esito | Evidenza |
|---|---|---|---|
| 11 | Scelta dello store dati verificata contro piattaforme/schemi condivisi esistenti | **N/A** | Progetto stand-alone, nessuna piattaforma dati condivisa aziendale documentata da verificare contro. |
| 12 | Schema/data dictionary pubblicato e linkato dall'Hub | **Partial** | `prisma/schema.prisma` ha commenti inline estesi che spiegano il "perché" di ogni scelta (`CLAUDE.md` lo cita esplicitamente) — è un buon data dictionary de facto, ma non è pubblicato/linkato in nessun Hub (che non esiste) né in un formato standalone (es. dbdocs, un `docs/data-dictionary.md` dedicato). |
| 13 | Dati esposti ad altri tool solo via API/event stream documentata — mai un link diretto non documentato | **Partial** | Sync SharePoint e azione `SEND_WEBHOOK` sono entrambi outbound documentati (`CLAUDE.md`), non un DB link diretto — corretto nello spirito. Ma non esiste una vera API pubblica **versionata** con un contratto formale (schema richiesta/risposta, SLA) per nessuno dei due — sono integrazioni punto-a-punto configurabili, non un'interfaccia documentata e versionata in senso stretto. |
| 14 | Politica di versioning/deprecazione API definita per ogni interfaccia esposta | **Fail** | Nessuna versione né politica di deprecazione per `/api/*` — le route REST non hanno un prefisso di versione (`/api/v1/...`) né un changelog di breaking change separato dal changelog generale del progetto. |
| 15 | Contratto dati documentato (schema richiesta/risposta, SLA di disponibilità) | **Fail** | Nessun documento di contratto dati per le integrazioni esistenti. |
| 16 | Politica di retention/deletion dati definita e implementata | **Partial** | Esiste un backup/restore **testato dal vivo** (`docs/BACKUP-RESTORE.md`, 18 ago 2026: pg_dump/restore reale, conteggi verificati, integrità referenziale confermata) — ma esplicitamente **non** una policy di retention/deletion schedulata: il documento stesso dice "non ancora deciso... dipende da dove verrà ospitato l'ambiente di produzione". Nessuna cancellazione automatica di dati personali scaduti (diritto all'oblio GDPR) risulta implementata. |
| 17 | Naming conforme alla convenzione dati/servizi dell'azienda | **N/A** | Nessuna convenzione aziendale nota/documentata da verificare contro in questo kit. |

## 5.3 — Process wiki & technical documentation (18–24)

| # | Requisito | Esito | Evidenza |
|---|---|---|---|
| 18 | Overview e diagramma architetturale pubblicati | **Partial** | `docs/ARCHITECTURE.md` è una overview narrativa solida (stack, multi-tenancy, modello dati, workflow) — ma **nessun diagramma reale** (nessun Mermaid, nessuna immagine, verificato via grep). |
| 19 | Diagramma di data-flow pubblicato (input, processing, output) | **Fail** | Non esiste, né come diagramma né come narrativa dedicata. |
| 20 | Runbook (deploy, rollback, escalation on-call) pubblicato | **Fail** | Nessun `docs/runbook.md` o equivalente. |
| 21 | Procedura di exception-handling/fallback manuale documentata | **Partial** | `docs/BACKUP-RESTORE.md` copre il fallback per un disaster-recovery del DB. Nessuna procedura di fallback per gli altri componenti (es. cosa fa un utente se MeiliSearch/Redis/lo storage S3 sono giù — il codice ha già fail-open/graceful-degradation per alcuni di questi, es. rate limiting fail-open su Redis irraggiungibile, ma non è **documentato** come procedura per un umano). |
| 22 | Log delle versioni di modello/prompt mantenuto per componenti generativi | **Fail** | `lib/ai/client.ts` usa `"gemini-flash-latest"` — un alias che segue automaticamente l'ultimo modello di Google, non una versione pinnata — e non logga token/latenza/versione per chiamata. Un cambio di comportamento del modello sottostante sarebbe silenzioso, non un diff rivedibile. |
| 23 | Documentazione ospitata sul wiki aziendale e linkata dall'Hub | **Fail** | La documentazione vive solo nel repo (`docs/`, `CLAUDE.md`) — nessun wiki aziendale collegato (perché non esiste ancora un Hub a cui collegarla). |
| 24 | Il technical owner aggiorna la documentazione a ogni modifica rilevante, non solo in fase di audit | **Pass — il punto più forte di questo intero audit** | `CLAUDE.md` è aggiornato **ad ogni singola sessione di sviluppo** con un changelog narrativo dettagliato (data, cosa cambiato, bug reali trovati, come verificato dal vivo) — una disciplina di documentazione-mentre-si-costruisce genuinamente rara, esattamente lo spirito di questo requisito. |

## 5.4 — Scope & problem statement (25–29)

| # | Requisito | Esito | Evidenza |
|---|---|---|---|
| 25 | Business problem statement completato con il template standard (Appendix C) | **Partial** | `CLAUDE.md` "Cos'è questo progetto" copre il problema di business in prosa, ma non nel formato a campi di Appendix C (Business problem / Target users / In-scope / Out-of-scope / Success metric). |
| 26 | Utenti target e volume d'uso atteso definiti | **Pass** | "~200 utenti per tenant" dichiarato esplicitamente in `CLAUDE.md`. |
| 27 | In-scope/out-of-scope elencati esplicitamente | **Fail** | Nessuna lista esplicita in/out-of-scope — la roadmap in `CLAUDE.md` implica cosa è dentro scope (es. Jira/ServiceNow via webhook generico, non un adapter dedicato) ma non è un elenco formale. |
| 28 | Metrica di successo/KPI definita, con baseline prima del go-live | **Fail** | Non trovata in nessun documento. |
| 29 | Approvato dal business owner prima dell'inizio del build | **Fail** | Il progetto è già in sviluppo attivo da settimane; nessun business owner è ancora nominato (vedi `PROJECT.md`) — questo item, per definizione, non può essere soddisfatto retroattivamente. |

## 5.5 — Ownership (30–33)

| # | Requisito | Esito | Evidenza |
|---|---|---|---|
| 30 | Business owner e technical owner nominati nell'Hub | **Fail — gap aperto più urgente di questo audit** | Nessun owner nominato. L'interview di classificazione (`AI_INTAKE_ASSESSMENT.md`) lo ha chiesto esplicitamente; nessuna risposta ricevuta finora. |
| 31 | Matrice RACI completata (Appendix B) | **Fail** | Non esiste. |
| 32 | Trasferimento ownership entro 5 giorni lavorativi da cambio ruolo/uscita | **N/A** | Non applicabile senza un owner nominato da cui trasferire. |
| 33 | Nessun tool resta registrato a una persona non più nel ruolo oltre la SLA di trasferimento | **N/A** | Stesso motivo. |

## 5.6 — Automatic review reminder (34–38)

| # | Requisito | Esito | Evidenza |
|---|---|---|---|
| 34 | Tier di rischio assegnato (High/Medium/Low) | **Pass** | Fatto in questo stesso audit — T3/High, `PROJECT.md`. |
| 35 | Cadenza di revisione impostata di conseguenza (trimestrale per High) | **Fail** | Nessun meccanismo di reminder impostato — solo appena classificato ora. |
| 36 | Reminder configurato per notificare business owner, technical owner e la funzione security | **Fail** | Nessun owner nominato a cui notificare (item 30), nessun meccanismo di reminder esistente. |
| 37 | Ogni revisione ri-valuta sia il rischio cyber sia l'utilità del tool | **N/A** | Nessuna revisione ancora avvenuta — il progetto è appena stato classificato. |
| 38 | Una revisione mancata segnala automaticamente il tool come non conforme dopo 30 giorni di grazia | **Fail** | Nessun meccanismo del genere esiste (dipenderebbe dall'Hub, che non esiste ancora). |

## 5.7 — RPA / utility hub registration (39–42)

| # | Requisito | Esito | Evidenza |
|---|---|---|---|
| 39 | Tool registrato nell'hub centrale di automazione/utility | **Fail** | Nessun Hub esiste ancora a livello aziendale (`GOVERNANCE.md` conferma solo il seat Chair assegnato). |
| 40 | Volume di utilizzo tracciato e riportato | **Fail** | Non tracciato in modo centralizzato (esistono dati grezzi in `AuditLog`/dashboard KPI interna, ma non alimentano un hub aziendale). |
| 41 | Risparmio di tempo/costo stimato e registrato | **Fail** | Non stimato. |
| 42 | Cifra di risparmio aggiornata almeno trimestralmente | **N/A** | Dipende dall'item 41. |

---

## Risultato complessivo

| Esito | Conteggio |
|---|---|
| **Pass** | 2 (#24, #26) — più #34, appena soddisfatto da questo stesso audit |
| **Partial** | 9 (#2, #3, #5, #7, #12, #13, #16, #18, #21, #25) |
| **Fail** | 24 |
| **N/A** (dipendente da infrastruttura/Hub aziendale non ancora esistente) | 7 |

**Risultato: ☐ Certified · ☒ Partial — remediation required · ☐ Non-compliant**

Non è "Non-compliant" nel senso di negligenza — è un progetto reale, con
disciplina di audit trail, RBAC, test automatici (155 test, coperti
estesamente per RBAC/multi-tenancy) e documentazione-mentre-si-costruisce
genuinamente sopra la media (item #24), costruito **prima** che questo
kit di governance esistesse in azienda. Ma contro il metro di misura
formale del kit, la maggioranza dei 42 item non è ancora soddisfatta,
principalmente per due ragioni strutturali, non per singoli bug:

1. **Nessun Hub di governance esiste ancora in azienda** (7 seat/registri
   `TBD` in `GOVERNANCE.md`) — undici dei 42 item (owner, RACI, hub
   registration, reminder automatico) non sono soddisfacibili da questo
   solo progetto, sono bloccati su un pezzo di infrastruttura aziendale
   che deve esistere prima.
2. **Nessuna pipeline CI/CD esiste** (`.github/workflows/` assente) —
   questo è invece rimediabile subito, a livello di singolo progetto, e
   spiega da solo tre Fail concreti (#8 scan dipendenze, il SAST
   richiesto da `AI_PROJECT_STRUCTURE.md` §7, e indirettamente #35/#38).

## Le tre remediation più concrete e più a buon mercato

Se dovessi scegliere dove intervenire per primo, in ordine di
rapporto-impatto/costo:

1. **`npm audit fix`** (o valutazione mirata delle 43 vulnerabilità, 1
   critical + 2 high) — un comando, chiude item #8 in modo sostanziale.
2. **Una pipeline CI minima** (`.github/workflows/ci.yml`: lint → test →
   `npm audit` → build) — il progetto ha già 155 test reali che girano
   con `npm test`, manca solo il collegamento a un workflow che li esegua
   su ogni PR. Chiude la lacuna SAST/dependency-scan di
   `AI_PROJECT_STRUCTURE.md` §7 (T2+) in un colpo solo.
3. **Un'analisi scritta del rischio prompt-injection per `/ask`** (item
   #6) — nessun codice da scrivere, solo documentare la superficie di
   rischio già nota (contenuto scritto da editor interni entra nel
   prompt) e la mitigazione esistente (RBAC + `filterVisibleProcedureHits`
   filtrano già chi può leggere l'output, ma non impediscono a un editor
   di scrivere istruzioni nel corpo del testo).

Il resto (owner, RACI, Hub, penetration test, DPA con Google) richiede
decisioni umane/organizzative che questo audit può solo segnalare, non
prendere al posto vostro — esattamente la distinzione che
`PROJECT_STARTER_T3_CRITICAL.md` fa esplicitamente: "flag to the user
any Section 5 requirement that needs a person, not code."
