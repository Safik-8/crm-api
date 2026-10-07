/*
  Warnings:

  - You are about to drop the column `joining_formalities` on the `daily_branch_reports` table. All the data in the column will be lost.
  - You are about to drop the column `revenue` on the `daily_branch_reports` table. All the data in the column will be lost.
  - You are about to drop the column `seminar_tasks` on the `daily_branch_reports` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `daily_branch_reports` table. All the data in the column will be lost.
  - You are about to drop the column `updated_by` on the `daily_branch_reports` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[lead_number]` on the table `leads` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[company_id,name]` on the table `roles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `stages` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "daily_branch_reports" DROP CONSTRAINT "daily_branch_reports_updated_by_fkey";

-- DropIndex
DROP INDEX "revenue_logs_deal_id_idx";

-- DropIndex
DROP INDEX "roles_name_key";

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "entity_type" SET DEFAULT 'RECORD',
ALTER COLUMN "entity_id" SET DEFAULT 0;

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
ALTER TABLE "company_qualification_criteria" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "company_qualification_settings" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "daily_branch_reports" DROP COLUMN "joining_formalities",
DROP COLUMN "revenue",
DROP COLUMN "seminar_tasks",
DROP COLUMN "updated_at",
DROP COLUMN "updated_by";

-- AlterTable
ALTER TABLE "kpi_targets" ADD COLUMN     "calculation_meta" JSONB,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "scope_type" TEXT NOT NULL DEFAULT 'INDIVIDUAL';

-- AlterTable
ALTER TABLE "lead_notes" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "lead_sources" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "lead_statuses" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "lead_number" TEXT;

-- AlterTable
ALTER TABLE "opportunities" ALTER COLUMN "qualified_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "permissions" ADD COLUMN     "can_approve" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "can_archive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "can_assign" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "can_export" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "browser" TEXT,
ADD COLUMN     "deviceName" TEXT,
ADD COLUMN     "ip_address" TEXT,
ADD COLUMN     "is_revoked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_active" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "os" TEXT,
ADD COLUMN     "revoked_at" TIMESTAMP(3);

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
CREATE TABLE "password_histories" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempt_logs" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER,
    "user_id" INTEGER,
    "email" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "browser" TEXT,
    "device" TEXT,
    "is_success" BOOLEAN NOT NULL DEFAULT false,
    "failure_reason" TEXT,
    "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempt_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "password_resets_user_id_idx" ON "password_resets"("user_id");

-- CreateIndex
CREATE INDEX "password_resets_company_id_idx" ON "password_resets"("company_id");

-- CreateIndex
CREATE INDEX "password_histories_user_id_idx" ON "password_histories"("user_id");

-- CreateIndex
CREATE INDEX "password_histories_created_at_idx" ON "password_histories"("created_at");

-- CreateIndex
CREATE INDEX "login_attempt_logs_email_attempted_at_idx" ON "login_attempt_logs"("email", "attempted_at");

-- CreateIndex
CREATE INDEX "login_attempt_logs_ip_address_attempted_at_idx" ON "login_attempt_logs"("ip_address", "attempted_at");

-- CreateIndex
CREATE INDEX "analytics_snapshots_company_id_idx" ON "analytics_snapshots"("company_id");

-- CreateIndex
CREATE INDEX "analytics_snapshots_company_id_snapshot_type_idx" ON "analytics_snapshots"("company_id", "snapshot_type");

-- CreateIndex
CREATE INDEX "analytics_snapshots_snapshot_date_idx" ON "analytics_snapshots"("snapshot_date");

-- CreateIndex
CREATE INDEX "dashboard_widgets_company_id_idx" ON "dashboard_widgets"("company_id");

-- CreateIndex
CREATE INDEX "dashboard_widgets_widget_type_idx" ON "dashboard_widgets"("widget_type");

-- CreateIndex
CREATE INDEX "deals_company_id_outcome_closing_date_idx" ON "deals"("company_id", "outcome", "closing_date");

-- CreateIndex
CREATE INDEX "deals_company_id_branch_id_closing_date_idx" ON "deals"("company_id", "branch_id", "closing_date");

-- CreateIndex
CREATE INDEX "deals_company_id_closed_by_id_outcome_idx" ON "deals"("company_id", "closed_by_id", "outcome");

-- CreateIndex
CREATE INDEX "export_logs_company_id_idx" ON "export_logs"("company_id");

-- CreateIndex
CREATE INDEX "export_logs_branch_id_idx" ON "export_logs"("branch_id");

-- CreateIndex
CREATE INDEX "export_logs_exported_by_id_idx" ON "export_logs"("exported_by_id");

-- CreateIndex
CREATE INDEX "export_logs_exported_at_idx" ON "export_logs"("exported_at");

-- CreateIndex
CREATE INDEX "kpi_achievement_logs_kpi_target_id_idx" ON "kpi_achievement_logs"("kpi_target_id");

-- CreateIndex
CREATE INDEX "kpi_achievement_logs_company_id_idx" ON "kpi_achievement_logs"("company_id");

-- CreateIndex
CREATE INDEX "kpi_achievement_logs_recorded_at_idx" ON "kpi_achievement_logs"("recorded_at");

-- CreateIndex
CREATE INDEX "kpi_targets_company_id_idx" ON "kpi_targets"("company_id");

-- CreateIndex
CREATE INDEX "kpi_targets_branch_id_idx" ON "kpi_targets"("branch_id");

-- CreateIndex
CREATE INDEX "kpi_targets_team_id_idx" ON "kpi_targets"("team_id");

-- CreateIndex
CREATE INDEX "kpi_targets_employee_id_idx" ON "kpi_targets"("employee_id");

-- CreateIndex
CREATE INDEX "kpi_targets_scope_type_idx" ON "kpi_targets"("scope_type");

-- CreateIndex
CREATE INDEX "kpi_targets_kpi_type_idx" ON "kpi_targets"("kpi_type");

-- CreateIndex
CREATE INDEX "kpi_targets_status_idx" ON "kpi_targets"("status");

-- CreateIndex
CREATE INDEX "kpi_targets_deleted_at_idx" ON "kpi_targets"("deleted_at");

-- CreateIndex
CREATE INDEX "kpi_targets_start_date_end_date_idx" ON "kpi_targets"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "kpi_targets_company_id_scope_type_status_idx" ON "kpi_targets"("company_id", "scope_type", "status");

-- CreateIndex
CREATE INDEX "kpi_targets_company_id_kpi_type_start_date_end_date_idx" ON "kpi_targets"("company_id", "kpi_type", "start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "leads_lead_number_key" ON "leads"("lead_number");

-- CreateIndex
CREATE INDEX "leads_lead_number_idx" ON "leads"("lead_number");

-- CreateIndex
CREATE INDEX "leads_company_id_lead_number_idx" ON "leads"("company_id", "lead_number");

-- CreateIndex
CREATE INDEX "leads_company_id_created_at_idx" ON "leads"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "leads_company_id_branch_id_created_at_idx" ON "leads"("company_id", "branch_id", "created_at");

-- CreateIndex
CREATE INDEX "leads_company_id_team_id_created_at_idx" ON "leads"("company_id", "team_id", "created_at");

-- CreateIndex
CREATE INDEX "leads_company_id_source_id_idx" ON "leads"("company_id", "source_id");

-- CreateIndex
CREATE INDEX "leads_company_id_assigned_to_created_at_idx" ON "leads"("company_id", "assigned_to", "created_at");

-- CreateIndex
CREATE INDEX "leads_company_id_is_qualified_created_at_idx" ON "leads"("company_id", "is_qualified", "created_at");

-- CreateIndex
CREATE INDEX "leads_company_id_branch_id_is_qualified_idx" ON "leads"("company_id", "branch_id", "is_qualified");

-- CreateIndex
CREATE INDEX "leads_company_id_team_id_is_qualified_idx" ON "leads"("company_id", "team_id", "is_qualified");

-- CreateIndex
CREATE INDEX "opportunities_company_id_created_at_idx" ON "opportunities"("company_id", "created_at");

-- CreateIndex
CREATE INDEX "opportunities_company_id_owner_id_status_idx" ON "opportunities"("company_id", "owner_id", "status");

-- CreateIndex
CREATE INDEX "opportunities_company_id_stage_id_status_idx" ON "opportunities"("company_id", "stage_id", "status");

-- CreateIndex
CREATE INDEX "opportunities_company_id_team_id_status_idx" ON "opportunities"("company_id", "team_id", "status");

-- CreateIndex
CREATE INDEX "opportunities_company_id_branch_id_status_idx" ON "opportunities"("company_id", "branch_id", "status");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "report_filters_company_id_idx" ON "report_filters"("company_id");

-- CreateIndex
CREATE INDEX "report_filters_user_id_idx" ON "report_filters"("user_id");

-- CreateIndex
CREATE INDEX "report_filters_report_id_idx" ON "report_filters"("report_id");

-- CreateIndex
CREATE INDEX "report_view_logs_user_id_viewed_at_idx" ON "report_view_logs"("user_id", "viewed_at");

-- CreateIndex
CREATE INDEX "report_view_logs_report_id_idx" ON "report_view_logs"("report_id");

-- CreateIndex
CREATE INDEX "reports_company_id_idx" ON "reports"("company_id");

-- CreateIndex
CREATE INDEX "reports_category_idx" ON "reports"("category");

-- CreateIndex
CREATE INDEX "reports_report_type_idx" ON "reports"("report_type");

-- CreateIndex
CREATE INDEX "revenue_logs_team_id_idx" ON "revenue_logs"("team_id");

-- CreateIndex
CREATE INDEX "revenue_logs_company_id_team_id_revenue_date_idx" ON "revenue_logs"("company_id", "team_id", "revenue_date");

-- CreateIndex
CREATE INDEX "roles_company_id_idx" ON "roles"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_company_id_name_key" ON "roles"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "stages_code_key" ON "stages"("code");

-- CreateIndex
CREATE INDEX "user_dashboard_configs_company_id_idx" ON "user_dashboard_configs"("company_id");

-- CreateIndex
CREATE INDEX "user_favorite_reports_user_id_report_id_idx" ON "user_favorite_reports"("user_id", "report_id");

-- CreateIndex
CREATE INDEX "user_favorite_reports_user_id_idx" ON "user_favorite_reports"("user_id");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_histories" ADD CONSTRAINT "password_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_attempt_logs" ADD CONSTRAINT "login_attempt_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_attempt_logs" ADD CONSTRAINT "login_attempt_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- ALTER TABLE "notifications" ADD CONSTRAINT "notifications_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ALTER TABLE "notifications" ADD CONSTRAINT "notifications_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ALTER TABLE "notifications" ADD CONSTRAINT "notifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ALTER TABLE "notifications" ADD CONSTRAINT "notifications_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ALTER TABLE "notifications" ADD CONSTRAINT "notifications_followup_id_fkey" FOREIGN KEY ("followup_id") REFERENCES "followups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_event_configs" ADD CONSTRAINT "notification_event_configs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_logs" ADD CONSTRAINT "backup_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backup_logs" ADD CONSTRAINT "backup_logs_triggered_by_id_fkey" FOREIGN KEY ("triggered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restore_logs" ADD CONSTRAINT "restore_logs_backup_log_id_fkey" FOREIGN KEY ("backup_log_id") REFERENCES "backup_logs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restore_logs" ADD CONSTRAINT "restore_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restore_logs" ADD CONSTRAINT "restore_logs_restored_by_id_fkey" FOREIGN KEY ("restored_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "revenue_logs" ADD CONSTRAINT "revenue_logs_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favorite_reports" ADD CONSTRAINT "user_favorite_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_favorite_reports" ADD CONSTRAINT "user_favorite_reports_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_view_logs" ADD CONSTRAINT "report_view_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_view_logs" ADD CONSTRAINT "report_view_logs_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_filters" ADD CONSTRAINT "report_filters_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_filters" ADD CONSTRAINT "report_filters_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_filters" ADD CONSTRAINT "report_filters_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_filters" ADD CONSTRAINT "report_filters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_dashboard_configs" ADD CONSTRAINT "user_dashboard_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_dashboard_configs" ADD CONSTRAINT "user_dashboard_configs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_achievement_logs" ADD CONSTRAINT "kpi_achievement_logs_kpi_target_id_fkey" FOREIGN KEY ("kpi_target_id") REFERENCES "kpi_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kpi_achievement_logs" ADD CONSTRAINT "kpi_achievement_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_logs" ADD CONSTRAINT "export_logs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_logs" ADD CONSTRAINT "export_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_logs" ADD CONSTRAINT "export_logs_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "export_logs" ADD CONSTRAINT "export_logs_exported_by_id_fkey" FOREIGN KEY ("exported_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "analytics_snapshots_company_id_branch_id_snapshot_type_sn_key" RENAME TO "analytics_snapshots_company_id_branch_id_snapshot_type_snap_key";
