-- DropForeignKey
ALTER TABLE "daily_branch_reports" DROP CONSTRAINT "daily_branch_reports_updated_by_fkey";

-- DropIndex
DROP INDEX "roles_name_key";

-- AlterTable
ALTER TABLE "branches" ADD COLUMN     "address" TEXT,
ADD COLUMN     "assignment_algorithm" TEXT,
ADD COLUMN     "assignment_resolution_level" TEXT NOT NULL DEFAULT 'PERSON',
ADD COLUMN     "auto_assignment_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "max_daily_leads_per_user" INTEGER;

-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "address" TEXT,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "daily_branch_reports" DROP COLUMN "joining_formalities",
DROP COLUMN "revenue",
DROP COLUMN "seminar_tasks",
DROP COLUMN "updated_at",
DROP COLUMN "updated_by";

-- AlterTable
ALTER TABLE "lead_notes" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "lead_sources" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "lead_statuses" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "is_qualified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "qualification_score" INTEGER,
ADD COLUMN     "qualification_status" TEXT NOT NULL DEFAULT 'UNQUALIFIED';

-- AlterTable
ALTER TABLE "permissions" ADD COLUMN     "can_archive" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "browser" TEXT,
ADD COLUMN     "deviceName" TEXT,
ADD COLUMN     "ip_address" TEXT,
ADD COLUMN     "last_active" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "os" TEXT;

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "company_id" INTEGER,
ADD COLUMN     "created_by" INTEGER,
ADD COLUMN     "is_system" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rank" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "stages" ADD COLUMN     "code" TEXT,
ADD COLUMN     "color_code" TEXT,
ADD COLUMN     "display_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stage_type" TEXT NOT NULL DEFAULT 'REGULAR',
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "password_resets" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "company_id" INTEGER,
    "otp" TEXT NOT NULL,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_assignments" (
    "id" SERIAL NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "branch_id" INTEGER,
    "assignment_type" TEXT NOT NULL,
    "assigned_to_user_id" INTEGER,
    "assigned_to_team_id" INTEGER,
    "previous_user_id" INTEGER,
    "previous_team_id" INTEGER,
    "assigned_by_id" INTEGER NOT NULL,
    "notes" TEXT,
    "reason" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_histories" (
    "id" SERIAL NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "branch_id" INTEGER,
    "previous_stage_id" INTEGER,
    "new_stage_id" INTEGER NOT NULL,
    "changed_by_id" INTEGER NOT NULL,
    "reason" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "followups" (
    "id" SERIAL NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "branch_id" INTEGER,
    "followup_type" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "completion_notes" TEXT,
    "completed_at" TIMESTAMP(3),
    "completed_by_id" INTEGER,
    "assigned_to_id" INTEGER NOT NULL,
    "created_by" INTEGER NOT NULL,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "followups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "lead_id" INTEGER,
    "company_id" INTEGER,
    "branch_id" INTEGER,
    "followup_id" INTEGER,
    "opportunity_id" INTEGER,
    "notification_type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNREAD',
    "read_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

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
    "criteria_values" JSONB,
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
    "criteria_snapshot" JSONB,
    "changed_by_id" INTEGER NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_qualification_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_qualification_criteria" (
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
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_qualification_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_qualification_settings" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "pass_threshold" INTEGER NOT NULL DEFAULT 60,
    "hold_threshold" INTEGER NOT NULL DEFAULT 40,
    "valid_statuses" JSONB NOT NULL DEFAULT '["QUALIFIED","NOT_QUALIFIED","ON_HOLD","UNQUALIFIED"]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_qualification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" SERIAL NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "activity_type" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "related_entity_type" TEXT,
    "related_entity_id" INTEGER,
    "performed_by_id" INTEGER,
    "performed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_logs" (
    "id" SERIAL NOT NULL,
    "lead_id" INTEGER NOT NULL,
    "company_id" INTEGER NOT NULL,
    "branch_id" INTEGER,
    "communication_type" TEXT NOT NULL,
    "summary" TEXT,
    "interaction_date" TIMESTAMP(3) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_by" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_logs_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "password_resets_user_id_idx" ON "password_resets"("user_id");

-- CreateIndex
CREATE INDEX "password_resets_company_id_idx" ON "password_resets"("company_id");

-- CreateIndex
CREATE INDEX "lead_assignments_lead_id_idx" ON "lead_assignments"("lead_id");

-- CreateIndex
CREATE INDEX "lead_assignments_company_id_idx" ON "lead_assignments"("company_id");

-- CreateIndex
CREATE INDEX "lead_assignments_branch_id_idx" ON "lead_assignments"("branch_id");

-- CreateIndex
CREATE INDEX "lead_assignments_assigned_to_user_id_idx" ON "lead_assignments"("assigned_to_user_id");

-- CreateIndex
CREATE INDEX "lead_assignments_assigned_to_team_id_idx" ON "lead_assignments"("assigned_to_team_id");

-- CreateIndex
CREATE INDEX "lead_assignments_lead_id_assigned_at_idx" ON "lead_assignments"("lead_id", "assigned_at");

-- CreateIndex
CREATE INDEX "pipeline_histories_lead_id_idx" ON "pipeline_histories"("lead_id");

-- CreateIndex
CREATE INDEX "pipeline_histories_company_id_idx" ON "pipeline_histories"("company_id");

-- CreateIndex
CREATE INDEX "pipeline_histories_branch_id_idx" ON "pipeline_histories"("branch_id");

-- CreateIndex
CREATE INDEX "pipeline_histories_previous_stage_id_idx" ON "pipeline_histories"("previous_stage_id");

-- CreateIndex
CREATE INDEX "pipeline_histories_new_stage_id_idx" ON "pipeline_histories"("new_stage_id");

-- CreateIndex
CREATE INDEX "followups_lead_id_idx" ON "followups"("lead_id");

-- CreateIndex
CREATE INDEX "followups_company_id_idx" ON "followups"("company_id");

-- CreateIndex
CREATE INDEX "followups_branch_id_idx" ON "followups"("branch_id");

-- CreateIndex
CREATE INDEX "followups_assigned_to_id_idx" ON "followups"("assigned_to_id");

-- CreateIndex
CREATE INDEX "followups_status_idx" ON "followups"("status");

-- CreateIndex
CREATE INDEX "followups_scheduled_at_idx" ON "followups"("scheduled_at");

-- CreateIndex
CREATE INDEX "followups_assigned_to_id_status_scheduled_at_idx" ON "followups"("assigned_to_id", "status", "scheduled_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_lead_id_idx" ON "notifications"("lead_id");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "notifications_created_at_idx" ON "notifications"("created_at");

-- CreateIndex
CREATE INDEX "notifications_company_id_idx" ON "notifications"("company_id");

-- CreateIndex
CREATE INDEX "notifications_branch_id_idx" ON "notifications"("branch_id");

-- CreateIndex
CREATE INDEX "notifications_followup_id_idx" ON "notifications"("followup_id");

-- CreateIndex
CREATE INDEX "notifications_opportunity_id_idx" ON "notifications"("opportunity_id");

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
CREATE INDEX "company_qualification_criteria_company_id_idx" ON "company_qualification_criteria"("company_id");

-- CreateIndex
CREATE INDEX "company_qualification_criteria_is_active_idx" ON "company_qualification_criteria"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "company_qualification_settings_company_id_key" ON "company_qualification_settings"("company_id");

-- CreateIndex
CREATE INDEX "lead_activities_lead_id_idx" ON "lead_activities"("lead_id");

-- CreateIndex
CREATE INDEX "lead_activities_company_id_idx" ON "lead_activities"("company_id");

-- CreateIndex
CREATE INDEX "lead_activities_performed_at_idx" ON "lead_activities"("performed_at");

-- CreateIndex
CREATE INDEX "lead_activities_activity_type_idx" ON "lead_activities"("activity_type");

-- CreateIndex
CREATE INDEX "lead_activities_lead_id_performed_at_idx" ON "lead_activities"("lead_id", "performed_at");

-- CreateIndex
CREATE INDEX "lead_activities_related_entity_type_related_entity_id_idx" ON "lead_activities"("related_entity_type", "related_entity_id");

-- CreateIndex
CREATE INDEX "communication_logs_lead_id_idx" ON "communication_logs"("lead_id");

-- CreateIndex
CREATE INDEX "communication_logs_company_id_idx" ON "communication_logs"("company_id");

-- CreateIndex
CREATE INDEX "communication_logs_branch_id_idx" ON "communication_logs"("branch_id");

-- CreateIndex
CREATE INDEX "communication_logs_communication_type_idx" ON "communication_logs"("communication_type");

-- CreateIndex
CREATE INDEX "communication_logs_interaction_date_idx" ON "communication_logs"("interaction_date");

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
CREATE INDEX "leads_qualification_status_idx" ON "leads"("qualification_status");

-- CreateIndex
CREATE INDEX "leads_is_qualified_idx" ON "leads"("is_qualified");

-- CreateIndex
CREATE INDEX "roles_company_id_idx" ON "roles"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_company_id_name_key" ON "roles"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "stages_code_key" ON "stages"("code");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_assigned_to_user_id_fkey" FOREIGN KEY ("assigned_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_assigned_to_team_id_fkey" FOREIGN KEY ("assigned_to_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_previous_user_id_fkey" FOREIGN KEY ("previous_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_previous_team_id_fkey" FOREIGN KEY ("previous_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_histories" ADD CONSTRAINT "pipeline_histories_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_histories" ADD CONSTRAINT "pipeline_histories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_histories" ADD CONSTRAINT "pipeline_histories_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_histories" ADD CONSTRAINT "pipeline_histories_previous_stage_id_fkey" FOREIGN KEY ("previous_stage_id") REFERENCES "stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_histories" ADD CONSTRAINT "pipeline_histories_new_stage_id_fkey" FOREIGN KEY ("new_stage_id") REFERENCES "stages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_histories" ADD CONSTRAINT "pipeline_histories_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followups" ADD CONSTRAINT "followups_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followups" ADD CONSTRAINT "followups_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followups" ADD CONSTRAINT "followups_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followups" ADD CONSTRAINT "followups_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followups" ADD CONSTRAINT "followups_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followups" ADD CONSTRAINT "followups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "followups" ADD CONSTRAINT "followups_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_followup_id_fkey" FOREIGN KEY ("followup_id") REFERENCES "followups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "company_qualification_criteria" ADD CONSTRAINT "company_qualification_criteria_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_qualification_settings" ADD CONSTRAINT "company_qualification_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

