# Direzione visiva

**Tesi (aggiornata 19 ago 2026)**: Procedure Hub è la sala controllo delle
procedure aziendali, non un altro clone di Notion. Ogni procedura ha uno
stato, un proprietario, una versione — e si vede a colpo d'occhio, non si
scava per trovarla. Precisione invece di decorazione: bordi netti, dati
allineati, un solo colore-segnale che non è mai anche un colore di stato.
Il movimento ha sempre un motivo — risponde a un evento reale del prodotto
(cambio di stato, ricerca in corso, una lista che compare), mai decorazione
a sé stante.

> Nota storica: questa è la **terza** direzione visiva del progetto. La
> prima (palette ink/paper `#F7F5F0` su `#141A2E`, titoli in Source Serif 4)
> fu sostituita durante lo sviluppo del motore a blocchi da una seconda,
> ispirata a Notion (superfici bianche, blu `#2383E2`, Inter per tutto) —
> perché l'editor doveva "leggersi come una pagina Notion" e il serif
> "sembrava vecchio" accanto a quell'editor. Quella seconda direzione aveva
> comunque un limite dichiarato: assomigliava troppo a Notion senza una
> propria identità. "Control Room" (questa, 19 ago 2026) la sostituisce.

## Token

- **Colore**: superficie "carta fredda" (`180 12% 97%`, non crema — bias
  freddo verso l'accento, non calore), testo quasi-nero con bias freddo
  (`200 15% 15%`). Accento **teal-cyan** `--primary: 186 78% 32%`
  (`#0E7C86`-ish) per azioni primarie e link — sostituisce il blu Notion.
  Ambra (`--stamp-amber`, invariata) per "in approvazione", verde
  (`--stamp-green`, invariata) per pubblicato/confermato, rosso
  (`--destructive`, invariato) per rifiutato/critico — **questi tre restano
  colori di stato, mai riusati come accento di brand**: è la regola che
  tiene distinti "cosa sta succedendo a questa procedura" da "questo è un
  link/pulsante". Dark mode non è più solo teorico: `--background: 195 22%
  7%` (quasi-nero con bias teal, non il carbone neutro di Notion),
  `--primary` diventa un ciano più chiaro (`178 55% 55%`) per restare
  leggibile su fondo scuro, con testo scuro sui pulsanti primari (non
  bianco — il ciano chiaro non regge abbastanza contrasto con il bianco).
  Attivabile davvero: `next-themes`, toggle chiaro/scuro/sistema nel
  topbar. Tutti i token vivono come CSS variable in `src/app/globals.css`
  (`:root` / `.dark`), consumati da `tailwind.config.ts`.
- **Tipografia**: **Archivo** per i titoli (`--font-display`) — un grotesk
  condensato/tecnico, più carattere di Inter ma un vero webfont
  cross-platform (a differenza di Bahnschrift, usato nel concept pitch
  iniziale ma disponibile solo su Windows — sbagliato per 200 dipendenti
  su dispositivi misti). Inter resta per il corpo testo — si legge meglio
  a lungo di quanto farebbe Archivo. IBM Plex Mono invariato, riservato ai
  codici procedura e al testo dentro `StatusStamp`.
- **Movimento**: quattro primitive in `globals.css`, esposte anche come
  animazioni Tailwind (`tailwind.config.ts`), tutte avvolte in
  `prefers-reduced-motion`:
  - `pill-settle` — un piccolo rimbalzo quando `StatusStamp` cambia stato
    (`key={status}` forza il remount).
  - `rise` — comparsa in sequenza per liste (righe dashboard, cronologia
    versioni) via un prop `index` che scala `animation-delay`.
  - `pulse-ring` — anello pulsante per indicatori di presenza/attività.
  - `scan-sweep` — riflesso che attraversa un campo di ricerca mentre una
    query è in corso (`components/ui/scan-bar.tsx`).
  **Aggiornato 20 ago 2026** (fine Traccia 1, `docs/REDESIGN-FEATURE-AUTOMATION-PLAN.md`):
  ogni pagina autenticata ha ricevuto un passaggio reale, non solo il font
  del titolo — verificato nel browser, non solo letto nel codice, dopo che
  un primo giro era risultato più superficiale di quanto documentato (vedi
  cronologia in cima al piano). Copertura: chrome (sidebar/topbar),
  `StatusStamp`, dashboard, KPI admin, ricerca, pagina procedura (workflow
  panel, allegati), titoli *dentro* il contenuto pubblicato e i due menu
  slash-command, viste Database (Tabella/Bacheca/Galleria/Calendario — le
  ultime due nuove, vedi Traccia 2), crea/modifica procedura, confronto
  versioni, pagina workspace (`pages/[id]`), impostazioni admin e
  automazioni (incluso il pannello regole), dipartimento, notifiche,
  Chiedi (Q&A AI), notifiche personali, login e cambio password. Non
  decorazione sparsa: liste usano lo stagger (`animate-rise` + `index` che
  scala `animation-delay`, tetto a ~12-20 elementi così una lista lunga non
  impiega secondi a comparire), pagine a form/dettaglio usano una sequenza
  di comparsa a sezioni. `export-menu.tsx` è l'unico punto lasciato
  invariato per scelta esplicita — già animato via Radix/tailwindcss-animate,
  nulla da aggiungere.
- **Layout**: sidebar con gerarchia dipartimentale reale (non decorativa),
  breadcrumb che rispecchia la struttura Department → Process → Procedure —
  invariato dalla direzione precedente.
- **Componenti**: build su shadcn/ui sopra i primitivi Radix già in uso
  (dialog, dropdown-menu, select, tabs, tooltip, avatar) — vedi
  `src/components/ui/`. Nuovi componenti UI passano da lì, non da markup
  Radix scritto a mano da zero.

## Elemento firma

Lo `StatusStamp` (badge di stato workflow, `src/components/procedures/status-stamp.tsx`)
resta l'unico elemento "audace": bordo spesso, maiuscolo, letter-spacing
largo, font mono — pensato per leggersi come un timbro di approvazione anche
dentro un'interfaccia altrimenti disciplinata. Ora si assesta con un piccolo
rimbalzo quando lo stato cambia (`animate-pill-settle`), ma resta l'unico
posto dove ci si concede un movimento vistoso — ovunque altro la UI resta un
tool digitale pulito, non un'imitazione di modulo.

## Cosa NON abbiamo fatto

Niente sfondo crema+serif+terracotta (il default AI-generated più comune),
niente dark-mode-con-accento-acido, niente broadsheet a colonne dense.
Niente proliferazione di elementi "a timbro" — se tutto sembra un timbro,
niente lo sembra: `StatusStamp` resta l'unica eccezione al linguaggio visivo
altrimenti standard. Niente accento di brand riusato come colore di stato
(o viceversa) — sono due domande diverse ("cos'è questo prodotto" vs "cosa
sta succedendo a questa procedura") e devono restare visivamente distinte.

## Origine

Questa direzione nasce da un concept pubblicato come artifact standalone
("Control Room") durante una sessione di audit/prodotto il 18-19 ago 2026,
approvato dall'utente prima di essere applicato al codice reale. Il concept
usava font di sistema Windows (Bahnschrift/Consolas) per limiti tecnici
dell'ambiente artifact (niente CDN font); l'implementazione reale qui
descritta usa invece Archivo via `next/font/google` per la stessa ragione
spiegata sopra sotto Tipografia.
