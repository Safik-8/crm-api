import prisma from "./src/config/db.js";

async function main() {
  // Check existing opportunity stages for company 1
  const stages = await prisma.opportunityStage.findMany({
    where: { companyId: 1 },
    orderBy: { displayOrder: 'asc' },
    select: {
      id: true,
      name: true,
      code: true,
      stageType: true,
      isSystem: true,
      displayOrder: true,
      status: true,
    }
  });

  console.log(`\n=== OPPORTUNITY STAGES FOR COMPANY 1 ===`);
  console.table(stages);

  // Check if system stages are correctly marked
  const systemStages = stages.filter(s => s.isSystem);
  const customStages = stages.filter(s => !s.isSystem);

  console.log(`\n🔒 SYSTEM STAGES (isSystem=true): ${systemStages.length}`);
  systemStages.forEach(s => console.log(`  - [${s.displayOrder}] ${s.name} (${s.code}) | type: ${s.stageType}`));

  console.log(`\n⚙️  CUSTOM STAGES (isSystem=false): ${customStages.length}`);
  customStages.forEach(s => console.log(`  - [${s.displayOrder}] ${s.name} (${s.code})`));

  // Check stageType values
  const missingStageType = stages.filter(s => !s.stageType || s.stageType === 'REGULAR');
  if (missingStageType.length > 0) {
    console.log(`\n⚠️  STAGES WITH DEFAULT/MISSING stageType:`);
    missingStageType.forEach(s => console.log(`  - ${s.name}: stageType=${s.stageType}`));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
