-- CreateTable
CREATE TABLE "daily_branch_reports" (
    "id" SERIAL NOT NULL,
    "branch_id" INTEGER NOT NULL,
    "report_date" TIMESTAMP(3) NOT NULL,
    "calls_received" INTEGER NOT NULL DEFAULT 0,
    "qualified_leads" INTEGER NOT NULL DEFAULT 0,
    "counselling_done" INTEGER NOT NULL DEFAULT 0,
    "counselling_booked" INTEGER NOT NULL DEFAULT 0,
    "office_visits" INTEGER NOT NULL DEFAULT 0,
    "closures" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "followups_done" INTEGER NOT NULL DEFAULT 0,
    "pending_followups" INTEGER NOT NULL DEFAULT 0,
    "seminar_tasks" INTEGER NOT NULL DEFAULT 0,
    "joining_formalities" INTEGER NOT NULL DEFAULT 0,
    "is_off_day" BOOLEAN NOT NULL DEFAULT false,
    "off_reason" TEXT,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_by" INTEGER NOT NULL,
    "updated_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_branch_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_branch_reports_branch_id_idx" ON "daily_branch_reports"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_branch_reports_branch_id_report_date_key" ON "daily_branch_reports"("branch_id", "report_date");

-- AddForeignKey
ALTER TABLE "daily_branch_reports" ADD CONSTRAINT "daily_branch_reports_branch_id_fkey"
FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_branch_reports" ADD CONSTRAINT "daily_branch_reports_created_by_fkey"
FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_branch_reports" ADD CONSTRAINT "daily_branch_reports_updated_by_fkey"
FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

