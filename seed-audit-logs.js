// BackEnd/seed-audit-logs.js
import { PrismaClient } from '@prisma/client';
import { recordAuditLog } from './src/modules/auditLog/auditLog.service.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Seeding Enterprise Security Audit Logs (OWASP & NIST Compliant)...');

  const users = await prisma.user.findMany({
    include: {
      company: true,
      branch: true,
    },
  });

  if (!users || users.length === 0) {
    console.error('❌ No target users found. Make sure baseline seed and ClassDesk seed are executed first.');
    return;
  }

  const userMap = {};
  users.forEach((u) => {
    userMap[u.email] = u;
    if (u.email.includes('admin') || u.email.includes('super')) {
      userMap['admin'] = u;
    }
  });

  const admin = userMap['classdeskadmin@classdesk.com'] || userMap['admin'] || users[0];
  const managerHO = userMap['classdeskmanager@classdesk.com'] || admin;
  const bdeHO = userMap['classdeskbde@classdesk.com'] || admin;
  const iseHO = userMap['classdeskise@classdesk.com'] || admin;

  const now = new Date();
  const hoursAgo = (h) => new Date(now.getTime() - h * 3600 * 1000);

  const sampleLogs = [
    // 1. LOCALHOST USER LOGIN (OWASP MASKING TEST)
    {
      req: {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'x-forwarded-for': '127.0.0.1',
        },
        user: { id: admin.id, companyId: admin.companyId, branchId: admin.branchId },
      },
      moduleName: 'AUTH',
      actionType: 'LOGIN',
      action: 'LOGIN_SUCCESS',
      entityType: 'USER',
      entityId: admin.id,
      recordId: admin.id,
      oldValue: null,
      newValue: { status: 'SUCCESS', password: 'SecretPassword123!', token: 'jwt_bearer_token_xyz987' },
      createdAt: hoursAgo(24),
    },

    // 2. REMOTE BDE USER LOGOUT
    {
      req: {
        headers: {
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'x-forwarded-for': '192.168.1.88, 10.0.0.1',
        },
        user: { id: bdeHO.id, companyId: bdeHO.companyId, branchId: bdeHO.branchId },
      },
      moduleName: 'AUTH',
      actionType: 'LOGOUT',
      action: 'USER_LOGOUT',
      entityType: 'USER',
      entityId: bdeHO.id,
      recordId: bdeHO.id,
      oldValue: { sessionDuration: '4 hours 12 mins' },
      newValue: { status: 'LOGGED_OUT' },
      createdAt: hoursAgo(20),
    },

    // 3. BACKGROUND SYSTEM CRON JOB (PURE SYSTEM EVENT - NO HTTP REQ)
    {
      req: null,
      isSystemCron: true,
      moduleName: 'SYSTEM',
      actionType: 'UPDATE',
      action: 'CRON_SESSION_PURGE',
      entityType: 'SESSION',
      entityId: 0,
      recordId: 0,
      oldValue: { expiredSessionsCount: 28 },
      newValue: { status: 'CLEANED' },
      createdAt: hoursAgo(18),
    },

    // 4. USER CREATION WITH MASKED CREDENTIALS
    {
      req: {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'x-real-ip': '192.168.1.45',
        },
        user: { id: admin.id, companyId: admin.companyId, branchId: admin.branchId },
      },
      moduleName: 'USER_MANAGEMENT',
      actionType: 'CREATE',
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: 102,
      recordId: 102,
      oldValue: null,
      newValue: { name: 'Rahul Sharma', email: 'rahul.s@classdesk.com', role: 'BDE', passwordHash: '$2a$10$e8w9f9...' },
      createdAt: hoursAgo(14),
    },

    // 5. LEAD CONVERSION
    {
      req: {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/121.0.0.0 Safari/537.36',
          'x-forwarded-for': '127.0.0.1',
        },
        user: { id: bdeHO.id, companyId: bdeHO.companyId, branchId: bdeHO.branchId },
      },
      moduleName: 'LEAD',
      actionType: 'CREATE',
      action: 'LEAD_CREATED',
      entityType: 'LEAD',
      entityId: 501,
      recordId: 501,
      oldValue: null,
      newValue: { title: 'Apex School EdTech Project', leadName: 'Vikram Mehta' },
      createdAt: hoursAgo(10),
    },

    // 6. AUTOMATED LEAD ROUTING (BACKGROUND ENGINE RULE)
    {
      req: null,
      isSystemCron: true,
      companyId: admin.companyId,
      branchId: admin.branchId,
      moduleName: 'LEAD',
      actionType: 'UPDATE',
      action: 'LEAD_AUTO_ROUTED',
      entityType: 'LEAD',
      entityId: 501,
      recordId: 501,
      oldValue: { ownerId: null, rule: 'ROUND_ROBIN' },
      newValue: { ownerId: bdeHO.id, ownerName: bdeHO.name },
      createdAt: hoursAgo(8),
    },

    // 7. EXPORT REVENUE REPORT
    {
      req: {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'x-forwarded-for': '192.168.1.45',
        },
        user: { id: admin.id, companyId: admin.companyId, branchId: admin.branchId },
      },
      moduleName: 'REPORT',
      actionType: 'EXPORT',
      action: 'EXPORT_REVENUE_REPORT',
      entityType: 'REPORT',
      entityId: 901,
      recordId: 901,
      oldValue: null,
      newValue: { reportType: 'REVENUE_ANALYSIS', format: 'XLSX', rows: 450 },
      createdAt: hoursAgo(2),
    },
  ];

  console.log(`📝 Recording ${sampleLogs.length} audit logs via OWASP recordAuditLog service...`);

  for (const log of sampleLogs) {
    await recordAuditLog(log);
  }

  console.log('✅ Security audit log seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding audit logs:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
