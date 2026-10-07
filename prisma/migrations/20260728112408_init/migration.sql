
ALTER TABLE "audit_logs" 
ADD COLUMN IF NOT EXISTS "branch_id" INTEGER,
ADD COLUMN IF NOT EXISTS "module_name" TEXT NOT NULL DEFAULT 'SYSTEM',
ADD COLUMN IF NOT EXISTS "action_type" TEXT NOT NULL DEFAULT 'UPDATE',
ADD COLUMN IF NOT EXISTS "record_id" INTEGER,
ADD COLUMN IF NOT EXISTS "ip_address" TEXT,
ADD COLUMN IF NOT EXISTS "browser_info" TEXT,
ADD COLUMN IF NOT EXISTS "device_info" TEXT;


-- CreateTable
CREATE TABLE IF NOT EXISTS "followups" (
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


-- CreateIndex
CREATE INDEX IF NOT EXISTS "followups_lead_id_idx" ON "followups"("lead_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "followups_company_id_idx" ON "followups"("company_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "followups_branch_id_idx" ON "followups"("branch_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "followups_assigned_to_id_idx" ON "followups"("assigned_to_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "followups_status_idx" ON "followups"("status");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "followups_scheduled_at_idx" ON "followups"("scheduled_at");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "followups_assigned_to_id_status_scheduled_at_idx" ON "followups"("assigned_to_id", "status", "scheduled_at");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "followups_company_id_assigned_to_id_status_scheduled_at_idx" ON "followups"("company_id", "assigned_to_id", "status", "scheduled_at");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "followups_company_id_completed_by_id_status_idx" ON "followups"("company_id", "completed_by_id", "status");


-- CreateTable
CREATE TABLE IF NOT EXISTS "lead_assignments" (
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


-- CreateIndex
CREATE INDEX IF NOT EXISTS "lead_assignments_lead_id_idx" ON "lead_assignments"("lead_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "lead_assignments_company_id_idx" ON "lead_assignments"("company_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "lead_assignments_branch_id_idx" ON "lead_assignments"("branch_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "lead_assignments_assigned_to_user_id_idx" ON "lead_assignments"("assigned_to_user_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "lead_assignments_assigned_to_team_id_idx" ON "lead_assignments"("assigned_to_team_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "lead_assignments_lead_id_assigned_at_idx" ON "lead_assignments"("lead_id", "assigned_at");


-- CreateTable
CREATE TABLE IF NOT EXISTS "pipeline_histories" (
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


-- CreateIndex
CREATE INDEX IF NOT EXISTS "pipeline_histories_lead_id_idx" ON "pipeline_histories"("lead_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "pipeline_histories_company_id_idx" ON "pipeline_histories"("company_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "pipeline_histories_branch_id_idx" ON "pipeline_histories"("branch_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "pipeline_histories_previous_stage_id_idx" ON "pipeline_histories"("previous_stage_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "pipeline_histories_new_stage_id_idx" ON "pipeline_histories"("new_stage_id");


-- CreateTable
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER,
    "branch_id" INTEGER,
    "module_name" TEXT NOT NULL DEFAULT 'SYSTEM',
    "action_type" TEXT NOT NULL DEFAULT 'UPDATE',
    "record_id" INTEGER,
    "entity_type" TEXT NOT NULL DEFAULT 'RECORD',
    "entity_id" INTEGER NOT NULL DEFAULT 0,
    "action" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" TEXT,
    "browser_info" TEXT,
    "device_info" TEXT,
    "performed_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_company_id_idx" ON "audit_logs"("company_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_branch_id_idx" ON "audit_logs"("branch_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_module_name_idx" ON "audit_logs"("module_name");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_action_type_idx" ON "audit_logs"("action_type");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_performed_by_id_idx" ON "audit_logs"("performed_by_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs"("created_at");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_company_id_created_at_idx" ON "audit_logs"("company_id", "created_at");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_module_name_created_at_idx" ON "audit_logs"("module_name", "created_at");


-- CreateTable
CREATE TABLE IF NOT EXISTS "communication_logs" (
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


-- CreateIndex
CREATE INDEX IF NOT EXISTS "communication_logs_lead_id_idx" ON "communication_logs"("lead_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "communication_logs_company_id_idx" ON "communication_logs"("company_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "communication_logs_branch_id_idx" ON "communication_logs"("branch_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "communication_logs_communication_type_idx" ON "communication_logs"("communication_type");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "communication_logs_interaction_date_idx" ON "communication_logs"("interaction_date");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "communication_logs_company_id_created_by_communication_type_idx" ON "communication_logs"("company_id", "created_by", "communication_type", "interaction_date");


-- CreateTable
CREATE TABLE IF NOT EXISTS "lead_activities" (
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


-- CreateIndex
CREATE INDEX IF NOT EXISTS "lead_activities_lead_id_idx" ON "lead_activities"("lead_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "lead_activities_company_id_idx" ON "lead_activities"("company_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "lead_activities_performed_at_idx" ON "lead_activities"("performed_at");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "lead_activities_activity_type_idx" ON "lead_activities"("activity_type");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "lead_activities_lead_id_performed_at_idx" ON "lead_activities"("lead_id", "performed_at");


-- CreateIndex



-- CreateTable
CREATE TABLE IF NOT EXISTS "company_settings" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "company_name" TEXT,
    "company_logo" TEXT,
    "website" TEXT,
    "time_zone" TEXT NOT NULL DEFAULT 'UTC',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "currency_symbol" TEXT NOT NULL DEFAULT '$',
    "date_format" TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
    "time_format" TEXT NOT NULL DEFAULT '24H',
    "language" TEXT NOT NULL DEFAULT 'en',
    "registered_business_name" TEXT,
    "gst_tax_number" TEXT,
    "business_address" TEXT,
    "industry_type" TEXT,
    "business_hours" JSONB,
    "default_lead_status_id" INTEGER,
    "auto_assignment_enabled" BOOLEAN NOT NULL DEFAULT false,
    "default_assignment_algorithm" TEXT NOT NULL DEFAULT 'ROUND_ROBIN',
    "default_pipeline_id" INTEGER,
    "default_opportunity_stage_id" INTEGER,
    "default_opportunity_win_prob" INTEGER NOT NULL DEFAULT 50,
    "opportunity_defaults" JSONB,
    "pipeline_defaults" JSONB,
    "default_followup_time" TEXT NOT NULL DEFAULT '09:00',
    "lead_number_format" TEXT NOT NULL DEFAULT 'LD-{YYYY}-{0000}',
    "opportunity_number_format" TEXT NOT NULL DEFAULT 'OPP-{YYYY}-{0000}',
    "deal_number_format" TEXT NOT NULL DEFAULT 'DEAL-{YYYY}-{0000}',
    "reminder_timing_minutes" INTEGER NOT NULL DEFAULT 15,
    "enable_email_notifications" BOOLEAN NOT NULL DEFAULT true,
    "enable_in_app_notifications" BOOLEAN NOT NULL DEFAULT true,
    "enable_push_notifications" BOOLEAN NOT NULL DEFAULT false,
    "daily_summary_enabled" BOOLEAN NOT NULL DEFAULT true,
    "daily_summary_time" TEXT NOT NULL DEFAULT '08:00',
    "session_timeout_minutes" INTEGER NOT NULL DEFAULT 60,
    "max_login_attempts" INTEGER NOT NULL DEFAULT 5,
    "lockout_duration_minutes" INTEGER NOT NULL DEFAULT 15,
    "password_expiry_days" INTEGER NOT NULL DEFAULT 90,
    "min_password_length" INTEGER NOT NULL DEFAULT 8,
    "require_uppercase" BOOLEAN NOT NULL DEFAULT true,
    "require_lowercase" BOOLEAN NOT NULL DEFAULT true,
    "require_number" BOOLEAN NOT NULL DEFAULT true,
    "require_special_char" BOOLEAN NOT NULL DEFAULT true,
    "prevent_password_reuse_count" INTEGER NOT NULL DEFAULT 5,
    "require_mfa" BOOLEAN NOT NULL DEFAULT false,
    "ip_whitelisting" JSONB,
    "smtp_host" TEXT,
    "smtp_port" INTEGER,
    "smtp_user" TEXT,
    "smtp_password_encrypted" TEXT,
    "smtp_sender_name" TEXT,
    "smtp_sender_email" TEXT,
    "smtp_encryption" TEXT NOT NULL DEFAULT 'TLS',
    "email_signature_template" TEXT,
    "primary_color" TEXT NOT NULL DEFAULT '#4f46e5',
    "secondary_color" TEXT NOT NULL DEFAULT '#06b6d4',
    "accent_color" TEXT NOT NULL DEFAULT '#f59e0b',
    "theme_mode" TEXT NOT NULL DEFAULT 'DARK',
    "login_background_url" TEXT,
    "custom_domain" TEXT,
    "favicon_url" TEXT,
    "email_template_branding" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "company_settings_company_id_key" ON "company_settings"("company_id");


-- CreateTable
CREATE TABLE IF NOT EXISTS "global_system_settings" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER,
    "setting_key" TEXT NOT NULL,
    "setting_value" JSONB NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "is_encrypted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_system_settings_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "global_system_settings_setting_key_key" ON "global_system_settings"("setting_key");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "global_system_settings_category_idx" ON "global_system_settings"("category");


-- CreateTable
CREATE TABLE IF NOT EXISTS "notification_event_configs" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER,
    "event_type" TEXT NOT NULL,
    "module_name" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "channels" JSONB NOT NULL DEFAULT '{"inApp":true,"email":true,"push":false}',
    "roles_to_notify" JSONB,
    "template_title" TEXT,
    "template_body" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_event_configs_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_event_configs_company_id_idx" ON "notification_event_configs"("company_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_event_configs_module_name_idx" ON "notification_event_configs"("module_name");


-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "notification_event_configs_company_id_event_type_key" ON "notification_event_configs"("company_id", "event_type");


-- CreateTable
CREATE TABLE IF NOT EXISTS "backup_logs" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER,
    "backup_name" TEXT NOT NULL,
    "backup_type" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "file_size_bytes" BIGINT,
    "checksum" TEXT,
    "is_encrypted" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "duration_seconds" INTEGER,
    "triggered_by_type" TEXT NOT NULL DEFAULT 'SYSTEM',
    "triggered_by_id" INTEGER,
    "error_message" TEXT,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "backup_logs_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE INDEX IF NOT EXISTS "backup_logs_company_id_idx" ON "backup_logs"("company_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "backup_logs_status_idx" ON "backup_logs"("status");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "backup_logs_created_at_idx" ON "backup_logs"("created_at");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "backup_logs_backup_type_idx" ON "backup_logs"("backup_type");


-- CreateTable
CREATE TABLE IF NOT EXISTS "restore_logs" (
    "id" SERIAL NOT NULL,
    "backup_log_id" INTEGER NOT NULL,
    "company_id" INTEGER,
    "restore_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "duration_seconds" INTEGER,
    "restored_by_id" INTEGER NOT NULL,
    "verification_status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restore_logs_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE INDEX IF NOT EXISTS "restore_logs_backup_log_id_idx" ON "restore_logs"("backup_log_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "restore_logs_company_id_idx" ON "restore_logs"("company_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "restore_logs_created_at_idx" ON "restore_logs"("created_at");


-- CreateTable
CREATE TABLE IF NOT EXISTS "system_health_metrics" (
    "id" SERIAL NOT NULL,
    "metric_name" TEXT NOT NULL,
    "metric_value" DECIMAL(10,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "server_node" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_health_metrics_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE INDEX IF NOT EXISTS "system_health_metrics_metric_name_recorded_at_idx" ON "system_health_metrics"("metric_name", "recorded_at");


-- CreateTable
CREATE TABLE IF NOT EXISTS "notifications" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Notification',
    "message" TEXT NOT NULL,
    "notification_type" TEXT NOT NULL,
    "module_name" TEXT NOT NULL DEFAULT 'SYSTEM',
    "related_record_id" INTEGER,
    "sender_id" INTEGER,
    "user_id" INTEGER NOT NULL,
    "company_id" INTEGER,
    "branch_id" INTEGER,
    "lead_id" INTEGER,
    "followup_id" INTEGER,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "delivery_channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "email_sent" BOOLEAN NOT NULL DEFAULT false,
    "push_sent" BOOLEAN NOT NULL DEFAULT false,
    "action_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNREAD',
    "read_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications"("user_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_sender_id_idx" ON "notifications"("sender_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_lead_id_idx" ON "notifications"("lead_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_company_id_idx" ON "notifications"("company_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_branch_id_idx" ON "notifications"("branch_id");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_followup_id_idx" ON "notifications"("followup_id");


-- CreateIndex


-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_status_idx" ON "notifications"("status");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_is_read_idx" ON "notifications"("is_read");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_priority_idx" ON "notifications"("priority");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_module_name_idx" ON "notifications"("module_name");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_created_at_idx" ON "notifications"("created_at");


-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");


