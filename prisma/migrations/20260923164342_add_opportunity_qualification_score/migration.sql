-- AlterTable
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "qualification_score" INTEGER;
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "qualified_at" TIMESTAMPTZ;
