-- AlterTable
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "email_sent" BOOLEAN NOT NULL DEFAULT false;
