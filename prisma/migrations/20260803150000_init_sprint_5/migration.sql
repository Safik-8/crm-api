-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "is_qualified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "qualification_score" INTEGER,
ADD COLUMN     "qualification_status" TEXT NOT NULL DEFAULT 'UNQUALIFIED';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "opportunity_id" INTEGER;

-- CreateTable
CREATE TABLE "lead_qualifications" (
    "id" SERIAL NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "branch_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'UNQUALIFIED',
    "score" INTEGER NOT NULL DEFAULT 0,
    "budget_available" BOOLEAN NOT NULL DEFAULT false,
    "interest_level" TEXT NOT NULL DEFAULT 'MEDIUM',
    "purchase_timeline" TEXT,
    "decision_maker_available" BOOLEAN NOT NULL DEFAULT false,
    "product_fit" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "remarks" TEXT,
    "evaluated_by_id" INTEGER,
    "evaluated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_qualifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_qualification_histories" (
    "id" SERIAL NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "branch_id" INTEGER,
    "previous_status" TEXT,
    "new_status" TEXT NOT NULL,
    "score" INTEGER,
    "remarks" TEXT,
    "changed_by_id" INTEGER NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_qualification_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_stages" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "stage_type" TEXT NOT NULL DEFAULT 'REGULAR',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "color_code" TEXT NOT NULL DEFAULT '#6366f1',
    "default_probability_pct" INTEGER NOT NULL DEFAULT 10,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunity_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "branch_id" INTEGER,
    "opportunity_name" TEXT NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "team_id" INTEGER,
    "stage_id" INTEGER NOT NULL,
    "owner_id" INTEGER NOT NULL,
    "expected_revenue" DECIMAL(12,2) NOT NULL,
    "probability_percentage" INTEGER NOT NULL DEFAULT 10,
    "closing_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" INTEGER NOT NULL,
    "updated_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunity_stage_histories" (
    "id" SERIAL NOT NULL,
    "opportunity_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "branch_id" INTEGER,
    "previous_stage_id" INTEGER,
    "new_stage_id" INTEGER NOT NULL,
    "changed_by_id" INTEGER NOT NULL,
    "remarks" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "opportunity_stage_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposals" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "branch_id" INTEGER,
    "proposal_number" TEXT NOT NULL,
    "opportunity_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "base_price" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "final_amount" DECIMAL(12,2) NOT NULL,
    "valid_till" TIMESTAMP(3) NOT NULL,
    "terms" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "created_by_id" INTEGER NOT NULL,
    "updated_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_versions" (
    "id" SERIAL NOT NULL,
    "proposal_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "branch_id" INTEGER,
    "version_number" INTEGER NOT NULL,
    "base_price" DECIMAL(12,2) NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL,
    "final_amount" DECIMAL(12,2) NOT NULL,
    "valid_till" TIMESTAMP(3) NOT NULL,
    "terms" TEXT,
    "version_notes" TEXT,
    "product_id" INTEGER,
    "modified_by_id" INTEGER NOT NULL,
    "modified_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "win_loss_reasons" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "reason_name" TEXT NOT NULL,
    "reason_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "win_loss_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deals" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "branch_id" INTEGER,
    "deal_number" TEXT NOT NULL,
    "opportunity_id" INTEGER NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "closing_date" TIMESTAMP(3) NOT NULL,
    "final_amount" DECIMAL(12,2) NOT NULL,
    "reason_id" INTEGER,
    "remarks" TEXT,
    "closed_by_id" INTEGER NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "updated_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_histories" (
    "id" SERIAL NOT NULL,
    "deal_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "branch_id" INTEGER,
    "previous_status" TEXT,
    "new_status" TEXT NOT NULL,
    "remarks" TEXT,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deal_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "branch_id" INTEGER,
    "customer_code" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "contact_number" TEXT NOT NULL,
    "email" TEXT,
    "lead_id" INTEGER NOT NULL,
    "opportunity_id" INTEGER NOT NULL,
    "deal_id" INTEGER NOT NULL,
    "purchased_product_id" INTEGER,
    "purchase_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_revenue" DECIMAL(12,2) NOT NULL,
    "owner_team_id" INTEGER,
    "assigned_owner_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_by_id" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "created_by_id" INTEGER NOT NULL,
    "updated_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_logs" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "branch_id" INTEGER,
    "deal_id" INTEGER NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "revenue_amount" DECIMAL(12,2) NOT NULL,
    "revenue_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payment_status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "notes" TEXT,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revenue_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lead_qualifications_lead_id_key" ON "lead_qualifications"("lead_id");

-- CreateIndex
CREATE INDEX "lead_qualifications_company_id_idx" ON "lead_qualifications"("company_id");

-- CreateIndex
CREATE INDEX "lead_qualifications_branch_id_idx" ON "lead_qualifications"("branch_id");

-- CreateIndex
CREATE INDEX "lead_qualifications_lead_id_idx" ON "lead_qualifications"("lead_id");

-- CreateIndex
CREATE INDEX "lead_qualifications_status_idx" ON "lead_qualifications"("status");

-- CreateIndex
CREATE INDEX "lead_qualification_histories_lead_id_idx" ON "lead_qualification_histories"("lead_id");

-- CreateIndex
CREATE INDEX "lead_qualification_histories_company_id_idx" ON "lead_qualification_histories"("company_id");

-- CreateIndex
CREATE INDEX "lead_qualification_histories_branch_id_idx" ON "lead_qualification_histories"("branch_id");

-- CreateIndex
CREATE INDEX "lead_qualification_histories_changed_at_idx" ON "lead_qualification_histories"("changed_at");

-- CreateIndex
CREATE INDEX "opportunity_stages_company_id_idx" ON "opportunity_stages"("company_id");

-- CreateIndex
CREATE INDEX "opportunity_stages_display_order_idx" ON "opportunity_stages"("display_order");

-- CreateIndex
CREATE UNIQUE INDEX "opportunity_stages_company_id_code_key" ON "opportunity_stages"("company_id", "code");

-- CreateIndex
CREATE INDEX "opportunities_company_id_idx" ON "opportunities"("company_id");

-- CreateIndex
CREATE INDEX "opportunities_branch_id_idx" ON "opportunities"("branch_id");

-- CreateIndex
CREATE INDEX "opportunities_lead_id_idx" ON "opportunities"("lead_id");

-- CreateIndex
CREATE INDEX "opportunities_product_id_idx" ON "opportunities"("product_id");

-- CreateIndex
CREATE INDEX "opportunities_team_id_idx" ON "opportunities"("team_id");

-- CreateIndex
CREATE INDEX "opportunities_stage_id_idx" ON "opportunities"("stage_id");

-- CreateIndex
CREATE INDEX "opportunities_owner_id_idx" ON "opportunities"("owner_id");

-- CreateIndex
CREATE INDEX "opportunities_status_idx" ON "opportunities"("status");

-- CreateIndex
CREATE INDEX "opportunities_closing_date_idx" ON "opportunities"("closing_date");

-- CreateIndex
CREATE INDEX "opportunity_stage_histories_opportunity_id_idx" ON "opportunity_stage_histories"("opportunity_id");

-- CreateIndex
CREATE INDEX "opportunity_stage_histories_company_id_idx" ON "opportunity_stage_histories"("company_id");

-- CreateIndex
CREATE INDEX "opportunity_stage_histories_changed_at_idx" ON "opportunity_stage_histories"("changed_at");

-- CreateIndex
CREATE INDEX "proposals_company_id_idx" ON "proposals"("company_id");

-- CreateIndex
CREATE INDEX "proposals_opportunity_id_idx" ON "proposals"("opportunity_id");

-- CreateIndex
CREATE INDEX "proposals_status_idx" ON "proposals"("status");

-- CreateIndex
CREATE INDEX "proposals_valid_till_idx" ON "proposals"("valid_till");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_company_id_proposal_number_key" ON "proposals"("company_id", "proposal_number");

-- CreateIndex
CREATE INDEX "proposal_versions_proposal_id_idx" ON "proposal_versions"("proposal_id");

-- CreateIndex
CREATE INDEX "proposal_versions_company_id_idx" ON "proposal_versions"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "proposal_versions_proposal_id_version_number_key" ON "proposal_versions"("proposal_id", "version_number");

-- CreateIndex
CREATE INDEX "win_loss_reasons_company_id_idx" ON "win_loss_reasons"("company_id");

-- CreateIndex
CREATE INDEX "win_loss_reasons_reason_type_idx" ON "win_loss_reasons"("reason_type");

-- CreateIndex
CREATE UNIQUE INDEX "win_loss_reasons_company_id_reason_name_reason_type_key" ON "win_loss_reasons"("company_id", "reason_name", "reason_type");

-- CreateIndex
CREATE UNIQUE INDEX "deals_opportunity_id_key" ON "deals"("opportunity_id");

-- CreateIndex
CREATE INDEX "deals_company_id_idx" ON "deals"("company_id");

-- CreateIndex
CREATE INDEX "deals_branch_id_idx" ON "deals"("branch_id");

-- CreateIndex
CREATE INDEX "deals_opportunity_id_idx" ON "deals"("opportunity_id");

-- CreateIndex
CREATE INDEX "deals_lead_id_idx" ON "deals"("lead_id");

-- CreateIndex
CREATE INDEX "deals_outcome_idx" ON "deals"("outcome");

-- CreateIndex
CREATE INDEX "deals_closing_date_idx" ON "deals"("closing_date");

-- CreateIndex
CREATE UNIQUE INDEX "deals_company_id_deal_number_key" ON "deals"("company_id", "deal_number");

-- CreateIndex
CREATE INDEX "deal_histories_deal_id_idx" ON "deal_histories"("deal_id");

-- CreateIndex
CREATE INDEX "deal_histories_company_id_idx" ON "deal_histories"("company_id");

-- CreateIndex
CREATE INDEX "deal_histories_branch_id_idx" ON "deal_histories"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_deal_id_key" ON "customers"("deal_id");

-- CreateIndex
CREATE INDEX "customers_company_id_idx" ON "customers"("company_id");

-- CreateIndex
CREATE INDEX "customers_branch_id_idx" ON "customers"("branch_id");

-- CreateIndex
CREATE INDEX "customers_lead_id_idx" ON "customers"("lead_id");

-- CreateIndex
CREATE INDEX "customers_deal_id_idx" ON "customers"("deal_id");

-- CreateIndex
CREATE INDEX "customers_assigned_owner_id_idx" ON "customers"("assigned_owner_id");

-- CreateIndex
CREATE INDEX "customers_owner_team_id_idx" ON "customers"("owner_team_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_company_id_customer_code_key" ON "customers"("company_id", "customer_code");

-- CreateIndex
CREATE INDEX "revenue_logs_company_id_idx" ON "revenue_logs"("company_id");

-- CreateIndex
CREATE INDEX "revenue_logs_branch_id_idx" ON "revenue_logs"("branch_id");

-- CreateIndex
CREATE INDEX "revenue_logs_deal_id_idx" ON "revenue_logs"("deal_id");

-- CreateIndex
CREATE INDEX "revenue_logs_customer_id_idx" ON "revenue_logs"("customer_id");

-- CreateIndex
CREATE INDEX "revenue_logs_product_id_idx" ON "revenue_logs"("product_id");

-- CreateIndex
CREATE INDEX "revenue_logs_revenue_date_idx" ON "revenue_logs"("revenue_date");

-- CreateIndex
CREATE INDEX "revenue_logs_company_id_revenue_date_idx" ON "revenue_logs"("company_id", "revenue_date");

-- CreateIndex
CREATE INDEX "revenue_logs_branch_id_revenue_date_idx" ON "revenue_logs"("branch_id", "revenue_date");

-- CreateIndex
CREATE INDEX "revenue_logs_company_id_branch_id_revenue_date_idx" ON "revenue_logs"("company_id", "branch_id", "revenue_date");

-- CreateIndex
CREATE INDEX "revenue_logs_company_id_product_id_idx" ON "revenue_logs"("company_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "revenue_logs_deal_id_key" ON "revenue_logs"("deal_id");

-- CreateIndex
CREATE INDEX "lead_activities_related_entity_type_related_entity_id_idx" ON "lead_activities"("related_entity_type", "related_entity_id");

-- CreateIndex
CREATE INDEX "leads_qualification_status_idx" ON "leads"("qualification_status");

-- CreateIndex
CREATE INDEX "leads_is_qualified_idx" ON "leads"("is_qualified");

-- CreateIndex
CREATE INDEX "notifications_opportunity_id_idx" ON "notifications"("opportunity_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_qualifications" ADD CONSTRAINT "lead_qualifications_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_qualifications" ADD CONSTRAINT "lead_qualifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_qualifications" ADD CONSTRAINT "lead_qualifications_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_qualifications" ADD CONSTRAINT "lead_qualifications_evaluated_by_id_fkey" FOREIGN KEY ("evaluated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_qualification_histories" ADD CONSTRAINT "lead_qualification_histories_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_qualification_histories" ADD CONSTRAINT "lead_qualification_histories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_qualification_histories" ADD CONSTRAINT "lead_qualification_histories_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_qualification_histories" ADD CONSTRAINT "lead_qualification_histories_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_stages" ADD CONSTRAINT "opportunity_stages_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_stages" ADD CONSTRAINT "opportunity_stages_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_stages" ADD CONSTRAINT "opportunity_stages_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "opportunity_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_stage_histories" ADD CONSTRAINT "opportunity_stage_histories_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_stage_histories" ADD CONSTRAINT "opportunity_stage_histories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_stage_histories" ADD CONSTRAINT "opportunity_stage_histories_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_stage_histories" ADD CONSTRAINT "opportunity_stage_histories_previous_stage_id_fkey" FOREIGN KEY ("previous_stage_id") REFERENCES "opportunity_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_stage_histories" ADD CONSTRAINT "opportunity_stage_histories_new_stage_id_fkey" FOREIGN KEY ("new_stage_id") REFERENCES "opportunity_stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunity_stage_histories" ADD CONSTRAINT "opportunity_stage_histories_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_modified_by_id_fkey" FOREIGN KEY ("modified_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "win_loss_reasons" ADD CONSTRAINT "win_loss_reasons_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "win_loss_reasons" ADD CONSTRAINT "win_loss_reasons_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_reason_id_fkey" FOREIGN KEY ("reason_id") REFERENCES "win_loss_reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_histories" ADD CONSTRAINT "deal_histories_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_histories" ADD CONSTRAINT "deal_histories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_histories" ADD CONSTRAINT "deal_histories_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_histories" ADD CONSTRAINT "deal_histories_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_purchased_product_id_fkey" FOREIGN KEY ("purchased_product_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_owner_team_id_fkey" FOREIGN KEY ("owner_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_assigned_owner_id_fkey" FOREIGN KEY ("assigned_owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_logs" ADD CONSTRAINT "revenue_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_logs" ADD CONSTRAINT "revenue_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_logs" ADD CONSTRAINT "revenue_logs_deal_id_fkey" FOREIGN KEY ("deal_id") REFERENCES "deals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_logs" ADD CONSTRAINT "revenue_logs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_logs" ADD CONSTRAINT "revenue_logs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revenue_logs" ADD CONSTRAINT "revenue_logs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

