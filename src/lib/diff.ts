import { diffArrays, diffWordsWithSpace, type Change } from "diff";
import { collectText, type PMNode } from "./prosemirror-text";

/**
 * Diff between two ProcedureVersion.contentJson snapshots (the ProseMirror
 * docs produced by blocksToProseMirrorDoc — see lib/blocks/serialize.ts).
 * Works at block granularity (paragraph, heading, list item, ...) rather
 * than on raw HTML: diffing markup directly would flag every tag rewrite as
 * a change and hide the actual text edit inside noise.
 */

export interface DiffUnit {
  label: string;
  text: string;
}

export type DiffBlockResult =
  | { status: "unchanged"; label: string; text: string }
  | { status: "added"; label: string; text: string }
  | { status: "removed"; label: string; text: string }
  | { status: "modified"; label: string; oldText: string; newText: string; wordDiff: Change[] };

const HEADING_LABELS: Record<number, string> = { 1: "Titolo 1", 2: "Titolo 2", 3: "Titolo 3" };

function tableText(node: PMNode): string {
  const rows = node.content ?? [];
  return rows.map((row) => (row.content ?? []).map((cell) => collectText(cell)).join(" | ")).join("\n");
}

function listItemUnits(item: PMNode, kind: "bullet" | "ordered" | "task", index: number, depth: number): DiffUnit[] {
  const paragraph = (item.content ?? []).find((n) => n.type === "paragraph");
  const checked = item.attrs?.checked;
  const bullet = kind === "task" ? (checked ? "[x]" : "[ ]") : kind === "ordered" ? `${index + 1}.` : "•";
  const label = kind === "task" ? "Attività" : "Elemento lista";
  const text = `${"  ".repeat(depth)}${bullet} ${collectText(paragraph)}`.trimEnd();
  const units: DiffUnit[] = [{ label, text }];
  const nestedLists = (item.content ?? []).filter((n) => ["bulletList", "orderedList", "taskList"].includes(n.type));
  for (const list of nestedLists) units.push(...listUnits(list, depth + 1));
  return units;
}

function listUnits(list: PMNode, depth = 0): DiffUnit[] {
  const kind = list.type === "bulletList" ? "bullet" : list.type === "orderedList" ? "ordered" : "task";
  return (list.content ?? []).flatMap((item, i) => listItemUnits(item, kind, i, depth));
}

/** Flattens a ProseMirror doc's top-level nodes into one diffable unit each. */
export function extractDiffUnits(doc: PMNode | null | undefined): DiffUnit[] {
  const nodes = doc?.content ?? [];
  const units: DiffUnit[] = [];
  for (const node of nodes) {
    switch (node.type) {
      case "paragraph": {
        const text = collectText(node);
        if (text.trim()) units.push({ label: "Paragrafo", text });
        break;
      }
      case "heading":
        units.push({ label: HEADING_LABELS[node.attrs?.level ?? 1] ?? "Titolo", text: collectText(node) });
        break;
      case "blockquote":
        units.push({ label: "Citazione", text: collectText(node) });
        break;
      case "codeBlock":
        units.push({ label: "Codice", text: collectText(node) });
        break;
      case "horizontalRule":
        units.push({ label: "Divisore", text: "———" });
        break;
      case "image":
        units.push({ label: "Immagine", text: node.attrs?.alt || node.attrs?.src || "" });
        break;
      case "youtube":
        units.push({ label: "Video", text: node.attrs?.src ?? "" });
        break;
      case "table":
        units.push({ label: "Tabella", text: tableText(node) });
        break;
      case "bulletList":
      case "orderedList":
      case "taskList":
        units.push(...listUnits(node));
        break;
      default:
        break;
    }
  }
  return units;
}

/** Fraction of the longer text's characters that diffWordsWithSpace considers unchanged. */
function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  let same = 0;
  for (const part of diffWordsWithSpace(a, b)) {
    if (!part.added && !part.removed) same += part.value.length;
  }
  return same / Math.max(a.length, b.length, 1);
}

