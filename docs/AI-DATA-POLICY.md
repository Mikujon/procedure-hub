# Policy dati per le funzionalità AI

*Scritto il 18 ago 2026 come remediation del finding SEC-07 (audit
sicurezza/GDPR). Da far rivedere a Legal/Compliance prima di usare le
funzionalità AI su procedure reali, non solo su dati demo.*

## Cosa esce dal tenant, e verso chi

Ogni funzionalità AI del prodotto — Q&A (`/ask`), Suggest Mode, gap
analysis, executive summary, completamento sezione — passa dal singolo
punto `src/lib/ai/client.ts`, che oggi parla con **Google Gemini** tramite
`GEMINI_API_KEY` (`@google/genai`).

Il contenuto inviato è quello costruito da `buildAiContext()`
(`src/lib/ai/context.ts`): il markdown completo della procedura (tutti i
blocchi) più metadati (titolo, reparto, tag di compliance, versione). Per
`/ask`, il contenuto di più procedure può finire nello stesso prompt.

**Il controllo di accesso è già solido**: `/ask` filtra sempre i risultati
di ricerca con `visibilityWhereClause()` prima di costruire il contesto —
un utente non riceve mai una risposta basata su una procedura che non
potrebbe aprire direttamente. Questo però risponde alla domanda "chi nella
mia azienda può vedere questo output", non a "Google può usare questo
contenuto per altro". Sono due rischi diversi; questo documento tratta il
secondo.

## Il problema: free tier vs paid tier

`.env.example` lo dichiara esplicitamente: la chiave è configurata sul
**Gemini API free tier / Google AI Studio**, non su Vertex AI o sul Gemini
API a pagamento.

Verificato il 18 ago 2026: sul free tier di Google AI Studio e sulla quota
gratuita del Gemini API, **Google può usare i contenuti inviati per
fornire, migliorare e sviluppare i propri prodotti — inclusi eventuali
revisori umani**. Il Gemini API a pagamento e Vertex AI, al contrario,
**si impegnano contrattualmente a non addestrare modelli sui prompt e le
risposte dei clienti**.

C'è un'eccezione rilevante per un'azienda italiana: **se l'account che
genera la chiave API si trova nello Spazio Economico Europeo, in Svizzera
o nel Regno Unito, si applicano i termini del servizio a pagamento (niente
training) anche sul free tier.** Non è verificato in questo audit se
l'account/organizzazione Google che genera oggi `GEMINI_API_KEY` rientri
in questa eccezione — dipende da dove è registrato l'account Google
Cloud/AI Studio usato, non da dove gira il server.

## Raccomandazione

**Prima di inviare contenuto di procedure reali (non demo) alle
funzionalità AI**, uno dei due:

1. **Verificare per iscritto con Google** (o con il proprio referente
   Google Cloud) che l'account usato per `GEMINI_API_KEY` rientra
   nell'eccezione EEA/Svizzera/UK, oppure
2. **Passare al Gemini API a pagamento o a Vertex AI** — stesso modello,
   impegno contrattuale di non-training incondizionato, `lib/ai/client.ts`
   è già isolato per questo (cambiare provider tocca un file, non le 6+
   route che lo chiamano).

Finché una delle due non è confermata, trattare le funzionalità AI come
**non confermate sicure per contenuto GDPR/ISO27001/SOC2-taggato** — anche
se tecnicamente raggiungibile solo dagli utenti autorizzati a vedere quella
procedura.

## Interruttore di emergenza

`AI_FEATURES_ENABLED=false` in `.env` disabilita ogni funzionalità AI
dell'intero tenant senza un deploy — il controllo vive in
`src/lib/ai/client.ts` (`assertAiEnabled()`), chiamato da `generateText()`
e `streamText()`, quindi nessuna delle 6+ route che li usano può bypassarlo.
Di default resta attivo (`true`) per non cambiare il comportamento attuale;
è pensato per essere spento da Compliance con una singola modifica di
configurazione, in attesa della verifica sopra.

## Fonti

- [Google AI Studio Pricing (2026): Free, Paid Plans & Gemini API Costs](https://www.nocode.mba/articles/google-ai-studio-pricing)
- [Google Gemini Data Retention Policy 2026 — Does Gemini Train on Your Data?](https://meetily.ai/llm-privacy/gemini)
- [Google AI Studio vs Gemini vs Vertex AI: Which Platform Do You Need?](https://hoerrsolutions.com/google-ai-studio-gemini-vertex-ai-comparison/)

Verificare comunque i termini ufficiali Google aggiornati
(ai.google.dev/gemini-api/terms) prima di una decisione definitiva — le
fonti sopra sono articoli di terze parti, utili per orientarsi ma non
sostituiscono il testo legale originale.
