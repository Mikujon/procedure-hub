import { collectText, type PMNode } from "../prosemirror-text";

/** Must match the literal text lib/blocks/serialize.ts's TABLE_OF_CONTENTS case emits — this module walks contentJson directly, so it never goes through lib/toc.ts's HTML-based substitution and has to recognize the same sentinel itself. */
const TOC_MARKER = "⟦PROCEDURE_HUB_TOC⟧";

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
  | { type: "table"; rows: string[][] };

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
        if (text.trim() === TOC_MARKER) {
          tocMarkerIndices.push(blocks.length);
          blocks.push({ type: "divider" }); // placeholder, replaced below — keeps this index meaningful without a one-off ExportBlock variant
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
    // Bullets, not real bookmarks — pdf.ts/docx.ts have no concept of an
    // in-document link target today, so a TOC block exports as a plain
    // indented list of the same headings rather than the raw sentinel
    // text leaking into the PDF/Word/Excel file.
    const headingEntries: ExportBlock[] = blocks
      .filter((b): b is Extract<ExportBlock, { type: "heading" }> => b.type === "heading")
      .map((h, i) => ({ type: "listItem", kind: "bullet", index: i, depth: h.level - 1, text: h.text, checked: false }));
    const replacement: ExportBlock[] =
      headingEntries.length > 0 ? headingEntries : [{ type: "paragraph", text: "Nessun titolo nel documento." }];
    // Reverse order so splicing one marker never shifts the recorded index of another still to come.
    for (const idx of [...tocMarkerIndices].reverse()) {
      blocks.splice(idx, 1, ...replacement);
    }
  }

  return blocks;
}
