// crm-api/scratch/inspect_bm.js
import prisma from "../src/config/db.js";
import * as dashboardRepo from "../src/modules/dashboard/dashboard.repository.js";
import { getDateRangeForPeriod } from "../src/modules/salesPerformance/salesPerformance.services.js";

async function main() {
  const bmUser = await prisma.user.findFirst({
    where: { email: "branchmanager@stackdot.in" },
    include: {
      company: true,
      branch: true,
      userRoles: {
        include: {
          role: true
        }
      }
    }
  });

  if (!bmUser) {
    console.log("Branch manager user not found!");
    return;
  }

  console.log("==========================================");
  console.log(`Branch Manager: ${bmUser.name} (${bmUser.email})`);
  console.log(`Company: ${bmUser.company?.name} (ID: ${bmUser.companyId})`);
  console.log(`Branch: ${bmUser.branch?.name} (ID: ${bmUser.branchId})`);
  console.log(`Role: ${bmUser.userRoles?.[0]?.role?.name}`);
  console.log("==========================================");

  const dateRange = getDateRangeForPeriod({ rankingPeriod: "MONTHLY" });
  const metrics = await dashboardRepo.findBranchMetrics({
    companyId: bmUser.companyId,
    branchId: bmUser.branchId,
    ...dateRange
  });

  console.log("\n--- Branch Metrics (Monthly) ---");
  console.log(JSON.stringify(metrics, null, 2));

  // Check branch users (BDEs, ISEs)
  const branchUsers = await prisma.user.findMany({
    where: {
      branchId: bmUser.branchId,
      status: "ACTIVE"
    },
    include: {
      userRoles: {
        include: {
          role: true
        }
      }
    }
  });
  console.log(`\n--- Active Branch Staff: ${branchUsers.length} users ---`);
  branchUsers.forEach(u => {
    console.log(`- ${u.name} (${u.email}) : ${u.userRoles.map(r => r.role.name).join(', ')}`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
