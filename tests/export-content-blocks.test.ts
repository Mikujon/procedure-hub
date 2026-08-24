import { describe, it, expect } from "vitest";
import { extractExportBlocks } from "@/lib/export/content-blocks";
import type { PMNode } from "@/lib/prosemirror-text";

function paragraph(text: string): PMNode {
  return { type: "paragraph", content: [{ type: "text", text }] };
}
function heading(level: 1 | 2 | 3, text: string): PMNode {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text }] };
}
function doc(...content: PMNode[]): PMNode {
  return { type: "doc", content };
}

describe("extractExportBlocks — TABLE_OF_CONTENTS expansion", () => {
  it("expands the TOC sentinel into one tocEntry per heading, in document order, each carrying that heading's 0-based index", () => {
    const blocks = extractExportBlocks(
      doc(
        heading(1, "Scopo"),
        paragraph("⟦PROCEDURE_HUB_TOC⟧"),
        paragraph("Testo"),
        heading(2, "Ambito di applicazione")
      )
    );
    const tocEntries = blocks.filter((b) => b.type === "tocEntry");
    expect(tocEntries).toEqual([
      { type: "tocEntry", level: 1, text: "Scopo", headingIndex: 0 },
      { type: "tocEntry", level: 2, text: "Ambito di applicazione", headingIndex: 1 },
    ]);
  });

  it("headingIndex counts every heading in the document, not just headings that come after the TOC block", () => {
    // A TOC block placed *after* some headings still lists all of them —
    // headingIndex must still match each heading's real position so
    // pdf.ts/docx.ts's own heading-rendering counter lines up.
    const blocks = extractExportBlocks(doc(heading(1, "Prima"), heading(1, "Seconda"), paragraph("⟦PROCEDURE_HUB_TOC⟧")));
    const tocEntries = blocks.filter((b) => b.type === "tocEntry");
    expect(tocEntries).toEqual([
      { type: "tocEntry", level: 1, text: "Prima", headingIndex: 0 },
      { type: "tocEntry", level: 1, text: "Seconda", headingIndex: 1 },
    ]);
  });

  it("falls back to a plain notice when the document has no headings at all", () => {
    const blocks = extractExportBlocks(doc(paragraph("⟦PROCEDURE_HUB_TOC⟧"), paragraph("Solo testo.")));
    expect(blocks[0]).toEqual({ type: "paragraph", text: "Nessun titolo nel documento." });
  });

  it("expands every TOC block if a document somehow has more than one, each independently", () => {
    const blocks = extractExportBlocks(
      doc(heading(1, "Solo titolo"), paragraph("⟦PROCEDURE_HUB_TOC⟧"), paragraph("⟦PROCEDURE_HUB_TOC⟧"))
    );
    const tocEntries = blocks.filter((b) => b.type === "tocEntry");
    expect(tocEntries).toEqual([
      { type: "tocEntry", level: 1, text: "Solo titolo", headingIndex: 0 },
      { type: "tocEntry", level: 1, text: "Solo titolo", headingIndex: 0 },
    ]);
  });

  it("leaves a document with no TOC block completely unaffected by this expansion", () => {
    const blocks = extractExportBlocks(doc(heading(1, "Titolo"), paragraph("Testo normale.")));
    expect(blocks).toEqual([
      { type: "heading", level: 1, text: "Titolo" },
      { type: "paragraph", text: "Testo normale." },
    ]);
  });
});

describe("extractExportBlocks — DIAGRAM expansion", () => {
  it("decodes a DIAGRAM sentinel's base64 source into a labeled mermaid code block", () => {
    const source = "graph TD\n  A-->B";
    const b64 = Buffer.from(source, "utf-8").toString("base64");
    const blocks = extractExportBlocks(doc(paragraph(`⟦PROCEDURE_HUB_DIAGRAM:${b64}⟧`)));
    expect(blocks).toEqual([{ type: "code", text: source, language: "mermaid" }]);
  });

  it("never leaks the raw marker text for an unrecognized/malformed variant", () => {
    // Sanity check on the regex: plain paragraph text merely containing similar characters must not match.
    const blocks = extractExportBlocks(doc(paragraph("⟦PROCEDURE_HUB_DIAGRAM senza il resto⟧")));
    expect(blocks).toEqual([{ type: "paragraph", text: "⟦PROCEDURE_HUB_DIAGRAM senza il resto⟧" }]);
  });
});
