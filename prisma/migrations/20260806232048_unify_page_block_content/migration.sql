-- AlterTable
ALTER TABLE "blocks" ADD COLUMN     "pageId" TEXT,
ALTER COLUMN "procedureId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "blocks_pageId_parentBlockId_sortOrder_idx" ON "blocks"("pageId", "parentBlockId", "sortOrder");

-- AddForeignKey
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
