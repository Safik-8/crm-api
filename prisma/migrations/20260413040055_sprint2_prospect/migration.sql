-- CreateEnum
CREATE TYPE "ProspectStage" AS ENUM ('NEW', 'ENGAGED', 'STRATEGY_SCHEDULED', 'STRATEGY_COMPLETED', 'TOKEN_DISCUSSION', 'TOKEN_RECEIVED', 'WIN', 'ARCHIVED');

-- CreateTable
CREATE TABLE "branch_sequences" (
    "id" SERIAL NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "last_seq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "branch_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_sources" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospects" (
    "id" SERIAL NOT NULL,
    "prospect_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "education" TEXT,
    "college" TEXT,
    "city" TEXT,
    "lead_source_id" INTEGER NOT NULL,
    "current_stage" "ProspectStage" NOT NULL DEFAULT 'NEW',
    "token_amount" DECIMAL(12,2),
    "joining_date" TIMESTAMP(3),
    "expected_revenue" DECIMAL(12,2),
    "win_date" TIMESTAMP(3),
    "duplicate_acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "archived_by_id" INTEGER,
    "manager_approval_id" INTEGER,
    "unarchived_at" TIMESTAMP(3),
    "unarchived_by_id" INTEGER,
    "assigned_to_id" INTEGER NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "last_activity_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_history" (
    "id" SERIAL NOT NULL,
    "prospect_id" INTEGER NOT NULL,
    "old_stage" "ProspectStage",
    "new_stage" "ProspectStage" NOT NULL,
    "changed_by_id" INTEGER NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "stage_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "branch_sequences_branch_id_key" ON "branch_sequences"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_sources_company_id_name_key" ON "lead_sources"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "prospects_prospect_code_key" ON "prospects"("prospect_code");

-- CreateIndex
CREATE INDEX "prospects_company_id_idx" ON "prospects"("company_id");

-- CreateIndex
CREATE INDEX "prospects_branch_id_idx" ON "prospects"("branch_id");

-- CreateIndex
CREATE INDEX "prospects_assigned_to_id_idx" ON "prospects"("assigned_to_id");

-- CreateIndex
CREATE INDEX "prospects_current_stage_idx" ON "prospects"("current_stage");

-- CreateIndex
CREATE INDEX "prospects_mobile_company_id_idx" ON "prospects"("mobile", "company_id");

-- CreateIndex
CREATE INDEX "prospects_created_at_idx" ON "prospects"("created_at");

-- CreateIndex
CREATE INDEX "stage_history_prospect_id_idx" ON "stage_history"("prospect_id");

-- AddForeignKey
ALTER TABLE "branch_sequences" ADD CONSTRAINT "branch_sequences_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_sources" ADD CONSTRAINT "lead_sources_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_lead_source_id_fkey" FOREIGN KEY ("lead_source_id") REFERENCES "lead_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_history" ADD CONSTRAINT "stage_history_prospect_id_fkey" FOREIGN KEY ("prospect_id") REFERENCES "prospects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_history" ADD CONSTRAINT "stage_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
