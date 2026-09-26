import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Youtube from "@tiptap/extension-youtube";
import type { BlockWithChildren } from "./tree";

/**
 * Same extension set as src/components/editor/procedure-editor.tsx (minus
 * Placeholder/SlashCommand, which are editor-only UI and don't affect the
 * document schema) — must match so generateHTML() builds the same schema
 * that ProcedureVersion.contentJson/contentHtml consumers already expect.
 */
const EDITOR_EXTENSIONS = [
  StarterKit,
  Image,
  Link,
  Table,
  TableRow,
  TableHeader,
  TableCell,
  TaskList,
  TaskItem.configure({ nested: true }),
  Youtube,
];

interface PMNode {
  type: string;
  attrs?: Record<string, any>;
  content?: PMNode[];
  text?: string;
  marks?: any[];
}

const LIST_ITEM_WRAPPER: Partial<Record<string, string>> = {
  BULLETED_LIST_ITEM: "bulletList",
  NUMBERED_LIST_ITEM: "orderedList",
  CHECKLIST_ITEM: "taskList",
};

function nonEmpty(nodes: PMNode[] | undefined): PMNode[] | undefined {
  return nodes && nodes.length > 0 ? nodes : undefined;
}

function listItemNode(block: BlockWithChildren): PMNode {
  const content = block.content as any;
  const text = Array.isArray(content?.text) ? (content.text as PMNode[]) : [];
  const paragraph: PMNode = { type: "paragraph", content: nonEmpty(text) };
  const nestedLists = siblingsToPMNodes(block.children).filter((n) =>
    ["bulletList", "orderedList", "taskList"].includes(n.type)
  );
  const isTask = block.type === "CHECKLIST_ITEM";
  return {
    type: isTask ? "taskItem" : "listItem",
    attrs: isTask ? { checked: Boolean(content?.checked) } : undefined,
    content: [paragraph, ...nestedLists],
  };
}

