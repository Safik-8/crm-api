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
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- AlterTable (Add new columns if table already exists)
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "registered_business_name" TEXT;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "gst_tax_number" TEXT;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "business_address" TEXT;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "industry_type" TEXT;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "business_hours" JSONB;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "default_pipeline_id" INTEGER;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "default_opportunity_stage_id" INTEGER;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "default_opportunity_win_prob" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "require_mfa" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "ip_whitelisting" JSONB;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "email_signature_template" TEXT;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "login_background_url" TEXT;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "email_template_branding" JSONB;

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
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "company_settings_company_id_key" ON "company_settings"("company_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "global_system_settings_setting_key_key" ON "global_system_settings"("setting_key");

-- AddForeignKey
ALTER TABLE "company_settings" DROP CONSTRAINT IF EXISTS "company_settings_company_id_fkey";
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_settings" DROP CONSTRAINT IF EXISTS "company_settings_default_lead_status_id_fkey";
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_default_lead_status_id_fkey" FOREIGN KEY ("default_lead_status_id") REFERENCES "lead_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "company_settings" DROP CONSTRAINT IF EXISTS "company_settings_default_pipeline_id_fkey";
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_default_pipeline_id_fkey" FOREIGN KEY ("default_pipeline_id") REFERENCES "pipelines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "company_settings" DROP CONSTRAINT IF EXISTS "company_settings_default_opportunity_stage_id_fkey";
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_default_opportunity_stage_id_fkey" FOREIGN KEY ("default_opportunity_stage_id") REFERENCES "opportunity_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "global_system_settings" DROP CONSTRAINT IF EXISTS "global_system_settings_company_id_fkey";
ALTER TABLE "global_system_settings" ADD CONSTRAINT "global_system_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
