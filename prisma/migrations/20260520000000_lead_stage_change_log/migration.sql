-- Last stage move audit fields on leads (no separate history table)
ALTER TABLE "leads" ADD COLUMN "previous_stage_id" INTEGER;
ALTER TABLE "leads" ADD COLUMN "stage_changed_by_id" INTEGER;
ALTER TABLE "leads" ADD COLUMN "stage_changed_at" TIMESTAMP(3);

CREATE INDEX "leads_previous_stage_id_idx" ON "leads"("previous_stage_id");

ALTER TABLE "leads" ADD CONSTRAINT "leads_previous_stage_id_fkey" FOREIGN KEY ("previous_stage_id") REFERENCES "stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_stage_changed_by_id_fkey" FOREIGN KEY ("stage_changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
