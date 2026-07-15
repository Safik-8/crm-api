-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_pipeline_id_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_stage_id_fkey";

-- AlterTable
ALTER TABLE "lead_sources" ADD COLUMN     "description" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "alternate_mobile" TEXT,
ADD COLUMN     "branch_id" INTEGER,
ADD COLUMN     "budget" DECIMAL(10,2),
ADD COLUMN     "city" TEXT,
ADD COLUMN     "company_id" INTEGER,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "course_id" INTEGER,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by" INTEGER,
ADD COLUMN     "duplicate_of_id" INTEGER,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "is_duplicate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "source_id" INTEGER,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "status_id" INTEGER,
ADD COLUMN     "team_id" INTEGER,
ALTER COLUMN "pipeline_id" DROP NOT NULL,
ALTER COLUMN "stage_id" DROP NOT NULL,
ALTER COLUMN "date" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "lead_statuses" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "display_color" TEXT NOT NULL,
    "sequence_order" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_notes" (
    "id" SERIAL NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_by" INTEGER NOT NULL,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_import_logs" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "pipeline_id" INTEGER,
    "file_name" TEXT NOT NULL,
    "total_rows" INTEGER NOT NULL,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "duplicate_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "error_report" JSONB,
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_import_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_statuses_company_id_idx" ON "lead_statuses"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_statuses_company_id_code_key" ON "lead_statuses"("company_id", "code");

-- CreateIndex
CREATE INDEX "lead_notes_lead_id_idx" ON "lead_notes"("lead_id");

-- CreateIndex
CREATE INDEX "lead_import_logs_company_id_idx" ON "lead_import_logs"("company_id");

-- CreateIndex
CREATE INDEX "lead_import_logs_branch_id_idx" ON "lead_import_logs"("branch_id");

-- CreateIndex
CREATE INDEX "lead_import_logs_created_by_idx" ON "lead_import_logs"("created_by");

-- CreateIndex
CREATE INDEX "lead_sources_company_id_idx" ON "lead_sources"("company_id");

-- CreateIndex
CREATE INDEX "leads_company_id_idx" ON "leads"("company_id");

-- CreateIndex
CREATE INDEX "leads_branch_id_idx" ON "leads"("branch_id");

-- CreateIndex
CREATE INDEX "leads_source_id_idx" ON "leads"("source_id");

-- CreateIndex
CREATE INDEX "leads_course_id_idx" ON "leads"("course_id");

-- CreateIndex
CREATE INDEX "leads_status_id_idx" ON "leads"("status_id");

-- CreateIndex
CREATE INDEX "leads_team_id_idx" ON "leads"("team_id");

-- CreateIndex
CREATE INDEX "leads_mobile_idx" ON "leads"("mobile");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- CreateIndex
CREATE INDEX "leads_alternate_mobile_idx" ON "leads"("alternate_mobile");

-- CreateIndex
CREATE INDEX "leads_company_id_mobile_idx" ON "leads"("company_id", "mobile");

-- CreateIndex
CREATE INDEX "leads_is_duplicate_idx" ON "leads"("is_duplicate");

-- CreateIndex
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "lead_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "lead_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_duplicate_of_id_fkey" FOREIGN KEY ("duplicate_of_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_statuses" ADD CONSTRAINT "lead_statuses_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_import_logs" ADD CONSTRAINT "lead_import_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_import_logs" ADD CONSTRAINT "lead_import_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_import_logs" ADD CONSTRAINT "lead_import_logs_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_import_logs" ADD CONSTRAINT "lead_import_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
