-- AlterTable
ALTER TABLE "lead_qualifications" ADD COLUMN IF NOT EXISTS "criteria_values" JSONB;

-- AlterTable
ALTER TABLE "lead_qualification_histories" ADD COLUMN IF NOT EXISTS "criteria_snapshot" JSONB;

-- CreateTable
CREATE TABLE IF NOT EXISTS "company_qualification_criteria" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "field_type" TEXT NOT NULL,
    "max_points" INTEGER NOT NULL,
    "options" JSONB,
    "default_value" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_qualification_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "company_qualification_settings" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "pass_threshold" INTEGER NOT NULL DEFAULT 60,
    "hold_threshold" INTEGER NOT NULL DEFAULT 40,
    "valid_statuses" JSONB NOT NULL DEFAULT '["QUALIFIED","NOT_QUALIFIED","ON_HOLD","UNQUALIFIED"]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_qualification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "company_qualification_settings_company_id_key" ON "company_qualification_settings"("company_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "company_qualification_criteria_company_id_idx" ON "company_qualification_criteria"("company_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "company_qualification_criteria_is_active_idx" ON "company_qualification_criteria"("is_active");

-- AddForeignKey
ALTER TABLE "company_qualification_criteria" ADD CONSTRAINT "company_qualification_criteria_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_qualification_settings" ADD CONSTRAINT "company_qualification_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
