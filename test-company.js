const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, companyId: true } });
  console.log('Users:', users);
  const leads = await prisma.lead.findMany({ take: 5, select: { id: true, companyId: true, assignedToId: true } });
  console.log('Leads:', leads);
}
debug().finally(() => { prisma.$disconnect() });
