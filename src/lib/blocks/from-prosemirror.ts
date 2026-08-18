import { PrismaClient, Prisma } from "@prisma/client";

/**
 * Converts a ProseMirror document (ProcedureVersion.contentJson, or —
 * since Fase 2b — Page.content) into a tree of Block rows. Shared by
 * scripts/migrate-to-blocks.ts, scripts/migrate-pages-to-blocks.ts, and the
 * lazy backfill in GET /api/procedures/[id]/blocks.
 */

export interface PMNode {
  type: string;
  attrs?: Record<string, any>;
  content?: PMNode[];
  text?: string;
  marks?: any[];
}

/** A Block belongs to exactly one of Procedure or Page — never both. */
export type BlockParent = { procedureId: string } | { pageId: string };

/** Block.content is a Prisma Json field — our PMNode shape is structurally JSON but not nominally InputJsonObject. */
function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function extractText(node: PMNode | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(extractText).join("");
}

function inlineContent(node: PMNode | undefined): PMNode[] {
  if (!node?.content) return [];
  const first = node.content[0];
  if (first && first.type !== "text" && first.content) {
    return node.content.flatMap((child) => child.content ?? []);
  }
  return node.content;
}

const HEADING_TYPES: Record<number, "HEADING_1" | "HEADING_2" | "HEADING_3"> = {
  1: "HEADING_1",
  2: "HEADING_2",
  3: "HEADING_3",
};

async function createBlockForNode(
  db: PrismaClient,
  node: PMNode,
  tenantId: string,
  parent: BlockParent,
  parentBlockId: string | null,
  sortOrder: number
): Promise<void> {
  switch (node.type) {
    case "paragraph":
      await db.block.create({
        data: { tenantId, ...parent, parentBlockId, sortOrder, type: "PARAGRAPH", content: toJson({ text: node.content ?? [] }) },
      });
      return;
    case "heading": {
      const level = (node.attrs?.level ?? 1) as 1 | 2 | 3;
      await db.block.create({
        data: { tenantId, ...parent, parentBlockId, sortOrder, type: HEADING_TYPES[level] ?? "HEADING_1", content: toJson({ text: node.content ?? [] }) },
      });
      return;
    }
    case "blockquote":
      await db.block.create({
        data: { tenantId, ...parent, parentBlockId, sortOrder, type: "QUOTE", content: toJson({ text: inlineContent(node) }) },
      });
      return;
    case "codeBlock":
      await db.block.create({
        data: { tenantId, ...parent, parentBlockId, sortOrder, type: "CODE", content: toJson({ language: node.attrs?.language ?? null, code: extractText(node) }) },
      });
      return;
    case "horizontalRule":
      await db.block.create({ data: { tenantId, ...parent, parentBlockId, sortOrder, type: "DIVIDER", content: {} } });
      return;
    case "image":
      await db.block.create({
        data: { tenantId, ...parent, parentBlockId, sortOrder, type: "IMAGE", content: { url: node.attrs?.src ?? "", caption: node.attrs?.alt ?? "" } },
      });
      return;
    case "youtube":
      await db.block.create({
        data: { tenantId, ...parent, parentBlockId, sortOrder, type: "VIDEO", content: { url: node.attrs?.src ?? "" } },
      });
      return;
    case "table": {
      const rows = (node.content ?? []).map((row) => (row.content ?? []).map((cell) => extractText(cell)));
      await db.block.create({ data: { tenantId, ...parent, parentBlockId, sortOrder, type: "TABLE_SIMPLE", content: { rows } } });
      return;
    }
    case "bulletList":
    case "orderedList": {
      const itemType = node.type === "bulletList" ? "BULLETED_LIST_ITEM" : "NUMBERED_LIST_ITEM";
      const items = node.content ?? [];
      for (let i = 0; i < items.length; i++) {
        await createListItem(db, items[i], tenantId, parent, parentBlockId, sortOrder + i, itemType);
      }
      return;
    }
    case "taskList": {
      const items = node.content ?? [];
      for (let i = 0; i < items.length; i++) {
        await createListItem(db, items[i], tenantId, parent, parentBlockId, sortOrder + i, "CHECKLIST_ITEM");
      }
      return;
    }
    default:
      await db.block.create({
        data: { tenantId, ...parent, parentBlockId, sortOrder, type: "PARAGRAPH", content: toJson({ text: inlineContent(node) }) },
      });
  }
}

async function createListItem(
  db: PrismaClient,
  item: PMNode,
  tenantId: string,
  parent: BlockParent,
  parentBlockId: string | null,
  sortOrder: number,
  itemType: "BULLETED_LIST_ITEM" | "NUMBERED_LIST_ITEM" | "CHECKLIST_ITEM"
): Promise<void> {
  const children = item.content ?? [];
  const leadParagraph = children.find((c) => c.type === "paragraph");
  const nestedLists = children.filter((c) => c.type === "bulletList" || c.type === "orderedList" || c.type === "taskList");

  const created = await db.block.create({
    data: {
      tenantId,
      ...parent,
      parentBlockId,
      sortOrder,
      type: itemType,
      content: toJson({
        text: leadParagraph?.content ?? [],
        ...(itemType === "CHECKLIST_ITEM" ? { checked: Boolean(item.attrs?.checked) } : {}),
      }),
    },
  });

  let childSortOrder = 0;
  for (const nested of nestedLists) {
    await createBlockForNode(db, nested, tenantId, parent, created.id, childSortOrder);
    childSortOrder += (nested.content ?? []).length;
  }
}

/** Creates root Block rows (and their nested children) for every top-level node in a ProseMirror doc. Caller is responsible for the "does this procedure/page already have blocks" idempotency check. */
export async function createBlocksFromProseMirrorDoc(
  db: PrismaClient,
  tenantId: string,
  parent: BlockParent,
  doc: PMNode | null
): Promise<number> {
  const topLevelNodes = doc?.content ?? [];
  for (let i = 0; i < topLevelNodes.length; i++) {
    await createBlockForNode(db, topLevelNodes[i], tenantId, parent, null, i);
  }
  return topLevelNodes.length;
}
