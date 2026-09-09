import prisma from '../src/config/db.js';

async function main() {
  // 1. Ensure default stages exist
  let prospect = await prisma.stage.findFirst({ where: { stageType: 'PROSPECT', isDeleted: false } });
  if (!prospect) {
    prospect = await prisma.stage.create({
      data: { name: 'Prospect', stageType: 'PROSPECT', colorCode: '#3b82f6', code: 'PROSPECT', isDefault: true, isDeleted: false }
    });
  }

  let closure = await prisma.stage.findFirst({ where: { stageType: 'CLOSURE', isDeleted: false } });
  if (!closure) {
    closure = await prisma.stage.create({
      data: { name: 'Closure', stageType: 'CLOSURE', colorCode: '#8b5cf6', code: 'CLOSURE', isDefault: true, isDeleted: false }
    });
  }

  console.log('Default Stages:', { prospectId: prospect.id, closureId: closure.id });

  // 2. Repair all pipelines with 0 stages
  const allPipelines = await prisma.pipeline.findMany({
    include: { stages: true }
  });

  for (const p of allPipelines) {
    if (p.stages.length === 0) {
      console.log(`Healing Pipeline ID ${p.id} ("${p.name}")...`);
      await prisma.pipelineStage.createMany({
        data: [
          { pipelineId: p.id, stageId: prospect.id, orderNo: 1 },
          { pipelineId: p.id, stageId: closure.id, orderNo: 2 }
        ]
      });
    }
  }

  // 3. Repair all leads with pipelineId but stageId === null or invalid stage
  const pipelinesWithStages = await prisma.pipeline.findMany({
    include: { stages: true, leads: true }
  });

  for (const p of pipelinesWithStages) {
    const validStageIds = p.stages.map(s => s.stageId);
    const firstStageId = validStageIds[0] || prospect.id;

    for (const lead of p.leads) {
      if (!lead.stageId || !validStageIds.includes(lead.stageId)) {
        console.log(`Fixing Lead ID ${lead.id} ("${lead.name}") in Pipeline ${p.id} => setting stageId to ${firstStageId}`);
        await prisma.lead.update({
          where: { id: lead.id },
          data: { stageId: firstStageId }
        });
      }
    }
  }

  console.log('\n--- AUTO-HEAL COMPLETE ---');
}

main().catch(console.error).finally(() => prisma.$disconnect());
