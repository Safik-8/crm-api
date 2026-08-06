const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
  const iseUser = await prisma.user.findFirst({
    where: { email: 'ise@stackdot.in' },
    include: {
      userRoles: {
        include: {
          role: {
            include: { rolePermissions: { include: { permission: true } } }
          }
        }
      }
    }
  });
  
  if (!iseUser) {
    console.log('ISE User not found');
    return;
  }
  
  const role = iseUser.userRoles[0].role;
  console.log('Role:', role.name);
  console.log('Permissions:', role.rolePermissions.map(rp => rp.permission.code));
}
debug().finally(() => process.exit(0));
