import prisma from './src/config/db.js';

async function main() {
  try {
    const roles = await prisma.role.findMany({
      where: { companyId: null },
      select: { id: true, name: true, description: true, rank: true, isSystem: true, status: true }
    });
    console.log("Successfully fetched roles:", roles);
  } catch (error) {
    console.error("Error executing role.findMany:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
