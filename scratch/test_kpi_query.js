// crm-api/scratch/test_kpi_query.js
import prisma from "../src/config/db.js";
import { getDateRangeForPeriod } from "../src/modules/salesPerformance/salesPerformance.services.js";

async function main() {
  const dateRange = getDateRangeForPeriod({ rankingPeriod: "MONTHLY" });
  console.log("Date range:", dateRange);

  const allTargets = await prisma.kpiTarget.findMany();
  console.log("All targets in DB:", allTargets);

  const targetsOverlap = await prisma.kpiTarget.findMany({
    where: {
      companyId: 1,
      employeeId: 5,
      status: "ACTIVE",
      ...(dateRange.startDate && { endDate: { gte: new Date(dateRange.startDate) } }),
      ...(dateRange.endDate && { startDate: { lte: new Date(dateRange.endDate) } }),
    }
  });

  console.log("Targets found with date overlap:", targetsOverlap);
  await prisma.$disconnect();
}

main().catch(console.error);
