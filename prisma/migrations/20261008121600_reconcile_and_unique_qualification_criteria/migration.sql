-- Step 1: Deduplicate existing rows in company_qualification_criteria
-- Keep the record with the lowest id for each (company_id, key) pair
DELETE FROM "company_qualification_criteria"
WHERE id NOT IN (
    SELECT MIN(id)
    FROM "company_qualification_criteria"
    GROUP BY "company_id", "key"
);

-- Step 2: Create composite unique index on (company_id, key)
CREATE UNIQUE INDEX IF NOT EXISTS "company_qualification_criteria_company_id_key_key" 
ON "company_qualification_criteria"("company_id", "key");
