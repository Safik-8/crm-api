-- CreateTable
CREATE TABLE IF NOT EXISTS "feedbacks" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'BUG',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "page_url" TEXT,
    "attachment_url" TEXT,
    "user_id" INTEGER NOT NULL,
    "company_id" INTEGER,
    "branch_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "feedbacks_status_idx" ON "feedbacks"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "feedbacks_user_id_idx" ON "feedbacks"("user_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'feedbacks_user_id_fkey'
    ) THEN
        ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'feedbacks_company_id_fkey'
    ) THEN
        ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'feedbacks_branch_id_fkey'
    ) THEN
        ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
