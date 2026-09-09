import prisma from '../src/config/db.js';

async function main() {
  const pipelines = await prisma.pipeline.findMany({
    include: {
      stages: {
        include: { stage: true },
        orderBy: { orderNo: 'asc' }
      },
      leads: {
        select: {
          id: true,
          name: true,
          stageId: true,
          pipelineId: true,
          stage: { select: { id: true, name: true, stageType: true } }
        }
      }
    }
  });

  console.log('=== ALL PIPELINES IN DATABASE ===');
  for (const p of pipelines) {
    console.log(`Pipeline ID ${p.id}: "${p.name}" (Company: ${p.companyId}, Branch: ${p.branchId})`);
    console.log(`  Stages (${p.stages.length}):`);
    p.stages.forEach(s => {
      console.log(`    - Stage ID ${s.stageId}: "${s.stage?.name}" (Type: ${s.stage?.stageType}, Order: ${s.orderNo})`);
    });
    console.log(`  Leads (${p.leads.length}):`);
    p.leads.forEach(l => {
      console.log(`    - Lead ID ${l.id} ("${l.name}") => stageId: ${l.stageId} (Stage Name: ${l.stage?.name || 'NULL / ORPHAN'})`);
    });
    console.log('--------------------------------------------------');
  }

  // Also check all stages in system
  const allStages = await prisma.stage.findMany();
  console.log(`\n=== ALL GLOBAL STAGES IN SYSTEM (${allStages.length}) ===`);
  allStages.forEach(s => {
    console.log(`  Stage ID ${s.id}: "${s.name}" (Type: ${s.stageType}, isDefault: ${s.isDefault}, isDeleted: ${s.isDeleted})`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
