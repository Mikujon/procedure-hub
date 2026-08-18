import type { BlockType } from "@prisma/client";

/**
 * Block types + content shapes the AI is allowed to propose, and how to
 * parse its response back into that shape. Shared by every Suggest Mode
 * route (draft-from-conversation, complete-section, executive-summary) so
 * the prompt contract and parsing live in one place instead of drifting
 * per-route. Deliberately a subset of BlockType — media/table-of-contents/
 * embed types need an upload or a reference the model can't produce, so
 * they're not offered.
 */
export const AI_BLOCK_TYPES = [
  "PARAGRAPH",
  "HEADING_1",
  "HEADING_2",
  "HEADING_3",
  "BULLETED_LIST_ITEM",
  "NUMBERED_LIST_ITEM",
  "CHECKLIST_ITEM",
  "QUOTE",
  "CALLOUT",
  "TABLE_SIMPLE",
] as const;

export type AiBlockType = (typeof AI_BLOCK_TYPES)[number];

export interface AiBlockNode {
  type: AiBlockType;
  content: any;
  children?: AiBlockNode[];
}

export const BLOCK_JSON_CONTRACT = `Rispondi ESCLUSIVAMENTE con un array JSON valido (nessun testo prima o dopo, nessun blocco markdown \`\`\`), dove ogni elemento è:
{ "type": "<uno tra ${AI_BLOCK_TYPES.join(" | ")}>", "content": <vedi sotto>, "children"?: [...stessa struttura, per liste annidate] }

Forma di "content" per tipo:
- PARAGRAPH, HEADING_1, HEADING_2, HEADING_3, BULLETED_LIST_ITEM, NUMBERED_LIST_ITEM, QUOTE, CALLOUT: { "text": [{ "type": "text", "text": "..." }] } — usa { "text": [] } per un blocco vuoto, MAI un nodo di testo con stringa vuota.
- CHECKLIST_ITEM: { "text": [...come sopra], "checked": false }
- TABLE_SIMPLE: { "rows": [["intestazione1","intestazione2"], ["val1","val2"]] } — prima riga = intestazioni.

Non includere id, pageId, sortOrder: solo type/content/children.`;

function textNodesOf(text: string) {
  return text ? [{ type: "text", text }] : [];
}

/** A safe empty-content default per type, used when the model omits or malforms `content`. */
function defaultContentFor(type: AiBlockType): any {
  if (type === "CHECKLIST_ITEM") return { text: [], checked: false };
  if (type === "TABLE_SIMPLE") return { rows: [["", ""]] };
  return { text: [] };
}

/** Recursively coerces one parsed node into a valid AiBlockNode, dropping anything unrecognized. */
function sanitizeNode(raw: any): AiBlockNode | null {
  if (!raw || typeof raw !== "object") return null;
  const type: AiBlockType = AI_BLOCK_TYPES.includes(raw.type) ? raw.type : "PARAGRAPH";

  let content: any;
  if (type === "TABLE_SIMPLE") {
    content = Array.isArray(raw.content?.rows) ? { rows: raw.content.rows } : defaultContentFor(type);
  } else if (type === "CHECKLIST_ITEM") {
    const text = Array.isArray(raw.content?.text) ? raw.content.text : textNodesOf(String(raw.content?.text ?? ""));
    content = { text, checked: Boolean(raw.content?.checked) };
  } else {
    const text = Array.isArray(raw.content?.text)
      ? raw.content.text
      : textNodesOf(typeof raw.content?.text === "string" ? raw.content.text : "");
    content = { text };
  }

  const children = Array.isArray(raw.children)
    ? (raw.children.map(sanitizeNode).filter(Boolean) as AiBlockNode[])
    : undefined;

  return { type, content, ...(children?.length ? { children } : {}) };
}

/**
 * Parses a model text response into AiBlockNode[]. Handles the common case
 * of the model wrapping JSON in a ```json fence despite instructions, and
 * sanitizes every node defensively — a hallucinated type or malformed
 * content shape degrades to a safe default instead of corrupting a Block
 * row (this output only ever becomes AiSuggestion.proposedContent, never a
 * Block directly, but the shape still has to be safe to render/accept).
 */
export function parseAiBlockArray(responseText: string): AiBlockNode[] {
  const fenced = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : responseText;
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("AI response did not contain a JSON array");
  }
  const parsed = JSON.parse(raw.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error("AI response JSON is not an array");
  return parsed.map(sanitizeNode).filter(Boolean) as AiBlockNode[];
}

export type { BlockType };
