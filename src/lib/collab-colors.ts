/**
 * Shared palette for realtime collaboration cursors (Yjs/Hocuspocus) —
 * previously duplicated as a literal `#2F5D8C`-led array in both
 * procedures/[id]/edit and pages/[id], a leftover from the original
 * ink/paper design era (predates even the Notion-blue direction). Hues
 * chosen to sit alongside --primary (teal-cyan, H186) without being
 * mistaken for a workflow-status color (amber/green/red are reserved —
 * see docs/DESIGN.md).
 */
export const CURSOR_COLORS = ["#0E7C86", "#3D5FA8", "#9A3E8C", "#B85C2E", "#2E7D5C"];

/** Deterministic color per user id — same person gets the same cursor color everywhere. */
export function colorForUser(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
}
