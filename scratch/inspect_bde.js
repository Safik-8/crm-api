// crm-api/scratch/inspect_bde.js
import prisma from "../src/config/db.js";
import * as dashboardRepo from "../src/modules/dashboard/dashboard.repository.js";
import { getDateRangeForPeriod } from "../src/modules/salesPerformance/salesPerformance.services.js";

async function main() {
  const bdeUsers = await prisma.user.findMany({
    where: {
      userRoles: {
        some: {
          role: {
            name: "BDE"
          }
        }
      }
    },
    include: {
      userRoles: {
        include: {
          role: true
        }
      },
      company: {
        select: { id: true, name: true }
      },
      branch: {
        select: { id: true, name: true }
      }
    }
  });

  console.log(`Found ${bdeUsers.length} BDE users in database:\n`);

  for (const u of bdeUsers) {
    console.log(`----------------------------------------`);
    console.log(`User ID: ${u.id}`);
    console.log(`Name: ${u.name}`);
    console.log(`Email: ${u.email}`);
    console.log(`Company: ${u.company?.name} (ID: ${u.companyId})`);
    console.log(`Branch: ${u.branch?.name} (ID: ${u.branchId})`);

    const dateRange = getDateRangeForPeriod({ rankingPeriod: "MONTHLY" });
    const metrics = await dashboardRepo.findPersonalMetrics({
      companyId: u.companyId,
      employeeId: u.id,
      ...dateRange
    });

    const aging = await dashboardRepo.findLeadAgingBuckets({
      companyId: u.companyId,
      branchId: u.branchId,
      employeeId: u.id
    });

    const kpiTargets = await dashboardRepo.findKpiTargets({
      companyId: u.companyId,
      branchId: u.branchId,
      employeeId: u.id,
      ...dateRange
    });

    console.log("\n--- Expected Dashboard Metrics (Monthly) ---");
    console.log(JSON.stringify(metrics, null, 2));
    console.log("\n--- Lead Aging Buckets ---");
    console.log(JSON.stringify(aging, null, 2));
    console.log(`\n--- Active KPI Targets: ${kpiTargets.length} items ---`);
    if (kpiTargets.length > 0) {
      console.log(kpiTargets);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
