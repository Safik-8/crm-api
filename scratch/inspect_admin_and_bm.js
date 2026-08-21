// crm-api/scratch/inspect_admin_and_bm.js
import prisma from "../src/config/db.js";
import * as dashboardRepo from "../src/modules/dashboard/dashboard.repository.js";
import { getDateRangeForPeriod } from "../src/modules/salesPerformance/salesPerformance.services.js";

async function main() {
  const dateRange = getDateRangeForPeriod({ rankingPeriod: "MONTHLY" });

  console.log("==========================================");
  console.log("1. COMPANY ADMIN (admin@stackdot.in)");
  console.log("==========================================");
  const companyAdmin = await prisma.user.findFirst({
    where: { email: "admin@stackdot.in" },
    include: { company: true, branch: true }
  });

  if (companyAdmin) {
    console.log(`User: ${companyAdmin.name} (${companyAdmin.email})`);
    console.log(`Company: ${companyAdmin.company?.name} (ID: ${companyAdmin.companyId})`);

    const companyMetrics = await dashboardRepo.findCompanyMetrics({
      companyId: companyAdmin.companyId,
      ...dateRange
    });
    console.log("\nCompany Metrics (Monthly):");
    console.log(JSON.stringify(companyMetrics, null, 2));

    const topEmployees = await dashboardRepo.findTopEmployees({
      companyId: companyAdmin.companyId,
      limit: 5,
      ...dateRange
    });
    console.log("\nTop 5 Employees:");
    console.log(JSON.stringify(topEmployees, null, 2));

    const leadAging = await dashboardRepo.findLeadAgingBuckets({
      companyId: companyAdmin.companyId
    });
    console.log("\nCompany Lead Aging:");
    console.log(JSON.stringify(leadAging, null, 2));
  }

  console.log("\n==========================================");
  console.log("2. BRANCH MANAGER (branchmanager@stackdot.in)");
  console.log("==========================================");
  const bmUser = await prisma.user.findFirst({
    where: { email: "branchmanager@stackdot.in" },
    include: { company: true, branch: true }
  });

  if (bmUser) {
    console.log(`User: ${bmUser.name} (${bmUser.email})`);
    console.log(`Branch: ${bmUser.branch?.name} (ID: ${bmUser.branchId})`);
  }

  console.log("\n==========================================");
  console.log("3. SUPER ADMIN (superadmin@stackdot.in)");
  console.log("==========================================");
  const superAdmin = await prisma.user.findFirst({
    where: { email: "superadmin@stackdot.in" }
  });
  if (superAdmin) {
    console.log(`User: ${superAdmin.name} (${superAdmin.email})`);
    const saMetrics = await dashboardRepo.findSuperAdminMetrics({ ...dateRange });
    console.log("\nSuper Admin Metrics (Monthly):");
    console.log(JSON.stringify(saMetrics, null, 2));
  }

  await prisma.$disconnect();
}

main().catch(console.error);
