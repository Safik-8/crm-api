const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.role.findMany({ include: { rolePermissions: true } }).then(roles => {
  roles.forEach(r => console.log(r.name, r.rolePermissions.length));
}).catch(console.error).finally(() => prisma.$disconnect());
