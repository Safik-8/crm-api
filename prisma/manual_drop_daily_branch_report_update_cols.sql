-- Manual, minimal change to match "create-once" DailyBranchReport
-- This script ONLY touches the `daily_branch_reports` table.
--
-- It removes:
-- - updated_by (and dependent FK/index via CASCADE)
-- - updated_at

ALTER TABLE "daily_branch_reports"
  DROP COLUMN IF EXISTS "updated_by" CASCADE;

ALTER TABLE "daily_branch_reports"
  DROP COLUMN IF EXISTS "updated_at" CASCADE;

