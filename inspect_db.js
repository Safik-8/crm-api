import prisma from './src/config/db.js';

async function main() {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: 117 }
    });
    console.log(JSON.stringify(lead, null, 2));
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
