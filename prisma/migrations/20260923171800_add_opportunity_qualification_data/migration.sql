-- AlterTable
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "qualification_data" JSONB;
