# Direzione visiva

**Tesi (aggiornata)**: Procedure Hub è un registro operativo di compliance
costruito sull'affordance di un tool di produttività contemporaneo — non un
sito editoriale, non un generico SaaS senza identità. L'unico elemento che
richiama esplicitamente il mondo "documento ufficiale" è lo `StatusStamp`;
tutto il resto segue convenzioni pulite e familiari (superfici bianche,
gerarchia tipografica leggera, un solo accento colore) in modo che 200
persone possano orientarsi senza sforzo, non per somigliare a un modulo
cartaceo.

> Nota storica: la direzione originale (palette ink/paper `#F7F5F0` su
> `#141A2E`, titoli in Source Serif 4) è stata sostituita durante lo sviluppo
> del motore a blocchi — l'editor doveva "leggersi come una pagina Notion",
> e il serif per i titoli "sembrava vecchio" accanto a quell'editor. Questo
> file descrive lo stato attuale, non quello originale del brief.

## Token

- **Colore**: superfici bianche (`0 0% 100%`) con testo quasi-nero caldo
  (`hsl(40 6% 20%)`, non nero puro), bordi hairline appena percettibili
  (`hsl(40 8% 90%)`), un solo blu segnale `#2383E2` per azioni primarie e
  link. Ambra (`hsl(33 90% 45%)`) per stati "in approvazione", verde
  (`hsl(145 55% 38%)`) per pubblicato/confermato, rosso per rifiutato/critico.
  Dark mode ricalca il carbone di Notion (`#191919` / `#202020`), non
  l'inchiostro `#141A2E` originale. Tutti i token vivono come CSS variable in
  `src/app/globals.css` (`:root` / `.dark`), consumati da `tailwind.config.ts`.
- **Tipografia**: Inter per tutto — corpo testo *e* titoli (`--font-display`
  mappa su Inter, non su un serif). IBM Plex Mono resta riservato ai codici
  procedura (es. `LEG-PRO-001`) e al testo dentro `StatusStamp`: sono dati
  strutturati, meritano spaziatura fissa anche in un'interfaccia altrimenti
  sans-serif.
- **Layout**: sidebar con gerarchia dipartimentale reale (non decorativa),
  breadcrumb che rispecchia la struttura Department → Process → Procedure.
- **Componenti**: build su shadcn/ui sopra i primitivi Radix già in uso
  (dialog, dropdown-menu, select, tabs, tooltip, avatar) — vedi
  `src/components/ui/`. Nuovi componenti UI passano da lì, non da markup
  Radix scritto a mano da zero.

## Elemento firma

Lo `StatusStamp` (badge di stato workflow, `src/components/procedures/status-stamp.tsx`)
resta l'unico elemento "audace": bordo spesso, maiuscolo, letter-spacing
largo, font mono — pensato per leggersi come un timbro di approvazione anche
dentro un'interfaccia bianca/minimale. È l'unico posto dove il richiamo al
"documento cartaceo" sopravvive; ovunque altro la UI resta un tool digitale
pulito, non un'imitazione di modulo.

## Cosa NON abbiamo fatto

Niente sfondo crema+serif+terracotta (il default AI-generated più comune),
niente dark-mode-con-accento-acido, niente broadsheet a colonne dense.
Niente proliferazione di elementi "a timbro" — se tutto sembra un timbro,
niente lo sembra: `StatusStamp` resta l'unica eccezione al linguaggio visivo
altrimenti standard.
