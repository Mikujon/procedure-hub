import { PrismaClient, Prisma } from "@prisma/client";
import { createBlocksFromProseMirrorDoc, type PMNode } from "../src/lib/blocks/from-prosemirror";

const prisma = new PrismaClient();

/**
 * One-time, manual migration: turns each Page's legacy Page.content (a
 * single Tiptap/ProseMirror document) into a tree of Block rows (Fase 2b —
 * unifies the content model with what Fase 1 already did for Procedure).
 *
 * Idempotent: pages that already have Block rows are skipped. Does not
 * touch Page.content itself — it stays as a historical snapshot. Run
 * manually: `npx tsx scripts/migrate-pages-to-blocks.ts`.
 */
async function migratePage(page: { id: string; tenantId: string; title: string }, doc: PMNode | null) {
  const existing = await prisma.block.count({ where: { pageId: page.id } });
  if (existing > 0) {
    console.log(`  skip "${page.title}" (${page.id}) — already has ${existing} blocks`);
    return;
  }

  const count = await createBlocksFromProseMirrorDoc(prisma, page.tenantId, { pageId: page.id }, doc);
  if (count === 0) {
    console.log(`  skip "${page.title}" (${page.id}) — empty content`);
  } else {
    console.log(`  migrated "${page.title}" (${page.id}) — ${count} root blocks`);
  }
}

async function main() {
  const pages = await prisma.page.findMany({
    where: { content: { not: Prisma.JsonNull } },
    select: { id: true, tenantId: true, title: true, content: true },
  });

  console.log(`Found ${pages.length} pages with content.`);

  for (const page of pages) {
    await migratePage(page, page.content as PMNode | null);
  }

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
