-- CreateEnum
CREATE TYPE "AckReminderStage" AS ENUM ('INITIAL', 'DAY_3', 'DAY_7', 'DAY_14');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "managerId" TEXT;

-- CreateTable
CREATE TABLE "ack_campaigns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "targetUserIds" TEXT[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ack_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ack_reminders" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "stage" "AckReminderStage" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ack_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ack_campaigns_tenantId_procedureId_idx" ON "ack_campaigns"("tenantId", "procedureId");

-- CreateIndex
CREATE UNIQUE INDEX "ack_reminders_campaignId_stage_key" ON "ack_reminders"("campaignId", "stage");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ack_campaigns" ADD CONSTRAINT "ack_campaigns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ack_campaigns" ADD CONSTRAINT "ack_campaigns_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "procedures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ack_reminders" ADD CONSTRAINT "ack_reminders_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ack_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
