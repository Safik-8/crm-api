const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findFirst({
    where: { email: 'ise@stackdot.in' },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: true
            }
          }
        }
      }
    }
  });
  console.log(JSON.stringify(user, null, 2));
}
run().finally(() => prisma.$disconnect());
