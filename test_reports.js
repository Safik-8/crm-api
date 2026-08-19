import prisma from './src/config/db.js';
import { generateReportData } from './src/modules/report/report.service.js';

async function runTests() {
  console.log('=== STARTING ROLE-BASED REPORT VALIDATION ===');

  // Load test users from StackDot
  const companyAdmin = await prisma.user.findFirst({
    where: { email: 'admin@stackdot.in' },
    include: { userRoles: { include: { role: true } } }
  });
  const branchManager = await prisma.user.findFirst({
    where: { email: 'manager@stackdot.in' },
    include: { userRoles: { include: { role: true } } }
  });
  const bde = await prisma.user.findFirst({
    where: { email: 'bde@stackdot.in' },
    include: { userRoles: { include: { role: true } } }
  });
  const ise = await prisma.user.findFirst({
    where: { email: 'ise@stackdot.in' },
    include: { userRoles: { include: { role: true } } }
  });

  const users = [
    { name: 'Company Admin', user: companyAdmin },
    { name: 'Branch Manager', user: branchManager },
    { name: 'BDE (Sales)', user: bde },
    { name: 'ISE (Sales)', user: ise }
  ];

  const reports = [
    'LEAD_REPORT',
    'OPPORTUNITY_REPORT',
    'DEAL_REPORT',
    'REVENUE_REPORT',
    'CUSTOMER_REPORT',
    'TEAM_PERFORMANCE_REPORT'
  ];

  for (const { name, user } of users) {
    if (!user) {
      console.error(`User not found: ${name}`);
      continue;
    }

    // Attach computed role features to match auth middleware
    const primaryUR = user.userRoles?.find(ur => ur.isPrimary) || user.userRoles?.[0];
    user.primaryRole = primaryUR?.role?.name || 'MEMBER';
    user.primaryRoleRank = primaryUR?.role?.rank || 0;

    console.log(`\nTesting User: ${name} (Email: ${user.email}, Role: ${user.primaryRole}, Rank: ${user.primaryRoleRank})`);

    for (const reportType of reports) {
      // Skip revenue reports for BDE/ISE (which are unauthorized)
      if (reportType === 'REVENUE_REPORT' && user.primaryRoleRank < 60) {
        console.log(`  - ${reportType}: [Expected Blocked]`);
        continue;
      }

      try {
        const result = await generateReportData(user, {
          reportType,
          dateRange: {
            startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0]
          },
          page: 1,
          limit: 10
        });
        console.log(`  - ${reportType}: SUCCESS (Count: ${result.pagination.total})`);
      } catch (err) {
        console.error(`  - ${reportType}: FAILED -> ${err.message}`);
      }
    }
  }

  console.log('\n=== VALIDATION COMPLETED ===');
}

runTests()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
