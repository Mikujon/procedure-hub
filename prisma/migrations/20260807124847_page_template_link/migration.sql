-- AlterTable
ALTER TABLE "pages" ADD COLUMN     "templateId" TEXT;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
