-- CreateTable
CREATE TABLE "databases" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Database senza titolo',
    "icon" TEXT,
    "properties" JSONB NOT NULL,
    "views" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "databases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "database_rows" (
    "id" TEXT NOT NULL,
    "databaseId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "values" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "database_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "databases_tenantId_idx" ON "databases"("tenantId");

-- CreateIndex
CREATE INDEX "database_rows_databaseId_idx" ON "database_rows"("databaseId");

-- AddForeignKey
ALTER TABLE "databases" ADD CONSTRAINT "databases_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "databases" ADD CONSTRAINT "databases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "database_rows" ADD CONSTRAINT "database_rows_databaseId_fkey" FOREIGN KEY ("databaseId") REFERENCES "databases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
