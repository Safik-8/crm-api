import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function inspect() {
  const leads = await prisma.lead.findMany({
    where: { companyId: 1, isDeleted: false },
    select: {
      id: true,
      name: true,
      mobile: true,
      stageId: true,
      stage: { select: { id: true, name: true, stageType: true } },
      assignedToId: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      createdById: true,
      createdBy: { select: { id: true, name: true } },
      qualificationStatus: true,
      opportunities: {
        where: { isDeleted: false },
        select: {
          id: true,
          opportunityName: true,
          status: true,
          stage: { select: { id: true, name: true } },
          createdById: true,
          createdBy: { select: { id: true, name: true, email: true } },
          ownerId: true,
          owner: { select: { id: true, name: true, email: true } }
        }
      }
    },
    orderBy: { id: 'desc' }
  });

  const opportunities = await prisma.opportunity.findMany({
    where: { companyId: 1, isDeleted: false },
    select: {
      id: true,
      opportunityName: true,
      status: true,
      stage: { select: { id: true, name: true } },
      expectedRevenue: true,
      closingDate: true,
      createdById: true,
      createdBy: { select: { id: true, name: true, email: true } },
      ownerId: true,
      owner: { select: { id: true, name: true, email: true } },
      lead: { select: { id: true, name: true, stage: { select: { name: true, stageType: true } } } }
    },
    orderBy: { id: 'desc' }
  });

  console.log("=== CURRENT ACTIVE LEADS (StackDot) ===");
  console.log(JSON.stringify(leads, null, 2));

  console.log("\n=== CURRENT ACTIVE OPPORTUNITIES (StackDot) ===");
  console.log(JSON.stringify(opportunities, null, 2));
}

inspect().catch(console.error).finally(() => prisma.$disconnect());
