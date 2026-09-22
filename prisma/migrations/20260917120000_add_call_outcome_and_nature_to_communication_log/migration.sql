-- AlterTable
ALTER TABLE "communication_logs" ADD COLUMN IF NOT EXISTS "call_outcome" TEXT;
ALTER TABLE "communication_logs" ADD COLUMN IF NOT EXISTS "call_nature" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "communication_logs_call_outcome_idx" ON "communication_logs"("call_outcome");
CREATE INDEX IF NOT EXISTS "communication_logs_call_nature_idx" ON "communication_logs"("call_nature");
CREATE INDEX IF NOT EXISTS "comm_logs_company_rep_type_date_nature_idx" ON "communication_logs"("company_id", "created_by", "communication_type", "interaction_date", "call_nature");

-- Backfill legacy call logs
UPDATE "communication_logs"
SET "call_outcome" = 'RECEIVED', "call_nature" = 'COLD_CALL'
WHERE "communication_type" = 'CALL' AND "call_outcome" IS NULL;
