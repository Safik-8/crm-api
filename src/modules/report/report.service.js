import prisma from '../../config/db.js';
import { ForbiddenError, NotFoundError } from '../../utils/AppError.js';

// Role-based report access by business requirement: strict visibility and generation control.
const REPORT_ACCESS_BY_ROLE = {
  SUPER_ADMIN: [
    'LEAD_REPORT',
    'OPPORTUNITY_REPORT',
    'DEAL_REPORT',
    'REVENUE_REPORT',
    'CUSTOMER_REPORT',
    'TEAM_PERFORMANCE_REPORT'
  ],
  COMPANY_ADMIN: [
    'LEAD_REPORT',
    'OPPORTUNITY_REPORT',
    'DEAL_REPORT',
    'REVENUE_REPORT',
    'CUSTOMER_REPORT',
    'TEAM_PERFORMANCE_REPORT'
  ],
  BRANCH_MANAGER: [
    'LEAD_REPORT',
    'OPPORTUNITY_REPORT',
    'DEAL_REPORT',
    'REVENUE_REPORT',
    'CUSTOMER_REPORT',
    'TEAM_PERFORMANCE_REPORT'
  ],
  BDE: [
    'LEAD_REPORT',
    'OPPORTUNITY_REPORT',
    'DEAL_REPORT',
    'CUSTOMER_REPORT',
    'TEAM_PERFORMANCE_REPORT'
  ],
  ISE: [
    'LEAD_REPORT',
    'OPPORTUNITY_REPORT',
    'DEAL_REPORT',
    'CUSTOMER_REPORT',
    'TEAM_PERFORMANCE_REPORT'
  ]
};

const getAllowedReportsForRank = (rank) => {
  const r = Number(rank || 0);
  if (r >= 60) {
    return [
      'LEAD_REPORT',
      'OPPORTUNITY_REPORT',
      'DEAL_REPORT',
      'REVENUE_REPORT',
      'CUSTOMER_REPORT',
      'TEAM_PERFORMANCE_REPORT'
    ];
  }
  if (r >= 20) {
    return [
      'LEAD_REPORT',
      'OPPORTUNITY_REPORT',
      'DEAL_REPORT',
      'CUSTOMER_REPORT',
      'TEAM_PERFORMANCE_REPORT'
    ];
  }
  return [];
};

const hasReportPermission = (user) => {
  const reportPerms = user?.permissions?.REPORT;
  if (reportPerms?.canView || reportPerms?.canCreate) return true;

  const primaryRole = String(user?.primaryRole || '').toUpperCase();
  const allowed = REPORT_ACCESS_BY_ROLE[primaryRole] || getAllowedReportsForRank(user?.primaryRoleRank);
  return allowed.length > 0;
};

