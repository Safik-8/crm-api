-- CreateTable
CREATE TABLE IF NOT EXISTS "reports" (
  "id" SERIAL NOT NULL,
  "company_id" INTEGER,
  "report_name" TEXT NOT NULL,
  "report_code" TEXT NOT NULL,
  "report_type" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT,
  "allowed_roles" JSONB,
  "is_system" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_by_id" INTEGER,
  "updated_by_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "reports_report_code_key" ON "reports"("report_code");

-- CreateTable
CREATE TABLE IF NOT EXISTS "export_logs" (
  "id" SERIAL NOT NULL,
  "company_id" INTEGER NOT NULL,
  "branch_id" INTEGER,
  "report_id" INTEGER,
  "report_name" TEXT NOT NULL,
  "export_type" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "filters_used" JSONB,
  "exported_by_id" INTEGER NOT NULL,
  "exported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "export_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "report_filters" (
  "id" SERIAL NOT NULL,
  "company_id" INTEGER NOT NULL,
  "branch_id" INTEGER,
  "report_id" INTEGER,
  "user_id" INTEGER NOT NULL,
  "filter_name" TEXT NOT NULL,
  "report_config" JSONB NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "report_filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "dashboard_widgets" (
  "id" SERIAL NOT NULL,
  "company_id" INTEGER,
  "widget_name" TEXT NOT NULL,
  "widget_code" TEXT NOT NULL,
  "widget_type" TEXT NOT NULL,
  "role_access" JSONB NOT NULL,
  "display_order" INTEGER NOT NULL DEFAULT 0,
  "refresh_interval" INTEGER NOT NULL DEFAULT 300,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dashboard_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_dashboard_configs" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "company_id" INTEGER NOT NULL,
  "layout_config" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "user_dashboard_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "user_dashboard_configs_user_id_key" ON "user_dashboard_configs"("user_id");

-- CreateTable
CREATE TABLE IF NOT EXISTS "kpi_targets" (
  "id" SERIAL NOT NULL,
  "company_id" INTEGER NOT NULL,
  "branch_id" INTEGER,
  "team_id" INTEGER,
  "employee_id" INTEGER,
  "kpi_type" TEXT NOT NULL,
  "target_value" DECIMAL(12,2) NOT NULL,
  "achieved_value" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  "duration" TEXT NOT NULL DEFAULT 'MONTHLY',
  "start_date" TIMESTAMP(3) NOT NULL,
  "end_date" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "created_by_id" INTEGER NOT NULL,
  "updated_by_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "kpi_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "kpi_achievement_logs" (
  "id" SERIAL NOT NULL,
  "kpi_target_id" INTEGER NOT NULL,
  "company_id" INTEGER NOT NULL,
  "achieved_value" DECIMAL(12,2) NOT NULL,
  "source_entity_type" TEXT,
  "source_entity_id" INTEGER,
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kpi_achievement_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "analytics_snapshots" (
  "id" SERIAL NOT NULL,
  "company_id" INTEGER NOT NULL,
  "branch_id" INTEGER NOT NULL DEFAULT 0,
  "snapshot_type" TEXT NOT NULL,
  "snapshot_date" TIMESTAMP(3) NOT NULL,
  "snapshot_data" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "analytics_snapshots_company_id_branch_id_snapshot_type_sn_key" ON "analytics_snapshots"("company_id", "branch_id", "snapshot_type", "snapshot_date");

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_favorite_reports" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "report_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_favorite_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "report_view_logs" (
  "id" SERIAL NOT NULL,
  "user_id" INTEGER NOT NULL,
  "report_id" INTEGER NOT NULL,
  "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "report_view_logs_pkey" PRIMARY KEY ("id")
);
