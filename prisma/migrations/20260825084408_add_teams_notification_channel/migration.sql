-- AlterEnum
ALTER TYPE "NotificationChannel" ADD VALUE 'TEAMS';

-- AlterTable
ALTER TABLE "notification_preferences" ADD COLUMN     "teamsEnabled" BOOLEAN NOT NULL DEFAULT false;
