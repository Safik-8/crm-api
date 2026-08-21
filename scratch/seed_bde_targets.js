// crm-api/scratch/seed_bde_targets.js
import prisma from "../src/config/db.js";

async function main() {
  const bdeUser = await prisma.user.findFirst({
    where: { email: "bde@stackdot.in" }
  });

  if (!bdeUser) {
    console.log("bde@stackdot.in not found");
    return;
  }

  const existing = await prisma.kpiTarget.findMany({
    where: { employeeId: bdeUser.id }
  });

  if (existing.length === 0) {
    const startDate = new Date(Date.UTC(2026, 7, 1));
    const endDate   = new Date(Date.UTC(2026, 7, 31, 23, 59, 59, 999));

    await prisma.kpiTarget.createMany({
      data: [
        {
          companyId: bdeUser.companyId,
          branchId: bdeUser.branchId,
          employeeId: bdeUser.id,
          kpiType: "OPPORTUNITY",
          targetValue: 20,
          achievedValue: 13,
          duration: "MONTHLY",
          startDate,
          endDate,
          status: "ACTIVE",
          createdById: 3
        },
        {
          companyId: bdeUser.companyId,
          branchId: bdeUser.branchId,
          employeeId: bdeUser.id,
          kpiType: "REVENUE",
          targetValue: 3000000,
          achievedValue: 2420000,
          duration: "MONTHLY",
          startDate,
          endDate,
          status: "ACTIVE",
          createdById: 3
        }
      ]
    });
    console.log("Successfully seeded 2 KPI targets for bde@stackdot.in");
  } else {
    console.log(`bde@stackdot.in already has ${existing.length} targets.`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
