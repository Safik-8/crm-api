-- Drop old unique constraint (branch_id, report_date)
DROP INDEX IF EXISTS "daily_branch_reports_branch_id_report_date_key";

-- New unique constraint: (branch_id, report_date, created_by)
CREATE UNIQUE INDEX "daily_branch_reports_branch_id_report_date_created_by_key"
ON "daily_branch_reports"("branch_id", "report_date", "created_by");

-- Helpful index for queries by user
CREATE INDEX IF NOT EXISTS "daily_branch_reports_created_by_idx"
ON "daily_branch_reports"("created_by");

