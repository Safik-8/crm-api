import prisma from "./src/config/db.js";

async function main() {
  console.log("=== FIXING OPPORTUNITY STAGES FOR COMPANY 1 ===\n");

  // Step 1: Fix Qualification — mark as SYSTEM + ENTRY type
  const q = await prisma.opportunityStage.update({
    where: { id: 1 },
    data: { isSystem: true, stageType: 'ENTRY', displayOrder: 1 }
  });
  console.log(`✅ Fixed: ${q.name} → isSystem=true, stageType=ENTRY`);

  // Step 2: Add missing WON, LOST, CANCELLED system stages
  const systemStagesToAdd = [
    {
      companyId: 1,
      name: 'Won',
      code: 'WON',
      stageType: 'CLOSED_WON',
      isSystem: true,
      displayOrder: 98,
      defaultProbabilityPct: 100,
      colorCode: '#16a34a',
      status: 'ACTIVE',
    },
    {
      companyId: 1,
      name: 'Lost',
      code: 'LOST',
      stageType: 'CLOSED_LOST',
      isSystem: true,
      displayOrder: 99,
      defaultProbabilityPct: 0,
      colorCode: '#dc2626',
      status: 'ACTIVE',
    },
    {
      companyId: 1,
      name: 'Cancelled',
      code: 'CANCELLED',
      stageType: 'CLOSED_CANCELLED',
      isSystem: true,
      displayOrder: 100,
      defaultProbabilityPct: 0,
      colorCode: '#6b7280',
      status: 'ACTIVE',
    },
  ];

  for (const stage of systemStagesToAdd) {
    // Check if already exists
    const existing = await prisma.opportunityStage.findFirst({
      where: { companyId: 1, code: stage.code }
    });

    if (existing) {
      // Update to ensure correct flags
      const updated = await prisma.opportunityStage.update({
        where: { id: existing.id },
        data: {
          isSystem: stage.isSystem,
          stageType: stage.stageType,
          displayOrder: stage.displayOrder,
          defaultProbabilityPct: stage.defaultProbabilityPct,
          colorCode: stage.colorCode,
        }
      });
      console.log(`🔄 Updated existing: ${updated.name} → isSystem=true, stageType=${stage.stageType}`);
    } else {
      // Create
      const created = await prisma.opportunityStage.create({ data: stage });
      console.log(`➕ Created: ${created.name} → isSystem=true, stageType=${stage.stageType}`);
    }
  }

  // Step 3: Verify final state
  const allStages = await prisma.opportunityStage.findMany({
    where: { companyId: 1 },
    orderBy: { displayOrder: 'asc' },
    select: { id: true, name: true, code: true, stageType: true, isSystem: true, displayOrder: true }
  });

  console.log("\n=== FINAL STAGE STATE ===");
  console.table(allStages);
}

main().catch(console.error).finally(() => prisma.$disconnect());
