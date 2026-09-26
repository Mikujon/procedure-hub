/**
 * EMBED and DIAGRAM blocks have no ProseMirror-native node, so
 * lib/blocks/serialize.ts emits a plain sentinel paragraph for each (same
 * approach as TABLE_OF_CONTENTS, see lib/toc.ts) — these two functions
 * expand that sentinel, once generateHTML() has already produced
 * contentHtml, into what a reader actually sees:
 *
 *  - EMBED becomes a real <iframe> — plain static HTML, the same trust
 *    level VIDEO's Tiptap Youtube node already gets in this same pipeline.
 *  - DIAGRAM becomes a placeholder <pre> that
 *    components/procedures/mermaid-renderer.tsx renders into a real SVG
 *    client-side — Mermaid needs a real browser to lay out a diagram, so
 *    unlike EMBED there's no server-side equivalent to do this at render
 *    time.
 *
 * Both run on our own generateHTML() output (Fase 1 block engine or the
 * legacy editor, both StarterKit-based) — never third-party HTML.
 */

const EMBED_MARKER_RE = /<p>⟦PROCEDURE_HUB_EMBED:([\s\S]*?)⟧<\/p>/g;
const DIAGRAM_MARKER_RE = /<p>⟦PROCEDURE_HUB_DIAGRAM:([A-Za-z0-9+/=]*)⟧<\/p>/g;

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** Splices a real <iframe> (plus an "open in a new tab" fallback link, for hosts that refuse to render inside one) in place of an EMBED block's sentinel paragraph. */
export function injectEmbedIframes(html: string): string {
  return html.replace(EMBED_MARKER_RE, (_match, escapedUrl) => {
    const url = decodeEntities(escapedUrl).trim();
    if (!url) return "";
    const safeUrl = escapeAttr(url);
    return (
      `<div class="embed-block"><iframe src="${safeUrl}" loading="lazy" title="Contenuto incorporato"></iframe>` +
      `<a href="${safeUrl}" target="_blank" rel="noreferrer">Apri in una nuova scheda ↗</a></div>`
    );
  });
}

/** Splices a placeholder <pre class="mermaid-source"> in place of a DIAGRAM block's sentinel paragraph — components/procedures/mermaid-renderer.tsx finds these client-side and replaces each with a rendered SVG. */
export function injectDiagramPlaceholders(html: string): string {
  return html.replace(DIAGRAM_MARKER_RE, (_match, base64Source) => {
    return `<pre class="mermaid-source" data-mermaid-b64="${base64Source}">Caricamento diagramma…</pre>`;
  });
}
