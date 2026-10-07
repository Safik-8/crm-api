// scripts/apply_lead_number.js
import prisma from '../src/config/db.js';

async function main() {
  console.log('🔄 Safely applying lead_number column and indexes to database...');

  try {
    // 1. Add column if not exists
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "lead_number" TEXT;
    `);
    console.log('✅ Added column "lead_number" to "leads" table.');

    // 2. Add indexes safely
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "leads_lead_number_key" ON "leads"("lead_number");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "leads_lead_number_idx" ON "leads"("lead_number");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "leads_company_id_lead_number_idx" ON "leads"("company_id", "lead_number");
    `);
    console.log('✅ Created indexes on "lead_number".');

    // 3. Backfill any existing leads that do not have a lead_number
    console.log('🔄 Checking for existing leads without lead_number...');
    const unnumberedLeads = await prisma.$queryRawUnsafe(`
      SELECT l.id, l.created_at, l.company_id, l.branch_id, b.code as branch_code, b.name as branch_name
      FROM "leads" l
      LEFT JOIN "branches" b ON l.branch_id = b.id
      WHERE l.lead_number IS NULL
      ORDER BY l.id ASC;
    `);

    console.log(`Found ${unnumberedLeads.length} leads to backfill.`);

    let count = 0;
    for (const lead of unnumberedLeads) {
      const d = new Date(lead.created_at || new Date());
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}${mm}${dd}`;

      let branchCode = 'HQ';
      if (lead.branch_code) {
        branchCode = lead.branch_code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || `BR${lead.branch_id || ''}`;
      } else if (lead.branch_name) {
        branchCode = lead.branch_name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || `BR${lead.branch_id || ''}`;
      } else if (lead.branch_id) {
        branchCode = `BR${lead.branch_id}`;
      }

      const seq = String(lead.id).padStart(4, '0');
      const leadNum = `LEAD-${dateStr}-${branchCode}-${seq}`;

      await prisma.$executeRawUnsafe(`
        UPDATE "leads" SET "lead_number" = $1 WHERE "id" = $2 AND "lead_number" IS NULL;
      `, leadNum, lead.id);

      count++;
    }

    console.log(`🎉 Backfill completed! Updated ${count} existing leads with unique lead numbers.`);
    console.log('✨ All migrations and backfill completed with ZERO data loss.');
  } catch (error) {
    console.error('❌ Error executing database update:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
