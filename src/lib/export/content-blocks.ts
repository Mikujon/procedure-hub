import { collectText, type PMNode } from "../prosemirror-text";

/** Must match the literal text lib/blocks/serialize.ts's TABLE_OF_CONTENTS case emits — this module walks contentJson directly, so it never goes through lib/toc.ts's HTML-based substitution and has to recognize the same sentinel itself. */
const TOC_MARKER = "⟦PROCEDURE_HUB_TOC⟧";
/** Same idea for a DIAGRAM block's sentinel (lib/blocks/serialize.ts) — this module bypasses lib/embedded-blocks.ts entirely (that one works on contentHtml strings, not contentJson), so a Mermaid diagram would otherwise export as this raw marker text. */
const DIAGRAM_MARKER_RE = /^⟦PROCEDURE_HUB_DIAGRAM:([A-Za-z0-9+/=]*)⟧$/;

/**
 * Structured (non-flattened) walk of a ProcedureVersion.contentJson doc, for
 * the PDF/Word/Excel exporters. Deliberately a separate shape from
 * lib/diff.ts's DiffUnit: a diff only needs "one string per block", export
 * needs to keep tables as rows and list items as (kind, depth, checked) so
 * each format can render them with its own native primitives (docx tables,
 * pdf-lib indentation, etc.) instead of re-parsing flattened text.
 */
export type ExportBlock =
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "quote"; text: string }
  | { type: "code"; text: string; language: string | null }
  | { type: "divider" }
  | { type: "image"; caption: string }
  | { type: "video"; url: string }
  | { type: "listItem"; kind: "bullet" | "ordered" | "task"; index: number; depth: number; text: string; checked: boolean }
  | { type: "table"; rows: string[][] }
  /** A TABLE_OF_CONTENTS block's entry, once its sentinel is expanded (see the splice pass below) — `headingIndex` is this heading's 0-based position among every `{ type: "heading" }` block in the document, in order. pdf.ts/docx.ts use it to link the entry to a real bookmark/destination at that heading; xlsx.ts (no pagination, no bookmarks) just renders it as indented text. */
  | { type: "tocEntry"; level: 1 | 2 | 3; text: string; headingIndex: number };

function listItemBlocks(item: PMNode, kind: "bullet" | "ordered" | "task", index: number, depth: number): ExportBlock[] {
  const paragraph = (item.content ?? []).find((n) => n.type === "paragraph");
  const blocks: ExportBlock[] = [
    { type: "listItem", kind, index, depth, text: collectText(paragraph), checked: Boolean(item.attrs?.checked) },
  ];
  const nestedLists = (item.content ?? []).filter((n) => ["bulletList", "orderedList", "taskList"].includes(n.type));
  for (const list of nestedLists) blocks.push(...listBlocks(list, depth + 1));
  return blocks;
}

function listBlocks(list: PMNode, depth = 0): ExportBlock[] {
  const kind = list.type === "bulletList" ? "bullet" : list.type === "orderedList" ? "ordered" : "task";
  return (list.content ?? []).flatMap((item, i) => listItemBlocks(item, kind, i, depth));
}

/** Flattens a ProseMirror doc's top-level nodes into export-ready blocks, in document order. A TABLE_OF_CONTENTS block's sentinel paragraph (TOC_MARKER) is expanded afterwards, once every heading in the document is known — see the splice pass below. */
export function extractExportBlocks(doc: PMNode | null | undefined): ExportBlock[] {
  const nodes = doc?.content ?? [];
  const blocks: ExportBlock[] = [];
  const tocMarkerIndices: number[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "paragraph": {
        const text = collectText(node);
        const trimmed = text.trim();
        if (trimmed === TOC_MARKER) {
          tocMarkerIndices.push(blocks.length);
          blocks.push({ type: "divider" }); // placeholder, replaced below — keeps this index meaningful without a one-off ExportBlock variant
          break;
        }
        const diagramMatch = trimmed.match(DIAGRAM_MARKER_RE);
        if (diagramMatch) {
          // No image rendering pipeline for Mermaid here (that needs a real
          // browser, see lib/embedded-blocks.ts) — export the raw source as
          // a labeled code block rather than leak the encoded marker.
          const source = Buffer.from(diagramMatch[1], "base64").toString("utf-8");
          blocks.push({ type: "code", text: source || "(diagramma vuoto)", language: "mermaid" });
          break;
        }
        if (text.trim()) blocks.push({ type: "paragraph", text });
        break;
      }
      case "heading":
        blocks.push({ type: "heading", level: (node.attrs?.level ?? 1) as 1 | 2 | 3, text: collectText(node) });
        break;
      case "blockquote":
        blocks.push({ type: "quote", text: collectText(node) });
        break;
      case "codeBlock":
        blocks.push({ type: "code", text: collectText(node), language: node.attrs?.language ?? null });
        break;
      case "horizontalRule":
        blocks.push({ type: "divider" });
        break;
      case "image":
        blocks.push({ type: "image", caption: node.attrs?.alt || node.attrs?.src || "" });
        break;
      case "youtube":
        blocks.push({ type: "video", url: node.attrs?.src ?? "" });
        break;
      case "table": {
        const rows = (node.content ?? []).map((row) => (row.content ?? []).map((cell) => collectText(cell)));
        blocks.push({ type: "table", rows });
        break;
      }
      case "bulletList":
      case "orderedList":
      case "taskList":
        blocks.push(...listBlocks(node));
        break;
      default:
        break;
    }
  }

  if (tocMarkerIndices.length > 0) {
    // headingIndex here is this heading's 0-based position among every
    // heading block pushed above, in document order — pdf.ts assigns each
    // heading a bookmark/destination in that exact same order as it
    // renders, and docx.ts wraps each heading in a Bookmark named
    // `heading_<index>`, so the two numbering schemes always agree without
    // this module needing to know anything about PDF/Word internals itself.
    const headingEntries: ExportBlock[] = blocks
      .filter((b): b is Extract<ExportBlock, { type: "heading" }> => b.type === "heading")
      .map((h, i): ExportBlock => ({ type: "tocEntry", level: h.level, text: h.text, headingIndex: i }));
    const replacement: ExportBlock[] =
      headingEntries.length > 0 ? headingEntries : [{ type: "paragraph", text: "Nessun titolo nel documento." }];
    // Reverse order so splicing one marker never shifts the recorded index of another still to come.
    for (const idx of [...tocMarkerIndices].reverse()) {
      blocks.splice(idx, 1, ...replacement);
    }
  }

  return blocks;
}
