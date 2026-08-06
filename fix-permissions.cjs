const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPermissions() {
  const allRoles = await prisma.role.findMany({ include: { rolePermissions: true } });
  
  const roleGroups = {};
  for (const role of allRoles) {
    if (!roleGroups[role.name]) roleGroups[role.name] = [];
    roleGroups[role.name].push(role);
  }
  
  for (const name in roleGroups) {
    const roles = roleGroups[name];
    const maxPermRole = roles.reduce((prev, current) => (prev.rolePermissions.length > current.rolePermissions.length) ? prev : current);
    
    const maxPerms = maxPermRole.rolePermissions;
    if (maxPerms.length === 0) continue;
    
    for (const role of roles) {
      if (role.id === maxPermRole.id || role.rolePermissions.length === maxPerms.length) continue;
      
      console.log(`Copying ${maxPerms.length} permissions to role ${role.name} (ID: ${role.id})`);
      
      for (const perm of maxPerms) {
        await prisma.permission.create({
          data: {
            roleId: role.id,
            module: perm.module,
            canView: perm.canView,
            canCreate: perm.canCreate,
            canEdit: perm.canEdit,
            canDelete: perm.canDelete,
            canArchive: perm.canArchive,
          }
        });
      }
    }
  }
  console.log('Permissions fixed!');
}

fixPermissions().catch(console.error).finally(() => prisma.$disconnect());
