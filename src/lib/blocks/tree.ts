import type { Block } from "@prisma/client";

export type BlockWithChildren = Block & { children: BlockWithChildren[] };

/**
 * Flat Block[] (any order, any mix of levels) -> nested tree, each level
 * sorted by sortOrder. A block whose parentBlockId doesn't resolve within
 * the given set (shouldn't happen, but data can drift) is treated as root
 * rather than dropped.
 */
export function buildBlockTree(blocks: Block[]): BlockWithChildren[] {
  const byId = new Map<string, BlockWithChildren>();
  for (const block of blocks) {
    byId.set(block.id, { ...block, children: [] });
  }

  const roots: BlockWithChildren[] = [];
  for (const block of byId.values()) {
    const parent = block.parentBlockId ? byId.get(block.parentBlockId) : undefined;
    if (parent) {
      parent.children.push(block);
    } else {
      roots.push(block);
    }
  }

  const sortRecursive = (nodes: BlockWithChildren[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const node of nodes) sortRecursive(node.children);
  };
  sortRecursive(roots);

  return roots;
}
