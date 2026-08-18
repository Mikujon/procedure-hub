-- AlterTable
ALTER TABLE "procedures" ADD COLUMN "pageId" TEXT;

-- AlterTable
ALTER TABLE "pages" ADD COLUMN "ownerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "procedures_pageId_key" ON "procedures"("pageId");

-- AddForeignKey
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
