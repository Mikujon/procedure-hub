import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { generateProcedureDocx, type ProcedureExportInput } from "@/lib/export/docx";
import type { ExportBlock } from "@/lib/export/content-blocks";

/**
 * Integration-style: generates a real .docx (a zip archive) via
 * generateProcedureDocx, then unzips it (jszip — also what `docx`'s own
 * Packer uses internally) and inspects word/document.xml directly for the
 * actual <w:bookmarkStart>/<w:hyperlink> XML a real Word install would
 * read — same "verify empirically" standard as the PDF bookmarks test,
 * applied to OOXML instead of a PDF's object graph.
 */

const BASE_INPUT: Omit<ProcedureExportInput, "blocks"> = {
  title: "Procedura di test",
  code: "TEST-001",
  departmentName: "Test",
  summary: null,
  versionNumber: 1,
  tags: [],
};

async function documentXml(blocks: ExportBlock[]): Promise<string> {
  const buffer = await generateProcedureDocx({ ...BASE_INPUT, blocks });
  const zip = await JSZip.loadAsync(buffer);
  const entry = zip.file("word/document.xml");
  if (!entry) throw new Error("word/document.xml missing from generated .docx");
  return entry.async("text");
}

describe("generateProcedureDocx — real bookmarks", () => {
  it("wraps every heading in a named Bookmark, numbered 0-based in document order", async () => {
    const blocks: ExportBlock[] = [
      { type: "heading", level: 1, text: "Scopo" },
      { type: "paragraph", text: "Testo." },
      { type: "heading", level: 2, text: "Passaggi operativi" },
    ];
    const xml = await documentXml(blocks);
    // w:name is the identifier that matters here (what InternalHyperlink's
    // anchor targets) — w:id is the docx library's own internal bookmark
    // reference number (Word requires a matching bookmarkEnd per bookmark,
    // via that id, not the name), not something this code assigns itself.
    expect(xml).toContain('<w:bookmarkStart w:name="heading_0" w:id="');
    expect(xml).toContain('<w:bookmarkStart w:name="heading_1" w:id="');
    expect(xml).toContain("<w:bookmarkEnd");
  });

  it("only assigns bookmark numbers to headings, not to the paragraphs in between", async () => {
    const blocks: ExportBlock[] = [
      { type: "heading", level: 1, text: "Prima" },
      { type: "paragraph", text: "In mezzo." },
      { type: "paragraph", text: "Ancora in mezzo." },
      { type: "heading", level: 1, text: "Seconda" },
    ];
    const xml = await documentXml(blocks);
    expect(xml).toContain('w:name="heading_0"');
    expect(xml).toContain('w:name="heading_1"');
    expect(xml).not.toContain('w:name="heading_2"');
  });

  it("renders a tocEntry as a real internal hyperlink anchored to its heading's bookmark name", async () => {
    const blocks: ExportBlock[] = [
      { type: "tocEntry", level: 1, text: "Passaggi operativi", headingIndex: 1 },
      { type: "heading", level: 1, text: "Scopo" },
      { type: "heading", level: 1, text: "Passaggi operativi" },
    ];
    const xml = await documentXml(blocks);
    expect(xml).toContain('w:anchor="heading_1"');
    expect(xml).toContain("<w:hyperlink");
    expect(xml).toContain("Passaggi operativi");
  });
});
