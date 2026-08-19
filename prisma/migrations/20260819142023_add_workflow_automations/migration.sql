-- CreateEnum
CREATE TYPE "AutomationTriggerType" AS ENUM ('PROCEDURE_STATUS_ENTERED', 'REVIEW_DATE_DUE', 'ACK_CAMPAIGN_AGE');

-- CreateEnum
CREATE TYPE "AutomationActionType" AS ENUM ('SEND_NOTIFICATION', 'CHANGE_PROCEDURE_STATUS');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'AUTOMATION';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "triggerType" "AutomationTriggerType" NOT NULL,
    "triggerConfig" JSONB NOT NULL,
    "conditions" JSONB,
    "actionType" "AutomationActionType" NOT NULL,
    "actionConfig" JSONB NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_runs" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fireKey" TEXT NOT NULL,
    "firedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "error" TEXT,

    CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automation_rules_tenantId_triggerType_isEnabled_idx" ON "automation_rules"("tenantId", "triggerType", "isEnabled");

-- CreateIndex
CREATE INDEX "automation_runs_tenantId_ruleId_idx" ON "automation_runs"("tenantId", "ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "automation_runs_ruleId_entityId_fireKey_key" ON "automation_runs"("ruleId", "entityId", "fireKey");

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
