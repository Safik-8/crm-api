import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      userRoles: {
        include: {
          role: true
        }
      }
    }
  });
  
  users.forEach(u => {
    const roles = u.userRoles.map(r => r.role?.name).join(', ');
    console.log(`Email: ${u.email} | Role: ${roles}`);
  });
}

main().finally(() => prisma.$disconnect());
