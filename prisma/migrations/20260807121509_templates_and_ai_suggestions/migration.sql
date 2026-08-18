-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('PRD', 'FUNCTIONAL_ANALYSIS', 'USER_STORY', 'TECH_SPEC_RFC', 'MEETING_NOTES', 'CUSTOM');

-- CreateEnum
CREATE TYPE "AiSuggestionKind" AS ENUM ('DRAFT_FROM_CONVERSATION', 'GAP_ANALYSIS', 'SECTION_COMPLETION', 'RELATED_DOCUMENT_LINK', 'EXECUTIVE_SUMMARY');

-- CreateEnum
CREATE TYPE "AiSuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'PARTIALLY_ACCEPTED');

-- AlterTable
ALTER TABLE "templates" ADD COLUMN     "blockTemplate" JSONB,
ADD COLUMN     "category" "TemplateCategory",
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "trackingDatabaseId" TEXT,
ALTER COLUMN "tenantId" DROP NOT NULL,
ALTER COLUMN "type" DROP NOT NULL,
ALTER COLUMN "contentJson" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ai_suggestions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "targetBlockId" TEXT,
    "kind" "AiSuggestionKind" NOT NULL,
    "proposedContent" JSONB NOT NULL,
    "notes" JSONB,
    "status" "AiSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,

    CONSTRAINT "ai_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_suggestions_pageId_status_idx" ON "ai_suggestions"("pageId", "status");

-- AddForeignKey
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_suggestions" ADD CONSTRAINT "ai_suggestions_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
