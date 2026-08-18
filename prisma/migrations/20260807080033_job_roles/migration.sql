-- AlterTable
ALTER TABLE "users" ADD COLUMN     "jobRoleId" TEXT;

-- CreateTable
CREATE TABLE "job_roles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "job_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procedure_job_roles" (
    "procedureId" TEXT NOT NULL,
    "jobRoleId" TEXT NOT NULL,

    CONSTRAINT "procedure_job_roles_pkey" PRIMARY KEY ("procedureId","jobRoleId")
);

-- CreateIndex
CREATE UNIQUE INDEX "job_roles_tenantId_name_key" ON "job_roles"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "job_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_roles" ADD CONSTRAINT "job_roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_job_roles" ADD CONSTRAINT "procedure_job_roles_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "procedures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedure_job_roles" ADD CONSTRAINT "procedure_job_roles_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "job_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
