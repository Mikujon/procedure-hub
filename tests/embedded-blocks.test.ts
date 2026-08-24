import { describe, it, expect } from "vitest";
import { injectEmbedIframes, injectDiagramPlaceholders } from "@/lib/embedded-blocks";

describe("injectEmbedIframes", () => {
  it("replaces an EMBED sentinel with a real iframe plus an 'open in a new tab' link", () => {
    const html = "<h1>Titolo</h1><p>⟦PROCEDURE_HUB_EMBED:https://example.com/doc⟧</p><p>Dopo</p>";
    const out = injectEmbedIframes(html);
    expect(out).toContain('<iframe src="https://example.com/doc"');
    expect(out).toContain('<a href="https://example.com/doc" target="_blank"');
    expect(out).toContain("<h1>Titolo</h1>");
    expect(out).toContain("<p>Dopo</p>");
    expect(out).not.toContain("PROCEDURE_HUB_EMBED");
  });

  it("HTML-escapes the URL when splicing it into the src/href attributes", () => {
    // Tiptap's own serializer would have HTML-escaped a literal "&" in the URL when it wrote the sentinel text.
    const html = "<p>⟦PROCEDURE_HUB_EMBED:https://example.com/doc?a=1&amp;b=2⟧</p>";
    const out = injectEmbedIframes(html);
    expect(out).toContain('src="https://example.com/doc?a=1&amp;b=2"');
  });

  it("drops an empty EMBED block entirely rather than rendering an iframe with no src", () => {
    const html = "<p>⟦PROCEDURE_HUB_EMBED:⟧</p>";
    expect(injectEmbedIframes(html)).toBe("");
  });

  it("leaves content with no EMBED block unchanged", () => {
    const html = "<p>Solo un paragrafo.</p>";
    expect(injectEmbedIframes(html)).toBe(html);
  });
});

describe("injectDiagramPlaceholders", () => {
  it("replaces a DIAGRAM sentinel with a placeholder <pre> carrying the base64 source", () => {
    const b64 = Buffer.from("graph TD; A-->B;", "utf-8").toString("base64");
    const html = `<h2>Flusso</h2><p>⟦PROCEDURE_HUB_DIAGRAM:${b64}⟧</p>`;
    const out = injectDiagramPlaceholders(html);
    expect(out).toContain(`<pre class="mermaid-source" data-mermaid-b64="${b64}">`);
    expect(out).toContain("<h2>Flusso</h2>");
    expect(out).not.toContain("PROCEDURE_HUB_DIAGRAM");
  });

  it("leaves content with no DIAGRAM block unchanged", () => {
    const html = "<p>Solo un paragrafo.</p>";
    expect(injectDiagramPlaceholders(html)).toBe(html);
  });

  it("round-trips non-ASCII diagram labels through the same base64 encoding mermaid-renderer.tsx decodes", () => {
    const source = "graph TD\n  A[Richiesta ricevuta] --> B{Approvata?}";
    const b64 = Buffer.from(source, "utf-8").toString("base64");
    const html = `<p>⟦PROCEDURE_HUB_DIAGRAM:${b64}⟧</p>`;
    const out = injectDiagramPlaceholders(html);
    const decoded = Buffer.from(b64, "base64").toString("utf-8");
    expect(decoded).toBe(source);
    expect(out).toContain(b64);
  });
});
