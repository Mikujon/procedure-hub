/**
 * Turns a procedure's rendered contentHtml into a navigable document: every
 * <h1>/<h2>/<h3> gets a stable anchor id, and any TABLE_OF_CONTENTS block
 * (serialized by lib/blocks/serialize.ts as a sentinel paragraph — see
 * TOC_BLOCK_MARKER there) is replaced with a real list of links to those
 * same anchors. One pass, one id per heading, so the floating reading
 * outline (components/procedures/reading-outline.tsx) and an inline TOC
 * block always agree on where "#introduzione" actually is.
 *
 * contentHtml here is always our own Tiptap generateHTML() output (Fase 1
 * block engine or the legacy editor, both StarterKit-based, see
 * lib/blocks/serialize.ts) — never arbitrary third-party HTML — so a
 * regex pass over <h1-3> tags is safe; a full HTML parser would be
 * overkill for a shape this predictable.
 */

export interface TocHeading {
  id: string;
  level: 1 | 2 | 3;
  text: string;
}

const HEADING_RE = /<h([1-3])([^>]*)>([\s\S]*?)<\/h\1>/gi;

/** Emitted by lib/blocks/serialize.ts for a TABLE_OF_CONTENTS block — see TOC_BLOCK_MARKER there. Kept in sync with that constant rather than imported from it: serialize.ts runs through Tiptap's generateHTML, this runs on the resulting string, and neither needs the other's other exports. */
const TOC_BLOCK_RE = /<p>\s*⟦PROCEDURE_HUB_TOC⟧\s*<\/p>/g;

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function slugify(text: string): string {
  const base = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritics (à -> a) so anchors stay URL-friendly
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "sezione";
}

function renderTocList(headings: TocHeading[]): string {
  if (headings.length === 0) {
    return '<p class="toc-block-empty">Nessun titolo nel documento.</p>';
  }
  const items = headings
    .map((h) => `<a href="#${h.id}" data-toc-level="${h.level}">${escapeHtml(h.text)}</a>`)
    .join("");
  return `<nav class="toc-block" aria-label="Indice della procedura">${items}</nav>`;
}

/**
 * Single entry point: inject heading anchors, collect them, then splice in
 * any inline TOC block using those same anchors. Called once per render of
 * the procedure page. PDF/DOCX/XLSX export (lib/export/) builds straight
 * from Block rows, not this rendered HTML — a TABLE_OF_CONTENTS block
 * exported that way still falls through to lib/blocks/serialize.ts's
 * generic placeholder rendering today, not a real link list.
 */
export function renderContentWithToc(html: string): { html: string; headings: TocHeading[] } {
  const headings: TocHeading[] = [];
  const seenSlugs = new Map<string, number>();

  const withAnchors = html.replace(HEADING_RE, (match, levelStr, attrs, inner) => {
    const level = Number(levelStr) as 1 | 2 | 3;
    const text = decodeEntities(stripTags(inner)).trim();
    if (!text) return match; // an empty heading has nothing worth anchoring or listing

    const slug = `heading-${slugify(text)}`;
    const occurrence = seenSlugs.get(slug) ?? 0;
    seenSlugs.set(slug, occurrence + 1);
    const id = occurrence === 0 ? slug : `${slug}-${occurrence + 1}`;

    headings.push({ id, level, text });

    const cleanAttrs = attrs.replace(/\sid="[^"]*"/i, ""); // our own generateHTML never sets one, but defensive against future extensions that might
    return `<h${level}${cleanAttrs} id="${id}">${inner}</h${level}>`;
  });

  const finalHtml = withAnchors.replace(TOC_BLOCK_RE, () => renderTocList(headings));

  return { html: finalHtml, headings };
}
