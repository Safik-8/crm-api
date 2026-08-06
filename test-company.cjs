const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
  const superadmin = await prisma.user.findUnique({ where: { email: 'superadmin@gmail.com' }, select: { id: true, companyId: true, userRoles: { include: { role: true } } } });
  console.log('Superadmin:', JSON.stringify(superadmin, null, 2));
}
debug().finally(() => { prisma.$disconnect() });
