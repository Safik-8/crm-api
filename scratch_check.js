import prisma from "./src/config/db.js";

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      companyId: true,
      branchId: true,
      reportingManagerId: true,
      userRoles: {
        include: {
          role: true
        }
      }
    }
  });
  console.log("USERS:", JSON.stringify(users, null, 2));

  const jane = await prisma.lead.findFirst({
    where: { name: { contains: "Jane Smith", mode: "insensitive" } },
    include: {
      assignedTo: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } }
    }
  });
  console.log("JANE SMITH LEAD:", JSON.stringify(jane, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