/** Blocks with no ProseMirror equivalent in today's schema — flatten instead of dropping. */
function blockToPMNodes(block: BlockWithChildren): PMNode[] {
  const content = block.content as any;
  const text = Array.isArray(content?.text) ? (content.text as PMNode[]) : undefined;

  switch (block.type) {
    case "PARAGRAPH":
      return [{ type: "paragraph", content: nonEmpty(text) }];
    case "HEADING_1":
      return [{ type: "heading", attrs: { level: 1 }, content: nonEmpty(text) }];
    case "HEADING_2":
      return [{ type: "heading", attrs: { level: 2 }, content: nonEmpty(text) }];
    case "HEADING_3":
      return [{ type: "heading", attrs: { level: 3 }, content: nonEmpty(text) }];
    case "QUOTE":
      return [{ type: "blockquote", content: [{ type: "paragraph", content: nonEmpty(text) }] }];
    case "CALLOUT":
      // No "callout" node in the current editor schema — documented
      // limitation, matches the same "known limitation" pattern used for
      // the formula engine in New plan/02-database-relazioni.md. Falls back
      // to a blockquote so publish never loses the block's text outright.
      return [{ type: "blockquote", content: [{ type: "paragraph", content: nonEmpty(text) }] }];
    case "CODE":
      return [
        {
          type: "codeBlock",
          attrs: { language: content?.language ?? null },
          content: content?.code ? [{ type: "text", text: String(content.code) }] : undefined,
        },
      ];
    case "DIVIDER":
      return [{ type: "horizontalRule" }];
    case "IMAGE":
      return [{ type: "image", attrs: { src: content?.url ?? "", alt: content?.caption ?? "" } }];
    case "VIDEO":
      return [{ type: "youtube", attrs: { src: content?.url ?? "" } }];
    case "TABLE_SIMPLE": {
      const rows: string[][] = Array.isArray(content?.rows) ? content.rows : [];
      return [
        {
          type: "table",
          content: rows.map((row, rowIndex) => ({
            type: "tableRow",
            content: row.map((cellText) => ({
              type: rowIndex === 0 ? "tableHeader" : "tableCell",
              content: [
                {
                  type: "paragraph",
                  content: cellText ? [{ type: "text", text: cellText }] : undefined,
                },
              ],
            })),
          })),
        },
      ];
    }
    case "TOGGLE_LIST_ITEM":
    case "COLUMN_LIST":
    case "COLUMN": {
      // No toggle/column-layout node in the current schema — flatten: keep
      // the block's own text as a paragraph, then splice its children in at
      // the same level. Layout/collapsibility is lost on publish until a
      // later phase extends the ProseMirror schema for these.
      const own: PMNode[] = nonEmpty(text) ? [{ type: "paragraph", content: text }] : [];
      return [...own, ...siblingsToPMNodes(block.children)];
    }
    case "TABLE_OF_CONTENTS":
      // No dedicated ProseMirror node either, but unlike the placeholder
      // types below this one has a real reader-facing meaning worth
      // preserving: emit a sentinel paragraph that lib/toc.ts finds and
      // replaces with an actual list of links to that same document's
      // headings, once it has assigned them anchor ids (same pass, so the
      // TOC block and the floating reading outline always point at the
      // same anchors). TOC_BLOCK_RE there must stay in sync with this text.
      return [{ type: "paragraph", content: [{ type: "text", text: "⟦PROCEDURE_HUB_TOC⟧" }] }];
    case "EMBED": {
      // Same sentinel-paragraph approach as TABLE_OF_CONTENTS — no
      // "iframe" node in this schema, so lib/embedded-blocks.ts's
      // injectEmbedIframes finds this marker in the rendered HTML and
      // splices a real <iframe> in its place. EMBED_MARKER_RE there must
      // stay in sync with this text.
      const url = String((block.content as any)?.url ?? "").trim();
      if (!url) return [{ type: "paragraph", content: undefined }];
      return [{ type: "paragraph", content: [{ type: "text", text: `⟦PROCEDURE_HUB_EMBED:${url}⟧` }] }];
    }
    case "DIAGRAM": {
      // Same idea, but a Mermaid diagram needs a real browser to lay out —
      // unlike EMBED there's no way to do this server-side at publish time,
      // so the marker carries the *source*, base64-encoded (safe against
      // this same text node's own HTML-escaping, and against the source
      // containing HTML-special characters), for
      // components/procedures/mermaid-renderer.tsx to render client-side
      // after lib/embedded-blocks.ts's injectDiagramPlaceholders turns it
      // into a placeholder element. DIAGRAM_MARKER_RE there must stay in
      // sync with this text shape.
      const code = String((block.content as any)?.code ?? "");
      const base64Source = Buffer.from(code, "utf-8").toString("base64");
      return [{ type: "paragraph", content: [{ type: "text", text: `⟦PROCEDURE_HUB_DIAGRAM:${base64Source}⟧` }] }];
    }
    default: {
      // AUDIO, FILE, PAGE_LINK, SYNCED_BLOCK_SOURCE, SYNCED_BLOCK_REFERENCE:
      // no ProseMirror equivalent yet. Emit a placeholder paragraph so
      // publish never crashes on a block type the old schema can't represent.
      return [{ type: "paragraph", content: [{ type: "text", text: `[${block.type.toLowerCase()}]` }] }];
    }
  }
}

function siblingsToPMNodes(blocks: BlockWithChildren[]): PMNode[] {
  const nodes: PMNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];
    const wrapper = LIST_ITEM_WRAPPER[block.type];
    if (wrapper) {
      const runType = block.type;
      const items: PMNode[] = [];
      while (i < blocks.length && blocks[i].type === runType) {
        items.push(listItemNode(blocks[i]));
        i++;
      }
      nodes.push({ type: wrapper, content: items });
    } else {
      nodes.push(...blockToPMNodes(block));
      i++;
    }
  }
  return nodes;
}

/**
 * Serializes a Block tree (as returned by buildBlockTree) into the
 * ProseMirror JSON + rendered HTML shape ProcedureVersion.contentJson/
 * contentHtml already require, so publishing a Block tree stays a drop-in
 * replacement for the old single-document save path.
 */
export function blocksToProseMirrorDoc(blocks: BlockWithChildren[]): { json: any; html: string } {
  const content = siblingsToPMNodes(blocks);
  const json = { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] };
  const html = generateHTML(json, EDITOR_EXTENSIONS);
  return { json, html };
}
