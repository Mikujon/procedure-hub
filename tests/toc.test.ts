import { describe, it, expect } from "vitest";
import { renderContentWithToc } from "@/lib/toc";

describe("renderContentWithToc", () => {
  it("assigns an anchor id to each heading, in document order, with the right level", () => {
    const { html, headings } = renderContentWithToc(
      "<h1>Scopo</h1><p>Testo</p><h2>Passaggi operativi</h2><h3>Dettaglio</h3>"
    );
    expect(headings).toEqual([
      { id: "heading-scopo", level: 1, text: "Scopo" },
      { id: "heading-passaggi-operativi", level: 2, text: "Passaggi operativi" },
      { id: "heading-dettaglio", level: 3, text: "Dettaglio" },
    ]);
    expect(html).toContain('<h1 id="heading-scopo">Scopo</h1>');
    expect(html).toContain('<h2 id="heading-passaggi-operativi">Passaggi operativi</h2>');
  });

  it("disambiguates repeated heading text with -2, -3, ...", () => {
    const { headings } = renderContentWithToc("<h2>Note</h2><h2>Note</h2><h2>Note</h2>");
    expect(headings.map((h) => h.id)).toEqual(["heading-note", "heading-note-2", "heading-note-3"]);
  });

  it("skips a heading with no real text (nothing worth anchoring or listing)", () => {
    const { html, headings } = renderContentWithToc("<h2></h2><h2>Reale</h2>");
    expect(headings).toEqual([{ id: "heading-reale", level: 2, text: "Reale" }]);
    expect(html).toContain("<h2></h2>"); // left untouched, not given a stray id
  });

  it("strips inline marks and decodes entities for the heading's plain-text label, but keeps the original markup in the rendered HTML", () => {
    const { html, headings } = renderContentWithToc("<h1><strong>GDPR</strong> &amp; privacy</h1>");
    expect(headings[0].text).toBe("GDPR & privacy");
    expect(html).toContain("<strong>GDPR</strong> &amp; privacy");
  });

  it("replaces a TABLE_OF_CONTENTS block's sentinel paragraph with real links to the document's own headings", () => {
    const { html } = renderContentWithToc(
      "<h1>Scopo</h1><p>⟦PROCEDURE_HUB_TOC⟧</p><h2>Ambito di applicazione</h2>"
    );
    expect(html).toContain('<nav class="toc-block"');
    expect(html).toContain('<a href="#heading-scopo" data-toc-level="1">Scopo</a>');
    expect(html).toContain('<a href="#heading-ambito-di-applicazione" data-toc-level="2">Ambito di applicazione</a>');
    expect(html).not.toContain("PROCEDURE_HUB_TOC");
  });

  it("renders a graceful empty state for a TOC block in a heading-less document, instead of an empty nav", () => {
    const { html } = renderContentWithToc("<p>⟦PROCEDURE_HUB_TOC⟧</p><p>Solo testo semplice.</p>");
    expect(html).toContain("Nessun titolo nel documento");
    expect(html).not.toContain("<nav");
  });

  it("leaves content with no headings and no TOC block completely unchanged", () => {
    const { html, headings } = renderContentWithToc("<p>Solo un paragrafo.</p>");
    expect(html).toBe("<p>Solo un paragrafo.</p>");
    expect(headings).toEqual([]);
  });
});
