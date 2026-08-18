/** Shared ProseMirror-doc helpers used by both lib/diff.ts and lib/export/. */

export interface PMNode {
  type: string;
  attrs?: Record<string, any>;
  content?: PMNode[];
  text?: string;
  marks?: any[];
}

/** Concatenates the plain text of a node and its descendants (marks/formatting dropped). */
export function collectText(node: PMNode | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  if (!node.content) return "";
  return node.content.map(collectText).join("");
}