const SIMILARITY_THRESHOLD = 0.4;

/**
 * Greedy best-match pairing between a removed run and an added run, instead
 * of pairing them by position. Positional pairing breaks as soon as one item
 * is deleted (or inserted) in the middle of a run: everything after it
 * shifts by one slot, so the "same paragraph, one word changed" case and the
 * "unrelated adjacent items" case both end up compared against each other,
 * producing a wall of noise instead of a clean remove + a clean add.
 */
function matchSimilar(removed: DiffUnit[], added: DiffUnit[]): Map<number, number> {
  const candidates: { r: number; a: number; score: number }[] = [];
  for (let r = 0; r < removed.length; r++) {
    for (let a = 0; a < added.length; a++) {
      if (removed[r].label !== added[a].label) continue; // a heading shouldn't "become" a table
      const score = similarity(removed[r].text, added[a].text);
      if (score >= SIMILARITY_THRESHOLD) candidates.push({ r, a, score });
    }
  }
  candidates.sort((x, y) => y.score - x.score);

  const usedR = new Set<number>();
  const usedA = new Set<number>();
  const matches = new Map<number, number>();
  for (const c of candidates) {
    if (usedR.has(c.r) || usedA.has(c.a)) continue;
    usedR.add(c.r);
    usedA.add(c.a);
    matches.set(c.r, c.a);
  }
  return matches;
}

/**
 * Block-level diff (LCS over the flattened unit list) with a second pass
 * that pairs up similar removed/added blocks in a changed run and turns each
 * pair into a word-level diff — otherwise a one-word edit to a paragraph
 * would render as "whole paragraph removed" + "whole paragraph added"
 * instead of showing what actually changed.
 */
export function computeVersionDiff(oldDoc: any, newDoc: any): DiffBlockResult[] {
  const oldUnits = extractDiffUnits(oldDoc);
  const newUnits = extractDiffUnits(newDoc);

  const changes = diffArrays(oldUnits, newUnits, {
    comparator: (a: DiffUnit, b: DiffUnit) => a.label === b.label && a.text === b.text,
  });

  const result: DiffBlockResult[] = [];
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];

    if (!change.added && !change.removed) {
      for (const unit of change.value) result.push({ status: "unchanged", label: unit.label, text: unit.text });
      continue;
    }

    if (change.removed) {
      const next = changes[i + 1];
      if (next?.added) {
        const removedUnits = change.value;
        const addedUnits = next.value;
        const matches = matchSimilar(removedUnits, addedUnits);
        const matchedAdded = new Set(matches.values());

        for (let r = 0; r < removedUnits.length; r++) {
          const a = matches.get(r);
          if (a === undefined) {
            result.push({ status: "removed", label: removedUnits[r].label, text: removedUnits[r].text });
            continue;
          }
          const oldUnit = removedUnits[r];
          const newUnit = addedUnits[a];
          result.push({
            status: "modified",
            label: newUnit.label,
            oldText: oldUnit.text,
            newText: newUnit.text,
            wordDiff: diffWordsWithSpace(oldUnit.text, newUnit.text),
          });
        }
        for (let a = 0; a < addedUnits.length; a++) {
          if (!matchedAdded.has(a)) result.push({ status: "added", label: addedUnits[a].label, text: addedUnits[a].text });
        }
        i++; // the "added" chunk was consumed as part of this pairing
        continue;
      }
      for (const unit of change.value) result.push({ status: "removed", label: unit.label, text: unit.text });
      continue;
    }

    // change.added with no preceding removed chunk (handled above otherwise)
    for (const unit of change.value) result.push({ status: "added", label: unit.label, text: unit.text });
  }
  return result;
}

export function summarizeDiff(blocks: DiffBlockResult[]) {
  return blocks.reduce(
    (acc, b) => {
      if (b.status !== "unchanged") acc[b.status]++;
      return acc;
    },
    { added: 0, removed: 0, modified: 0 }
  );
}
