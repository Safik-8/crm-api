import { evaluateLeadService } from './src/modules/qualification/qualification.services.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  const actor = { id: 1, companyId: 1, primaryRoleRank: 100 };
  const lead = await prisma.lead.findFirst({ where: { companyId: 1 } });
  const data = {
    budgetAvailable: true,
    interestLevel: 'HIGH',
    purchaseTimeline: 'IMMEDIATE',
    decisionMakerAvailable: true,
    productFit: true,
    status: 'QUALIFIED'
  };
  
  try {
    const result = await evaluateLeadService(lead.id, data, actor);
    console.log('SUCCESS', result);
  } catch (e) {
    console.error('ERROR OCCURRED:');
    console.error(e.stack || e);
  }
}
test().finally(() => { prisma.$disconnect(); });
