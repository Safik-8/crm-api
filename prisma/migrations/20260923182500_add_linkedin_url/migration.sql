-- AlterTable
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "linkedin_url" TEXT;

-- AlterTable
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "linkedin_url" TEXT;
