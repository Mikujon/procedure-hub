-- CreateEnum
CREATE TYPE "ColumnType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'SELECT', 'CHECKBOX', 'RELATION', 'ROLLUP', 'FORMULA', 'PERSON', 'URL', 'EMAIL', 'PHONE', 'FILE', 'CREATED_TIME', 'UPDATED_TIME');

-- CreateEnum
CREATE TYPE "ViewType" AS ENUM ('TABLE', 'BOARD', 'CALENDAR', 'GALLERY', 'LIST', 'TIMELINE');

-- AlterTable
ALTER TABLE "databases" ADD COLUMN     "isSystemManaged" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "database_columns" (
    "id" TEXT NOT NULL,
    "databaseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ColumnType" NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "database_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "database_views" (
    "id" TEXT NOT NULL,
    "databaseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ViewType" NOT NULL,
    "groupByColumnId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "database_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "database_row_relations" (
    "id" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "fromRowId" TEXT NOT NULL,
    "toRowId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "database_row_relations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "database_columns_databaseId_idx" ON "database_columns"("databaseId");

-- CreateIndex
CREATE INDEX "database_views_databaseId_idx" ON "database_views"("databaseId");

-- CreateIndex
CREATE INDEX "database_row_relations_toRowId_idx" ON "database_row_relations"("toRowId");

-- CreateIndex
CREATE UNIQUE INDEX "database_row_relations_columnId_fromRowId_toRowId_key" ON "database_row_relations"("columnId", "fromRowId", "toRowId");

-- AddForeignKey
ALTER TABLE "database_columns" ADD CONSTRAINT "database_columns_databaseId_fkey" FOREIGN KEY ("databaseId") REFERENCES "databases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "database_views" ADD CONSTRAINT "database_views_databaseId_fkey" FOREIGN KEY ("databaseId") REFERENCES "databases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "database_row_relations" ADD CONSTRAINT "database_row_relations_fromRowId_fkey" FOREIGN KEY ("fromRowId") REFERENCES "database_rows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "database_row_relations" ADD CONSTRAINT "database_row_relations_toRowId_fkey" FOREIGN KEY ("toRowId") REFERENCES "database_rows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
