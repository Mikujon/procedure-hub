import type { BlockType } from "@prisma/client";

/** Client-side shape of a Block as returned by GET /api/procedures/[id]/blocks (JSON, dates as strings). */
export interface ClientBlock {
  id: string;
  type: BlockType;
  content: any;
  parentBlockId: string | null;
  sortOrder: number;
  children: ClientBlock[];
}

/** One heading a TABLE_OF_CONTENTS block lists, computed live in block-editor.tsx from sibling blocks. */
export interface DocumentHeading {
  blockId: string;
  level: 1 | 2 | 3;
  text: string;
}

/** Flattens a block's inline-rich-text content (Block.content.text, a ProseMirror inline node array) into plain text — used to build DocumentHeading[] without spinning up a full Tiptap instance just to read text back out. */
export function extractPlainText(nodes: any[] | undefined): string {
  if (!nodes) return "";
  return nodes.map((n) => (typeof n.text === "string" ? n.text : extractPlainText(n.content))).join("");
}
