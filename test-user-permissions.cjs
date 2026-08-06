const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.userRole.findMany({ include: { user: true, role: { include: { rolePermissions: true } } } }).then(ur => {
  ur.forEach(u => console.log(u.user.email, u.role.name, 'Permissions:', u.role.rolePermissions.length));
}).catch(console.error).finally(() => prisma.$disconnect());
