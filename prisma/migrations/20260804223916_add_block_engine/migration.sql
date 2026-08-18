-- CreateEnum
CREATE TYPE "BlockType" AS ENUM ('PARAGRAPH', 'HEADING_1', 'HEADING_2', 'HEADING_3', 'BULLETED_LIST_ITEM', 'NUMBERED_LIST_ITEM', 'TOGGLE_LIST_ITEM', 'CHECKLIST_ITEM', 'CALLOUT', 'QUOTE', 'DIVIDER', 'COLUMN_LIST', 'COLUMN', 'CODE', 'IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'EMBED', 'DIAGRAM', 'TABLE_SIMPLE', 'TABLE_OF_CONTENTS', 'PAGE_LINK', 'SYNCED_BLOCK_SOURCE', 'SYNCED_BLOCK_REFERENCE');

-- AlterTable
ALTER TABLE "procedures" ADD COLUMN     "collaborativeStateB64" BYTEA;

-- CreateTable
CREATE TABLE "blocks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "parentBlockId" TEXT,
    "type" "BlockType" NOT NULL,
    "content" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "blocks_procedureId_parentBlockId_sortOrder_idx" ON "blocks"("procedureId", "parentBlockId", "sortOrder");

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "procedures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_parentBlockId_fkey" FOREIGN KEY ("parentBlockId") REFERENCES "blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