export const getSystemReports = (role, rank = 0, userPermissions = null) => {
  const reports = [
    {
      id: 'lead-report-sys',
      reportName: 'Leads Summary & Distribution',
      reportCode: 'LEAD_REPORT_SYS',
      reportType: 'LEAD_REPORT',
      category: 'LEAD_REPORT',
      description: 'Analyze lead volumes, qualification status, and distribution across courses/sources.',
      allowedRanks: [100, 80, 60, 40, 20],
      isSystem: true
    },
    {
      id: 'opportunity-report-sys',
      reportName: 'Opportunities Pipeline Analysis',
      reportCode: 'OPPORTUNITY_REPORT_SYS',
      reportType: 'OPPORTUNITY_REPORT',
      category: 'OPPORTUNITY_REPORT',
      description: 'Track opportunity values, stages, probability rates, and expected revenues.',
      allowedRanks: [100, 80, 60, 40],
      isSystem: true
    },
    {
      id: 'deal-report-sys',
      reportName: 'Deals & Conversions',
      reportCode: 'DEAL_REPORT_SYS',
      reportType: 'DEAL_REPORT',
      category: 'DEAL_REPORT',
      description: 'Analyze won and lost deals, deal values, and win/loss reason frequencies.',
      allowedRanks: [100, 80, 60, 40],
      isSystem: true
    },
    {
      id: 'revenue-report-sys',
      reportName: 'Revenue Breakdown & Payments',
      reportCode: 'REVENUE_REPORT_SYS',
      reportType: 'REVENUE_REPORT',
      category: 'REVENUE_REPORT',
      description: 'Analyze company or branch revenues, product performance, and payment statuses.',
      allowedRanks: [100, 80, 60],
      isSystem: true
    },
    {
      id: 'team-performance-sys',
      reportName: 'Team Conversions & KPI Metrics',
      reportCode: 'TEAM_PERFORMANCE_SYS',
      reportType: 'TEAM_PERFORMANCE_REPORT',
      category: 'TEAM_PERFORMANCE_REPORT',
      description: 'Measure employee conversion rates, assigned leads, and total closed values.',
      allowedRanks: [100, 80, 60, 40, 20],
      isSystem: true
    },
    {
      id: 'customer-report-sys',
      reportName: 'Customers Summary & Acquisition',
      reportCode: 'CUSTOMER_REPORT_SYS',
      reportType: 'CUSTOMER_REPORT',
      category: 'CUSTOMER_REPORT',
      description: 'Analyze customer records, purchased products, and values.',
      allowedRanks: [100, 80, 60, 40, 20],
      isSystem: true
    }
  ];

  const normalRole = String(role || '').toUpperCase();
  const roleRanks = { SUPER_ADMIN: 100, COMPANY_ADMIN: 80, BRANCH_MANAGER: 60, BDE: 40, ISE: 20 };
  const userRank = Number(rank || roleRanks[normalRole] || 0);

  let systemReports = reports;
  if (normalRole === 'BDE' || normalRole === 'ISE' || userRank < 60) {
    systemReports = reports.filter(r => r.reportType !== 'REVENUE_REPORT');
  }

  const reportPerms = userPermissions?.REPORT;
  if (reportPerms?.canView || reportPerms?.canCreate) {
    return systemReports;
  }

  const allowed = new Set(REPORT_ACCESS_BY_ROLE[normalRole] || getAllowedReportsForRank(userRank));

  return systemReports.filter(r => allowed.has(r.reportType) && (userRank >= 0));
};

const checkReportAccess = (user, reportType) => {
  const normalRole = String(user?.primaryRole || '').toUpperCase();
  const rank = user?.primaryRoleRank ? parseInt(user.primaryRoleRank) : 0;

  if (reportType === 'REVENUE_REPORT') {
    if (normalRole === 'BDE' || normalRole === 'ISE' || rank < 60) {
      return false;
    }
  }

  if (hasReportPermission(user)) {
    return true;
  }

  const allowed = REPORT_ACCESS_BY_ROLE[normalRole] || getAllowedReportsForRank(rank);
  return allowed.includes(reportType);
};

