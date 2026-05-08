-- Remove offday columns from daily_branch_reports
ALTER TABLE "daily_branch_reports" DROP COLUMN IF EXISTS "is_off_day";
ALTER TABLE "daily_branch_reports" DROP COLUMN IF EXISTS "off_reason";

