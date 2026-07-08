-- AlterTable: add assigned_to column to leads
ALTER TABLE "leads" ADD COLUMN "assigned_to" INTEGER;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assigned_to_fkey"
  FOREIGN KEY ("assigned_to") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "leads_assigned_to_idx" ON "leads"("assigned_to");
