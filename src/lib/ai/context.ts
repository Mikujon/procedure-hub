import { prisma } from "@/lib/prisma";
import { buildBlockTree, type BlockWithChildren } from "@/lib/blocks/tree";

/**
 * The canonical "what does this page look like to an AI" representation.
 * Every AI feature (Fase 5 Suggest Mode, future Q&A, gap analysis, ...)
 * calls this instead of reading Block rows and formatting them itself —
 * that's what keeps the data "AI-ready" as a real property instead of an
 * aspiration: one function, one shape, nobody bypasses it.
 */
export interface AiContext {
  markdown: string;
  metadata: {
    title: string;
    department: string;
    jobRoles: string[];
    tags: string[];
    complianceTags: string[];
    status: string;
    versionNumber: number;
    lastUpdated: string;
  };
}

/** Tags known to signal a regulatory/compliance requirement — mirrors the list already used in lib/workflow's resolveNextStage(). */
const COMPLIANCE_TAG_NAMES = new Set(["GDPR", "ISO27001", "ISO9001", "SOC2", "Compliance", "Mandatory"]);

export async function buildAiContext(procedureId: string): Promise<AiContext> {
  const procedure = await prisma.procedure.findUnique({
    where: { id: procedureId },
    include: {
      department: true,
      currentVersion: { select: { versionNumber: true } },
      tags: { include: { tag: true } },
      jobRoles: { include: { jobRole: true } },
    },
  });
  if (!procedure) throw new Error(`buildAiContext: procedure ${procedureId} not found`);

  const blocks = await prisma.block.findMany({ where: { procedureId } });
  const tree = buildBlockTree(blocks);
  const markdown = blocksToMarkdown(tree);

  const tagNames = procedure.tags.map((t) => t.tag.name);

  return {
    markdown,
    metadata: {
      title: procedure.title,
      department: procedure.department.name,
      jobRoles: procedure.jobRoles.map((r) => r.jobRole.name),
      tags: tagNames,
      complianceTags: tagNames.filter((t) => COMPLIANCE_TAG_NAMES.has(t)),
      status: procedure.status,
      versionNumber: procedure.currentVersion?.versionNumber ?? 0,
      lastUpdated: procedure.updatedAt.toISOString(),
    },
  };
}

// ---------------------------------------------------------------------------
// Block[] -> Markdown. Conceptually the inverse of
// src/lib/blocks/serialize.ts::blocksToProseMirrorDoc (Block[] -> ProseMirror
// for ProcedureVersion) — same tree, different renderer, kept as a separate
// walker rather than a shared parametrized one: the two outputs (ProseMirror
// node objects vs. Markdown lines) diverge enough per block type that a
// shared abstraction would mostly be a switch inside a switch.
// ---------------------------------------------------------------------------

interface InlineNode {
  type: string;
  text?: string;
  content?: InlineNode[];
}

function inlineText(nodes: InlineNode[] | undefined): string {
  if (!nodes) return "";
  return nodes.map((n) => (n.type === "text" ? n.text ?? "" : inlineText(n.content))).join("");
}

function indentLines(text: string, depth: number): string {
  if (!text || depth === 0) return text;
  const prefix = "  ".repeat(depth);
  return text
    .split("\n")
    .map((line) => (line ? prefix + line : line))
    .join("\n");
}

/** Position of `block` among immediately preceding siblings of the same type — for numbered-list rendering. */
function ordinalAmongSiblings(siblings: BlockWithChildren[], index: number): number {
  let count = 1;
  for (let i = index - 1; i >= 0 && siblings[i].type === siblings[index].type; i--) count++;
  return count;
}

function blockToMarkdown(block: BlockWithChildren, ordinal: number): string {
  const content = block.content as any;
  const text = inlineText(content?.text);
  const childrenMarkdown = block.children.length > 0 ? "\n" + indentLines(blocksToMarkdown(block.children), 1) : "";

  switch (block.type) {
    case "PARAGRAPH":
      return text;
    case "HEADING_1":
      return `# ${text}`;
    case "HEADING_2":
      return `## ${text}`;
    case "HEADING_3":
      return `### ${text}`;
    case "QUOTE":
      return `> ${text}`;
    case "CALLOUT":
      return `> **Nota:** ${text}`;
    case "BULLETED_LIST_ITEM":
      return `- ${text}${childrenMarkdown}`;
    case "NUMBERED_LIST_ITEM":
      return `${ordinal}. ${text}${childrenMarkdown}`;
    case "CHECKLIST_ITEM":
      return `- [${content?.checked ? "x" : " "}] ${text}`;
    case "TOGGLE_LIST_ITEM":
      return `${text}${childrenMarkdown}`;
    case "DIVIDER":
      return "---";
    case "CODE":
      return "```" + (content?.language ?? "") + "\n" + (content?.code ?? "") + "\n```";
    case "IMAGE":
      return `![${content?.caption || "immagine"}](${content?.url ?? ""})`;
    case "VIDEO":
      return `[video](${content?.url ?? ""})`;
    case "TABLE_SIMPLE": {
      const rows: string[][] = Array.isArray(content?.rows) ? content.rows : [];
      if (rows.length === 0) return "";
      const header = `| ${rows[0].join(" | ")} |`;
      const separator = `| ${rows[0].map(() => "---").join(" | ")} |`;
      const body = rows
        .slice(1)
        .map((r) => `| ${r.join(" | ")} |`)
        .join("\n");
      return [header, separator, body].filter(Boolean).join("\n");
    }
    default:
      // AUDIO, FILE, EMBED, DIAGRAM, TABLE_OF_CONTENTS, PAGE_LINK,
      // SYNCED_BLOCK_*: no dedicated rendering yet — same documented-gap
      // pattern as serialize.ts's fallback, so an AI still sees *something*
      // instead of the block silently vanishing from its context.
      return text || `[${block.type.toLowerCase()}]`;
  }
}

/** Generic Block-tree → Markdown renderer, reused by Parte B (gap-analysis, complete-section) — not Procedure-specific despite living next to buildAiContext. */
export function blocksToMarkdown(blocks: BlockWithChildren[]): string {
  return blocks
    .map((block, i) => blockToMarkdown(block, ordinalAmongSiblings(blocks, i)))
    .join("\n\n");
}
