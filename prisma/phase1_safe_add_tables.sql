-- Phase 1 safe additive sync (NO DROPS)
-- Creates: stages, pipelines, pipeline_stages, leads, lead_comments

CREATE TABLE IF NOT EXISTS "stages" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "created_by" INTEGER NOT NULL,
  "updated_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stages_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  CREATE UNIQUE INDEX "stages_name_key" ON "stages"("name");
EXCEPTION WHEN duplicate_table THEN
  -- ignore
END $$;

CREATE TABLE IF NOT EXISTS "pipelines" (
  "id" SERIAL NOT NULL,
  "branch_id" INTEGER NOT NULL,
  "company_id" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "created_by" INTEGER NOT NULL,
  "updated_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  CREATE INDEX "pipelines_branch_id_idx" ON "pipelines"("branch_id");
EXCEPTION WHEN duplicate_table THEN
END $$;

DO $$
BEGIN
  CREATE INDEX "pipelines_company_id_idx" ON "pipelines"("company_id");
EXCEPTION WHEN duplicate_table THEN
END $$;

DO $$
BEGIN
  ALTER TABLE "pipelines"
    ADD CONSTRAINT "pipelines_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
END $$;

DO $$
BEGIN
  ALTER TABLE "pipelines"
    ADD CONSTRAINT "pipelines_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
END $$;

CREATE TABLE IF NOT EXISTS "pipeline_stages" (
  "id" SERIAL NOT NULL,
  "pipeline_id" INTEGER NOT NULL,
  "stage_id" INTEGER NOT NULL,
  "order_no" INTEGER NOT NULL,
  CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  CREATE INDEX "pipeline_stages_pipeline_id_idx" ON "pipeline_stages"("pipeline_id");
EXCEPTION WHEN duplicate_table THEN
END $$;

DO $$
BEGIN
  CREATE UNIQUE INDEX "pipeline_stages_pipeline_id_stage_id_key" ON "pipeline_stages"("pipeline_id", "stage_id");
EXCEPTION WHEN duplicate_table THEN
END $$;

DO $$
BEGIN
  ALTER TABLE "pipeline_stages"
    ADD CONSTRAINT "pipeline_stages_pipeline_id_fkey"
    FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
END $$;

DO $$
BEGIN
  ALTER TABLE "pipeline_stages"
    ADD CONSTRAINT "pipeline_stages_stage_id_fkey"
    FOREIGN KEY ("stage_id") REFERENCES "stages"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
END $$;

CREATE TABLE IF NOT EXISTS "leads" (
  "id" SERIAL NOT NULL,
  "pipeline_id" INTEGER NOT NULL,
  "stage_id" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "mobile" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "interested_for" TEXT,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "created_by" INTEGER NOT NULL,
  "updated_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  CREATE INDEX "leads_pipeline_id_idx" ON "leads"("pipeline_id");
EXCEPTION WHEN duplicate_table THEN
END $$;

DO $$
BEGIN
  CREATE INDEX "leads_stage_id_idx" ON "leads"("stage_id");
EXCEPTION WHEN duplicate_table THEN
END $$;

DO $$
BEGIN
  ALTER TABLE "leads"
    ADD CONSTRAINT "leads_pipeline_id_fkey"
    FOREIGN KEY ("pipeline_id") REFERENCES "pipelines"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
END $$;

DO $$
BEGIN
  ALTER TABLE "leads"
    ADD CONSTRAINT "leads_stage_id_fkey"
    FOREIGN KEY ("stage_id") REFERENCES "stages"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
END $$;

DO $$
BEGIN
  ALTER TABLE "leads"
    ADD CONSTRAINT "leads_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
END $$;

CREATE TABLE IF NOT EXISTS "lead_comments" (
  "id" SERIAL NOT NULL,
  "lead_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "comment" TEXT NOT NULL,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "created_by" INTEGER NOT NULL,
  "updated_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "lead_comments_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  CREATE INDEX "lead_comments_lead_id_idx" ON "lead_comments"("lead_id");
EXCEPTION WHEN duplicate_table THEN
END $$;

DO $$
BEGIN
  ALTER TABLE "lead_comments"
    ADD CONSTRAINT "lead_comments_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "leads"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
END $$;

DO $$
BEGIN
  ALTER TABLE "lead_comments"
    ADD CONSTRAINT "lead_comments_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN
END $$;

