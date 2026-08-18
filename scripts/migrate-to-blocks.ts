import { PrismaClient } from "@prisma/client";
import { createBlocksFromProseMirrorDoc, type PMNode } from "../src/lib/blocks/from-prosemirror";

const prisma = new PrismaClient();

/**
 * One-time, manual migration: turns each Procedure's current
 * ProcedureVersion.contentJson (a single Tiptap/ProseMirror document) into a
 * tree of Block rows (Phase 1 block engine).
 *
 * Idempotent: procedures that already have Block rows are skipped, so this
 * can be re-run safely (e.g. after fixing a mapping bug) without duplicating
 * content. Run manually: `npx tsx scripts/migrate-to-blocks.ts`.
 *
 * The actual ProseMirror -> Block conversion lives in
 * src/lib/blocks/from-prosemirror.ts, shared with the lazy backfill that
 * GET /api/procedures/[id]/blocks does for procedures created after this
 * migration ran (those get a ProcedureVersion via POST /api/procedures but
 * no Block rows yet either).
 */
async function migrateProcedure(procedure: { id: string; tenantId: string; title: string }, doc: PMNode | null) {
  const existing = await prisma.block.count({ where: { procedureId: procedure.id } });
  if (existing > 0) {
    console.log(`  skip "${procedure.title}" (${procedure.id}) — already has ${existing} blocks`);
    return;
  }

  const count = await createBlocksFromProseMirrorDoc(prisma, procedure.tenantId, { procedureId: procedure.id }, doc);
  if (count === 0) {
    console.log(`  skip "${procedure.title}" (${procedure.id}) — empty content`);
  } else {
    console.log(`  migrated "${procedure.title}" (${procedure.id}) — ${count} root blocks`);
  }
}

async function main() {
  const procedures = await prisma.procedure.findMany({
    where: { currentVersionId: { not: null } },
    select: {
      id: true,
      tenantId: true,
      title: true,
      currentVersion: { select: { contentJson: true } },
    },
  });

  console.log(`Found ${procedures.length} procedures with a current version.`);

  for (const procedure of procedures) {
    const doc = (procedure.currentVersion?.contentJson ?? null) as PMNode | null;
    await migrateProcedure(procedure, doc);
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