// Main generator engine
export const generateReportData = async (user, filters) => {
  const { reportType } = filters;
  const role = user.primaryRole;
  const rank = user.primaryRoleRank ? parseInt(user.primaryRoleRank) : 0;

  if (!checkReportAccess(user, reportType)) {
    throw new ForbiddenError(`Your role (${role}, Rank: ${rank}) is unauthorized to access or generate report of type: ${reportType}`);
  }

  // Validate granular module permissions (REPORT)
  const reportPerms = user?.permissions?.REPORT || {};
  const canCreate = reportPerms.canCreate ?? true;
  const canExport = reportPerms.canExport ?? true;

  if (!canCreate) {
    throw new ForbiddenError("You do not have permission to generate reports.");
  }

  // If requesting more than standard limit (10) or custom pagination parameters for export, validate canExport
  if ((filters.limit > 10 || filters.isExport) && !canExport) {
    throw new ForbiddenError("You do not have permission to export full report data.");
  }

  // Resolve active team ID for BDE/ISE/non-admin roles
  let activeTeamId = null;
  if (rank < 60) {
    const ledTeam = await prisma.team.findFirst({
      where: { bdeId: user.id, isDeleted: false },
      select: { id: true }
    });
    if (ledTeam) {
      activeTeamId = ledTeam.id;
    } else {
      const membership = await prisma.teamMember.findFirst({
        where: { userId: user.id, removedAt: null },
        select: { teamId: true }
      });
      if (membership) activeTeamId = membership.teamId;
    }

    // Force locking of companyId and branchId
    filters.companyId = user.companyId;
    filters.branchId = user.branchId;

    if (activeTeamId) {
      // BDE/ISE with a team
      filters.teamId = activeTeamId; // Automatically lock to their Team A
      if (filters.viewMode === 'TEAM') {
        // Allow Team View
        delete filters.employeeId;
      } else {
        // Default / Individual View
        filters.viewMode = 'INDIVIDUAL';
        filters.employeeId = user.id; // automatically locked to themselves
      }
    } else {
      // BDE/ISE without a team
      if (filters.viewMode === 'TEAM') {
        throw new ForbiddenError("Team View is unavailable for users without a team.");
      }
      filters.viewMode = 'INDIVIDUAL';
      filters.employeeId = user.id;
      delete filters.teamId;
    }
  }

  // Enforce company -> branch -> team -> user validation chain for Admin roles
  if (rank >= 60) {
    let resolvedCompanyId = user.companyId;
    if (rank >= 100) {
      resolvedCompanyId = filters.companyId ? parseInt(filters.companyId) : null;
    } else {
      // Overwrite/Force
      filters.companyId = user.companyId;
    }
    
    let resolvedBranchId = user.branchId;
    if (rank >= 80) {
      resolvedBranchId = filters.branchId ? parseInt(filters.branchId) : null;
    } else {
      // Lock to branch for Branch Manager and Sales
      resolvedBranchId = user.branchId;
      filters.branchId = user.branchId;
    }
    
    if (resolvedBranchId && resolvedCompanyId) {
      const branchExists = await prisma.branch.findFirst({
        where: { id: resolvedBranchId, companyId: resolvedCompanyId }
      });
      if (!branchExists) {
        throw new ForbiddenError("Invalid Branch scope: Branch does not belong to the selected Company.");
      }
    }
    
    if (filters.teamId) {
      const targetTeamId = parseInt(filters.teamId);
      const teamExists = await prisma.team.findFirst({
        where: { 
          id: targetTeamId, 
          companyId: resolvedCompanyId || undefined, 
          branchId: resolvedBranchId || undefined, 
          isDeleted: false 
        }
      });
      if (!teamExists) {
        throw new ForbiddenError("Invalid Team scope: Team does not belong to the selected Branch/Company.");
      }
    }
    
    if (filters.employeeId) {
      const targetUserId = parseInt(filters.employeeId);
      const userExists = await prisma.user.findFirst({
        where: { 
          id: targetUserId, 
          companyId: resolvedCompanyId || undefined, 
          branchId: resolvedBranchId || undefined 
        }
      });
      if (!userExists) {
        throw new ForbiddenError("Invalid Employee scope: Employee does not belong to the selected Branch/Company.");
      }
      
      if (filters.teamId) {
        const targetTeamId = parseInt(filters.teamId);
        const memberExists = await prisma.teamMember.findFirst({
          where: { userId: targetUserId, teamId: targetTeamId, removedAt: null }
        });
        const isBdeOwner = await prisma.team.findFirst({
          where: { id: targetTeamId, bdeId: targetUserId, isDeleted: false }
        });
        if (!memberExists && !isBdeOwner) {
          throw new ForbiddenError("Invalid Employee scope: Employee does not belong to the selected Team.");
        }
      }
    }
  }

  const resolveDateWindow = () => {
    const rawStart = filters.startDate || filters.dateRange?.startDate || new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0];
    const rawEnd = filters.endDate || filters.dateRange?.endDate || new Date().toISOString().split('T')[0];
    const startDate = rawStart ? new Date(rawStart) : new Date(new Date().setMonth(new Date().getMonth() - 1));
    const endDate = rawEnd ? new Date(rawEnd) : new Date();
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    return { startDate, endDate };
  };

  const { startDate, endDate } = resolveDateWindow();

  // Pagination parameters
  const isExport = filters.isExport === 'true' || filters.isExport === true;
  const page = parseInt(filters.page) || 1;
  const limit = isExport ? 100000 : (parseInt(filters.limit) || 10);
  const skip = isExport ? 0 : (page - 1) * limit;

  // Build base standard where clause matching roles strictly by rank
  const buildBaseWhere = () => {
    const where = {};
    
    // Company Scoping
    if (rank >= 100) {
      if (filters.companyId) where.companyId = parseInt(filters.companyId);
    } else {
      if (user.companyId) where.companyId = user.companyId;
    }

    // Branch Scoping
    if (rank >= 60 && rank < 80) {
      where.branchId = user.branchId;
    } else if (rank >= 80) {
      if (filters.branchId) where.branchId = parseInt(filters.branchId);
    } else {
      if (user.branchId) where.branchId = user.branchId;
    }

    // Date filters mapping
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }
    return where;
  };

  const resolveTargetEmployees = async () => {
    // For roles below Manager (e.g. BDE / ISE)
    if (rank < 60) {
      if (filters.viewMode === 'TEAM' && activeTeamId) {
        if (filters.employeeId) {
          return [parseInt(filters.employeeId)];
        }
        const teamMembers = await prisma.teamMember.findMany({
          where: { teamId: activeTeamId, removedAt: null },
          select: { userId: true }
        });
        const teamOwner = await prisma.team.findUnique({
          where: { id: activeTeamId },
          select: { bdeId: true }
        });
        const memberIds = teamMembers.map(tm => tm.userId);
        if (teamOwner?.bdeId) {
          memberIds.push(teamOwner.bdeId);
        }
        return Array.from(new Set(memberIds));
      }
      return [user.id];
    }

    const viewMode = filters.viewMode || 'ORGANIZATION';

    // If Organization view, ignore team/employee filters and return null (scope company/branch wide)
    if (viewMode === 'ORGANIZATION') {
      return null;
    }

    // If Individual view, load selected employee only
    if (viewMode === 'INDIVIDUAL') {
      if (filters.employeeId) {
        return [parseInt(filters.employeeId)];
      }
      return null; // Return null to fall back to all branch/company employees
    }

    // If Team view, resolve members of that team
    if (viewMode === 'TEAM') {
      if (filters.employeeId) {
        return [parseInt(filters.employeeId)];
      }
      if (filters.teamId) {
        const teamMembers = await prisma.teamMember.findMany({
          where: { teamId: parseInt(filters.teamId), removedAt: null },
          select: { userId: true }
        });
        const teamOwner = await prisma.team.findUnique({
          where: { id: parseInt(filters.teamId) },
          select: { bdeId: true }
        });
        const memberIds = teamMembers.map(tm => tm.userId);
        if (teamOwner?.bdeId) {
          memberIds.push(teamOwner.bdeId);
        }
        return Array.from(new Set(memberIds));
      }
      return null; // Return null to fall back to all branch/company teams
    }

    return null;
  };

  const sortField = filters.sortBy || 'createdAt';
  const sortOrder = filters.sortOrder || 'desc';
  const orderBy = { [sortField]: sortOrder };

  let summary = {};
  let items = [];
  let total = 0;
  let loggedRoleFilter = {};

  const targetEmployeeIds = await resolveTargetEmployees();

  // ── REPORT SPECIFIC QUERY & CALCULATION LOGIC ──
  switch (reportType) {
    case 'CUSTOMER_REPORT': {
      const where = buildBaseWhere();
      where.isDeleted = false;

      if (rank < 60) {
        if (activeTeamId) {
          where.OR = [
            { assignedOwnerId: { in: targetEmployeeIds } }
          ];
          if (filters.viewMode === 'TEAM') {
             where.OR.push({ ownerTeamId: activeTeamId, assignedOwnerId: null });
          }
        } else {
          where.assignedOwnerId = user.id;
        }
      } else if (targetEmployeeIds) {
        where.assignedOwnerId = { in: targetEmployeeIds };
      }

      if (filters.status) where.status = filters.status;
      if (filters.purchasedProductId) where.purchasedProductId = parseInt(filters.purchasedProductId);

      [total, items] = await Promise.all([
        prisma.customer.count({ where }),
        prisma.customer.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            assignedOwner: { select: { name: true } },
            purchasedProduct: { select: { name: true } },
            branch: { select: { name: true } },
            deal: { select: { dealNumber: true } }
          }
        })
      ]);

      const allCustomers = await prisma.customer.findMany({
        where,
        select: { id: true, totalRevenue: true, status: true }
      });

      const totalCustomers = allCustomers.length;
      let totalRevenue = 0;
      let activeCount = 0;
      let inactiveCount = 0;

      allCustomers.forEach(c => {
        totalRevenue += Number(c.totalRevenue) || 0;
        if (c.status === 'ACTIVE') activeCount++;
        if (c.status === 'INACTIVE') inactiveCount++;
      });

      summary = {
        totalRecords: totalCustomers,
        totalRevenue,
        activeCount,
        inactiveCount,
        statusDistribution: { 'ACTIVE': activeCount, 'INACTIVE': inactiveCount }
      };
      break;
    }

    case 'LEAD_REPORT': {
      const where = buildBaseWhere();
      
      // Scoping validation
      where.isDeleted = false;
      if (rank < 60) {
        if (activeTeamId) {
          where.OR = [
            { assignedToId: { in: targetEmployeeIds } },
            { createdById: user.id }
          ];
          if (filters.viewMode === 'TEAM') {
            where.OR.push({ teamId: activeTeamId, assignedToId: null });
          }
        } else {
          where.OR = [
            { assignedToId: user.id },
            { createdById: user.id }
          ];
        }
      } else if (targetEmployeeIds) {
        where.assignedToId = { in: targetEmployeeIds };
      }

      if (filters.statusId) where.statusId = parseInt(filters.statusId);
      if (filters.sourceId) where.sourceId = parseInt(filters.sourceId);
      if (filters.courseId) where.courseId = parseInt(filters.courseId);

      [total, items] = await Promise.all([
        prisma.lead.count({ where }),
        prisma.lead.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            status: { select: { name: true, displayColor: true } },
            source: { select: { name: true } },
            course: { select: { name: true } },
            assignedTo: { select: { name: true } }
          }
        })
      ]);

      const allLeads = await prisma.lead.findMany({
        where,
        select: { id: true, isQualified: true, status: { select: { name: true } } }
      });

      const totalLeads = allLeads.length;
      const qualifiedLeads = allLeads.filter(l => l.isQualified).length;
      const lostLeads = allLeads.filter(l => !l.isQualified && l.status?.name && ['LOST', 'CLOSED_LOST', 'NOT_INTERESTED', 'REJECTED'].includes(String(l.status.name).toUpperCase())).length;
      const statusCounts = {};
      const sourceCounts = {};

      allLeads.forEach(l => {
        const sName = l.status?.name || 'Unknown';
        statusCounts[sName] = (statusCounts[sName] || 0) + 1;

        const sourceName = l.status?.name ? 'Source' : 'Unknown';
        const sourceKey = 'Source';
        sourceCounts[sourceKey] = (sourceCounts[sourceKey] || 0) + 1;
      });

      summary = {
        totalRecords: totalLeads,
        qualifiedCount: qualifiedLeads,
        lostCount: lostLeads,
        unqualifiedCount: totalLeads - qualifiedLeads,
        conversionRate: totalLeads > 0 ? ((qualifiedLeads / totalLeads) * 100).toFixed(2) : 0,
        statusDistribution: statusCounts,
        sourceDistribution: sourceCounts
      };
      break;
    }

    case 'OPPORTUNITY_REPORT': {
      const where = buildBaseWhere();
      where.isDeleted = false;
      
      if (rank < 60) {
        if (activeTeamId) {
          where.OR = [
            { ownerId: { in: targetEmployeeIds } },
            { createdById: user.id }
          ];
          if (filters.viewMode === 'TEAM') {
            where.OR.push({ teamId: activeTeamId });
          }
        } else {
          where.OR = [
            { ownerId: user.id },
            { createdById: user.id }
          ];
        }
      } else if (targetEmployeeIds) {
        where.ownerId = { in: targetEmployeeIds };
      }

      if (filters.status) where.status = filters.status;
      if (filters.stageId) where.stageId = parseInt(filters.stageId);
      if (filters.productId) where.productId = parseInt(filters.productId);

      [total, items] = await Promise.all([
        prisma.opportunity.count({ where }),
        prisma.opportunity.findMany({
          where,
          skip,
          take: limit,
          orderBy: { expectedRevenue: 'desc' },
          include: {
            lead: { select: { name: true } },
            product: { select: { name: true } },
            stage: { select: { name: true } },
            owner: { select: { name: true } }
          }
        })
      ]);

      const allOpps = await prisma.opportunity.findMany({
        where,
        select: { id: true, expectedRevenue: true, probabilityPercentage: true, status: true, stage: { select: { name: true } } }
      });

      const totalOpps = allOpps.length;
      let totalExpectedRevenue = 0;
      let openCount = 0;
      let wonCount = 0;
      let lostCount = 0;
      const stageDistribution = {};

      allOpps.forEach(o => {
        totalExpectedRevenue += Number(o.expectedRevenue) || 0;
        if (o.status === 'OPEN') openCount++;
        if (o.status === 'WON') wonCount++;
        if (o.status === 'LOST') lostCount++;
        const sName = o.stage?.name || 'Unknown';
        stageDistribution[sName] = (stageDistribution[sName] || 0) + 1;
      });

      summary = {
        totalRecords: totalOpps,
        totalRevenue: totalExpectedRevenue,
        openCount,
        wonCount,
        lostCount,
        averageProbability: totalOpps > 0 ? (allOpps.reduce((acc, o) => acc + (Number(o.probabilityPercentage) || 0), 0) / totalOpps).toFixed(2) : 0,
        stageDistribution,
        statusDistribution: stageDistribution
      };
      break;
    }

    case 'DEAL_REPORT': {
      const where = buildBaseWhere();


      if (rank < 60) {
        if (activeTeamId) {
          where.OR = [
            { closedById: { in: targetEmployeeIds } },
            { createdById: user.id }
          ];
          if (filters.viewMode === 'TEAM') {
            where.OR.push({ opportunity: { teamId: activeTeamId } });
          }
        } else {
          where.OR = [
            { closedById: user.id },
            { createdById: user.id }
          ];
        }
      } else if (targetEmployeeIds) {
        where.closedById = { in: targetEmployeeIds };
      }

      if (filters.outcome) where.outcome = filters.outcome;

      [total, items] = await Promise.all([
        prisma.deal.count({ where }),
        prisma.deal.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            opportunity: { select: { opportunityName: true } },
            lead: { select: { name: true, email: true } },
            closedBy: { select: { name: true } },
            reason: { select: { reasonName: true } }
          }
        })
      ]);

      const allDeals = await prisma.deal.findMany({
        where,
        select: { id: true, outcome: true, finalAmount: true }
      });

      const totalDeals = allDeals.length;
      let totalAmount = 0;
      let wonCount = 0;
      let lostCount = 0;

      allDeals.forEach(d => {
        if (d.outcome === 'WON') {
          totalAmount += Number(d.finalAmount) || 0;
          wonCount++;
        } else if (d.outcome === 'LOST') {
          lostCount++;
        }
      });

      summary = {
        totalRecords: totalDeals,
        totalRevenue: totalAmount,
        wonCount,
        lostCount,
        winRate: totalDeals > 0 ? ((wonCount / totalDeals) * 100).toFixed(2) : 0,
        conversionRate: totalDeals > 0 ? ((wonCount / totalDeals) * 100).toFixed(2) : 0,
        statusDistribution: { 'WON': wonCount, 'LOST': lostCount }
      };
      break;
    }

    case 'REVENUE_REPORT': {
      const where = buildBaseWhere();
      delete where.createdAt;
      where.revenueDate = { gte: startDate, lte: endDate };

      // Resolve team/employee scoping through active member creator IDs
      if (filters.employeeId) {
        where.createdById = parseInt(filters.employeeId);
      } else if (filters.teamId) {
        const teamMembers = await prisma.teamMember.findMany({
          where: { teamId: parseInt(filters.teamId), removedAt: null },
          select: { userId: true }
        });
        const teamOwner = await prisma.team.findUnique({
          where: { id: parseInt(filters.teamId) },
          select: { bdeId: true }
        });
        const memberIds = teamMembers.map(tm => tm.userId);
        if (teamOwner?.bdeId) {
          memberIds.push(teamOwner.bdeId);
        }
        where.createdById = { in: Array.from(new Set(memberIds)) };
      } else if (targetEmployeeIds) {
        where.createdById = { in: targetEmployeeIds };
      }

      if (filters.productId) where.productId = parseInt(filters.productId);
      if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus;

      [total, items] = await Promise.all([
        prisma.revenueLog.count({ where }),
        prisma.revenueLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { revenueDate: 'desc' },
          select: {
            id: true,
            companyId: true,
            branchId: true,
            dealId: true,
            customerId: true,
            productId: true,
            revenueAmount: true,
            revenueDate: true,
            paymentStatus: true,
            notes: true,
            createdById: true,
            createdAt: true,
            deal: { select: { dealNumber: true } },
            customer: { select: { customerName: true } },
            product: { select: { name: true } },
            createdBy: { select: { name: true } }
          }
        })
      ]);

      const allRevenue = await prisma.revenueLog.findMany({
        where,
        select: { revenueAmount: true, paymentStatus: true, revenueDate: true }
      });

      let totalRevenueAmount = 0;
      let completedRevenue = 0;
      let pendingRevenue = 0;
      const paymentDistribution = {};
      const monthlyTrends = {};

      allRevenue.forEach(r => {
        const amount = Number(r.revenueAmount) || 0;
        totalRevenueAmount += amount;
        paymentDistribution[r.paymentStatus] = (paymentDistribution[r.paymentStatus] || 0) + 1;
        if (r.paymentStatus === 'COMPLETED') completedRevenue += amount;
        if (r.paymentStatus === 'PENDING') pendingRevenue += amount;
        const monthStr = r.revenueDate.toISOString().slice(0, 7);
        monthlyTrends[monthStr] = (monthlyTrends[monthStr] || 0) + amount;
      });

      summary = {
        totalRecords: allRevenue.length,
        totalRevenue: totalRevenueAmount,
        completedRevenue,
        pendingRevenue,
        statusDistribution: paymentDistribution,
        trends: monthlyTrends,
        monthlyRevenueTrend: monthlyTrends
      };
      break;
    }

    case 'TEAM_PERFORMANCE_REPORT': {
      const where = {};
      if (user.companyId && rank < 100) {
        where.companyId = user.companyId;
      }
      if (user.branchId && rank >= 60 && rank < 80) {
        where.branchId = user.branchId;
      }

      const users = await prisma.user.findMany({
        where: {
          ...where,
          status: 'ACTIVE',
          userRoles: {
            some: {
              role: {
                name: { in: ['BDE', 'ISE'] }
              }
            }
          }
        },
        select: {
          id: true,
          name: true,
          branch: { select: { name: true } },
          teamMemberships: {
            where: { removedAt: null },
            include: { team: { select: { name: true } } }
          }
        }
      });

      let targetUsers = users;
      if (rank < 60) {
        const canViewTeam = user?.permissions?.REPORT?.viewTeam || false;
        if (canViewTeam && activeTeamId) {
          targetUsers = users.filter(u =>
            u.id === user.id ||
            u.teamMemberships?.some(tm => tm.teamId === activeTeamId)
          );
        } else {
          targetUsers = users.filter(u => u.id === user.id);
        }
      } else if (filters.viewMode === 'TEAM' && filters.teamId) {
        targetUsers = users.filter(u =>
          u.teamMemberships?.some(tm => tm.teamId === parseInt(filters.teamId))
        );
      } else if (filters.viewMode === 'INDIVIDUAL' && filters.employeeId) {
        targetUsers = users.filter(u => u.id === parseInt(filters.employeeId));
      }

      const results = [];
      let grandTotalRevenue = 0;
      let grandTotalDeals = 0;

      for (const u of targetUsers) {
        const [leadsAssigned, dealsClosed, kpis] = await Promise.all([
          prisma.lead.count({
            where: {
              assignedToId: u.id,
              createdAt: { gte: startDate, lte: endDate }
            }
          }),
          prisma.deal.findMany({
            where: {
              closedById: u.id,
              outcome: 'WON',
              createdAt: { gte: startDate, lte: endDate }
            },
            select: { finalAmount: true }
          }),
          // Resilient block: KpiTarget may not have been physically migrated/applied in the DB container
          (async () => {
            try {
              return await prisma.kpiTarget.findMany({
                where: {
                  employeeId: u.id,
                  status: 'ACTIVE',
                  startDate: { gte: startDate }
                },
                select: { targetValue: true, achievedValue: true }
              });
            } catch {
              return [];
            }
          })()
        ]);

        const totalRevenue = dealsClosed.reduce((sum, d) => sum + Number(d.finalAmount), 0);
        const totalTarget = kpis.reduce((sum, k) => sum + Number(k.targetValue), 0);
        const totalAchieved = kpis.reduce((sum, k) => sum + Number(k.achievedValue), 0);
        const conversionRate = leadsAssigned > 0 ? ((dealsClosed.length / leadsAssigned) * 100).toFixed(2) : 0;

        results.push({
          id: u.id,
          employeeName: u.name,
          branchName: u.branch?.name || 'N/A',
          teamName: u.teamMemberships?.[0]?.team?.name || 'N/A',
          leadsAssigned,
          dealsClosed: dealsClosed.length,
          totalRevenue,
          targetValue: totalTarget,
          achievedValue: totalAchieved,
          conversionRate
        });

        grandTotalRevenue += totalRevenue;
        grandTotalDeals += dealsClosed.length;
      }

      results.sort((a, b) => b.totalRevenue - a.totalRevenue);
      total = results.length;
      items = results.slice(skip, skip + limit);

      summary = {
        totalRecords: total,
        totalRevenue: grandTotalRevenue,
        totalDeals: grandTotalDeals,
        averageConversionRate: total > 0 ? (results.reduce((acc, r) => acc + Number(r.conversionRate), 0) / total).toFixed(2) : 0
      };
      break;
    }

    default:
      throw new NotFoundError(`Unknown report type: ${reportType}`);
  }

  return {
    summary,
    items,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

export const saveReportConfig = async (user, data) => {
  const { filterName, reportId, reportConfig, isDefault } = data;
  if (isDefault) {
    await prisma.reportFilter.updateMany({
      where: { userId: user.id },
      data: { isDefault: false }
    });
  }
  return prisma.reportFilter.create({
    data: {
      companyId: user.companyId || 1,
      branchId: user.branchId,
      reportId: reportId ? parseInt(reportId) : null,
      userId: user.id,
      filterName,
      reportConfig,
      isDefault: isDefault || false
    }
  });
};

export const updateReportConfig = async (user, id, data) => {
  const { filterName, reportConfig, isDefault } = data;
  const configId = parseInt(id);
  const existing = await prisma.reportFilter.findFirst({
    where: { id: configId, userId: user.id }
  });
  if (!existing) {
    throw new NotFoundError('Saved report configuration not found or unauthorized');
  }
  if (isDefault) {
    await prisma.reportFilter.updateMany({
      where: { userId: user.id },
      data: { isDefault: false }
    });
  }
  return prisma.reportFilter.update({
    where: { id: configId },
    data: {
      filterName: filterName !== undefined ? filterName : existing.filterName,
      reportConfig: reportConfig !== undefined ? reportConfig : existing.reportConfig,
      isDefault: isDefault !== undefined ? isDefault : existing.isDefault
    }
  });
};

export const deleteReportConfig = async (user, id) => {
  const configId = parseInt(id);
  const existing = await prisma.reportFilter.findFirst({
    where: { id: configId, userId: user.id }
  });
  if (!existing) {
    throw new NotFoundError('Saved report configuration not found or unauthorized');
  }
  return prisma.reportFilter.delete({
    where: { id: configId }
  });
};

export const getSavedConfigsList = async (user) => {
  return prisma.reportFilter.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: 'desc' }
  });
};
