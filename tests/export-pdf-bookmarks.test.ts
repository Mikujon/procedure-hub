import { describe, it, expect } from "vitest";
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFNumber, PDFHexString } from "pdf-lib";
import { generateProcedurePdf, type ProcedureExportInput } from "@/lib/export/pdf";
import type { ExportBlock } from "@/lib/export/content-blocks";

/**
 * Integration-style, not a mock: generates a real PDF via
 * generateProcedurePdf, then reloads the actual bytes with pdf-lib's own
 * parser to inspect the low-level /Outlines and Link-annotation structures
 * addPdfOutline/addPdfInternalLink (lib/export/pdf-bookmarks.ts) wrote —
 * the same "verify empirically" standard the rest of this repo holds
 * itself to, applied to a binary format instead of the DOM/DB.
 */

const BASE_INPUT: Omit<ProcedureExportInput, "blocks"> = {
  title: "Procedura di test",
  code: "TEST-001",
  departmentName: "Test",
  summary: null,
  versionNumber: 1,
  tags: [],
};

describe("generateProcedurePdf — real bookmarks", () => {
  it("adds a PDF outline (bookmarks panel) entry for every heading, even with no TOC block", async () => {
    const blocks: ExportBlock[] = [
      { type: "heading", level: 1, text: "Scopo" },
      { type: "paragraph", text: "Testo." },
      { type: "heading", level: 1, text: "Passaggi operativi" },
    ];
    const bytes = await generateProcedurePdf({ ...BASE_INPUT, blocks });
    const reloaded = await PDFDocument.load(bytes);

    expect(reloaded.catalog.lookup(PDFName.of("PageMode"), PDFName)).toEqual(PDFName.of("UseOutlines"));

    const outlinesRef = reloaded.catalog.lookup(PDFName.of("Outlines"));
    expect(outlinesRef).toBeDefined();
    const outlines = reloaded.context.lookup(outlinesRef as any, PDFDict);
    expect(outlines.lookup(PDFName.of("Count"), PDFNumber).asNumber()).toBe(2);

    const first = reloaded.context.lookup(outlines.lookup(PDFName.of("First")) as any, PDFDict);
    expect(first.lookup(PDFName.of("Title"), PDFHexString).decodeText()).toContain("Scopo");
    const dest = reloaded.context.lookup(first.lookup(PDFName.of("Dest")) as any, PDFArray);
    expect(dest.size()).toBe(5); // [page /XYZ left top zoom]

    const second = reloaded.context.lookup(first.lookup(PDFName.of("Next")) as any, PDFDict);
    expect(second.lookup(PDFName.of("Title"), PDFHexString).decodeText()).toContain("Passaggi operativi");
  });

  it("nests an H2 under the nearest preceding H1 in the outline tree", async () => {
    const blocks: ExportBlock[] = [
      { type: "heading", level: 1, text: "Sezione" },
      { type: "heading", level: 2, text: "Sottosezione" },
    ];
    const bytes = await generateProcedurePdf({ ...BASE_INPUT, blocks });
    const reloaded = await PDFDocument.load(bytes);

    const outlines = reloaded.context.lookup(reloaded.catalog.lookup(PDFName.of("Outlines")) as any, PDFDict);
    // Total Count includes nested descendants, but only one *root* entry (the H1) — the H2 is its child, not a sibling.
    expect(outlines.lookup(PDFName.of("Count"), PDFNumber).asNumber()).toBe(2);
    const root = reloaded.context.lookup(outlines.lookup(PDFName.of("First")) as any, PDFDict);
    expect(root.lookup(PDFName.of("Next"))).toBeUndefined(); // only one root
    const child = reloaded.context.lookup(root.lookup(PDFName.of("First")) as any, PDFDict);
    expect(child.lookup(PDFName.of("Title"), PDFHexString).decodeText()).toContain("Sottosezione");
    expect(reloaded.context.lookup(child.lookup(PDFName.of("Parent")) as any, PDFDict)).toBe(root);
  });

  it("adds no outline at all for a document with no headings", async () => {
    const blocks: ExportBlock[] = [{ type: "paragraph", text: "Solo testo, nessun titolo." }];
    const bytes = await generateProcedurePdf({ ...BASE_INPUT, blocks });
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.catalog.lookup(PDFName.of("Outlines"))).toBeUndefined();
  });

  it("attaches a real internal Link annotation from a TOC entry to its named heading's destination", async () => {
    const blocks: ExportBlock[] = [
      { type: "tocEntry", level: 1, text: "Passaggi operativi", headingIndex: 0 },
      { type: "heading", level: 1, text: "Scopo" },
      { type: "heading", level: 1, text: "Passaggi operativi" },
    ];
    const bytes = await generateProcedurePdf({ ...BASE_INPUT, blocks });
    const reloaded = await PDFDocument.load(bytes);

    const page = reloaded.getPage(0);
    const annots = page.node.Annots();
    expect(annots).toBeDefined();
    expect(annots!.size()).toBeGreaterThan(0);

    const linkAnnot = reloaded.context.lookup(annots!.get(0) as any, PDFDict);
    expect(linkAnnot.lookup(PDFName.of("Subtype"), PDFName).toString()).toBe("/Link");
    const dest = reloaded.context.lookup(linkAnnot.lookup(PDFName.of("Dest")) as any, PDFArray);
    expect(dest.size()).toBe(5);
    // The link's destination page must be the *second* heading ("Passaggi operativi", headingIndex 0 in this fixture — the tocEntry deliberately points past the first heading), not just "some page".
    expect(dest.get(0)).toBe(reloaded.getPage(0).ref);
  });
});
