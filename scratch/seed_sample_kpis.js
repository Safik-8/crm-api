// crm-api/scratch/seed_sample_kpis.js
import prisma from "../src/config/db.js";

async function main() {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999);

  // Seed targets for Pratik Vaghela (ID: 5)
  const target1 = await prisma.kpiTarget.create({
    data: {
      companyId: 1,
      branchId: 1,
      employeeId: 5,
      kpiType: "LEAD_TARGET",
      targetValue: 10,
      achievedValue: 5,
      duration: "MONTHLY",
      startDate: startOfMonth,
      endDate: endOfMonth,
      status: "ACTIVE",
      createdById: 1
    }
  });

  const target2 = await prisma.kpiTarget.create({
    data: {
      companyId: 1,
      branchId: 1,
      employeeId: 5,
      kpiType: "REVENUE_TARGET",
      targetValue: 2000000,
      achievedValue: 1000000,
      duration: "MONTHLY",
      startDate: startOfMonth,
      endDate: endOfMonth,
      status: "ACTIVE",
      createdById: 1
    }
  });

  console.log("Successfully seeded 2 sample KPI targets for Pratik Vaghela:", target1.id, target2.id);
  await prisma.$disconnect();
}

main().catch(console.error);
