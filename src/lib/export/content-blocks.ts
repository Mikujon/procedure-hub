import { collectText, type PMNode } from "../prosemirror-text";

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

/** Flattens a ProseMirror doc's top-level nodes into export-ready blocks, in document order. */
export function extractExportBlocks(doc: PMNode | null | undefined): ExportBlock[] {
  const nodes = doc?.content ?? [];
  const blocks: ExportBlock[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "paragraph": {
        const text = collectText(node);
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
  return blocks;
}
