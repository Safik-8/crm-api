// crm-api/scratch/check_targets.js
import prisma from "../src/config/db.js";

async function main() {
  const targets = await prisma.kpiTarget.findMany();
  console.log("Total KpiTargets in database:", targets.length);
  if (targets.length > 0) {
    console.log(targets);
  }
  await prisma.$disconnect();
}

main().catch(console.error);
