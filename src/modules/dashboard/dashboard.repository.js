// crm-api/src/modules/dashboard/dashboard.repository.js
import prisma from "../../config/db.js";

function makeDateFilter(startDate, endDate) {
  if (!startDate || !endDate) return {};
  return { gte: new Date(startDate), lte: new Date(endDate) };
}

// GLOBAL — Super Admin
export async function findGlobalMetrics({ startDate, endDate } = {}) {
  const dateFilter = makeDateFilter(startDate, endDate);
  const [
    totalCompanies, totalBranches, totalUsers, totalLeads,
    qualifiedLeads, activeOpportunities, dealsWonAgg, activeCustomers, followupsToday,
  ] = await Promise.all([
    prisma.company.count({ where: { status: "ACTIVE" } }),
    prisma.branch.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.lead.count({ where: { isDeleted: false, ...(startDate && { createdAt: dateFilter }) } }),
    prisma.lead.count({ where: { isQualified: true, isDeleted: false } }),
    prisma.opportunity.count({ where: { isDeleted: false, status: { notIn: ["WON","LOST","CANCELLED"] } } }),
    prisma.deal.aggregate({ where: { outcome: "WON", ...(startDate && { closingDate: dateFilter }) }, _sum: { finalAmount: true }, _count: { id: true } }),
    prisma.customer.count({ where: { isDeleted: false } }),
    prisma.followup.count({ where: { status: "PENDING", scheduledAt: { gte: new Date(new Date().setHours(0,0,0,0)), lte: new Date(new Date().setHours(23,59,59,999)) } } }),
  ]);

  const rawTopBranches = await prisma.deal.groupBy({
    by: ["branchId"],
    where: { outcome: "WON", ...(startDate && { closingDate: dateFilter }) },
    _sum: { finalAmount: true },
    _count: { id: true },
    orderBy: { _sum: { finalAmount: "desc" } },
    take: 5,
  });

  // Enrich with branch names
  const branchIds = rawTopBranches.map((b) => b.branchId).filter(Boolean);
  const branches = branchIds.length > 0
    ? await prisma.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } })
    : [];
  const branchNameMap = Object.fromEntries(branches.map((b) => [b.id, b.name]));

  const topBranches = rawTopBranches.map((b) => ({
    ...b,
    branchName: branchNameMap[b.branchId] || `Branch ${b.branchId || 'Unknown'}`,
  }));

  const conversionRate = totalLeads > 0 ? +((dealsWonAgg._count.id / totalLeads) * 100).toFixed(2) : 0;
  return {
    totalCompanies, totalBranches, totalUsers, totalLeads,
    qualifiedLeads, activeOpportunities, activeCustomers, followupsToday,
    dealsWon: dealsWonAgg._count.id || 0,
    monthlyRevenue: Number(dealsWonAgg._sum.finalAmount || 0),
    conversionRate,
    topBranches,
  };
}

// COMPANY — Company Admin
export async function findCompanyMetrics({ companyId, startDate, endDate } = {}) {
  const w = { companyId };
  const dateFilter = makeDateFilter(startDate, endDate);
  const [
    totalBranches, totalUsers, totalLeads, qualifiedLeads,
    activeOpportunities, dealsWonAgg, activeCustomers, followupsToday,
  ] = await Promise.all([
    prisma.branch.count({ where: { ...w, status: "ACTIVE" } }),
    prisma.user.count({ where: { ...w, status: "ACTIVE" } }),
    prisma.lead.count({ where: { ...w, isDeleted: false, ...(startDate && { createdAt: dateFilter }) } }),
    prisma.lead.count({ where: { ...w, isQualified: true, isDeleted: false } }),
    prisma.opportunity.count({ where: { ...w, isDeleted: false, status: { notIn: ["WON","LOST","CANCELLED"] } } }),
    prisma.deal.aggregate({ where: { ...w, outcome: "WON", ...(startDate && { closingDate: dateFilter }) }, _sum: { finalAmount: true }, _count: { id: true } }),
    prisma.customer.count({ where: { ...w, isDeleted: false } }),
    prisma.followup.count({ where: { ...w, status: "PENDING", scheduledAt: { gte: new Date(new Date().setHours(0,0,0,0)), lte: new Date(new Date().setHours(23,59,59,999)) } } }),
  ]);

  const rawBranchRankings = await prisma.deal.groupBy({
    by: ["branchId"],
    where: { ...w, outcome: "WON", ...(startDate && { closingDate: dateFilter }) },
    _sum: { finalAmount: true },
    _count: { id: true },
    orderBy: { _sum: { finalAmount: "desc" } },
    take: 5,
  });

  // Enrich with branch names
  const branchIds = rawBranchRankings.map((b) => b.branchId).filter(Boolean);
  const branches = branchIds.length > 0
    ? await prisma.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } })
    : [];
  const branchNameMap = Object.fromEntries(branches.map((b) => [b.id, b.name]));

  const branchRankings = rawBranchRankings.map((b) => ({
    ...b,
    branchName: branchNameMap[b.branchId] || `Branch ${b.branchId || 'Unknown'}`,
  }));

  const conversionRate = totalLeads > 0 ? +((dealsWonAgg._count.id / totalLeads) * 100).toFixed(2) : 0;
  return {
    totalBranches, totalUsers, totalLeads, qualifiedLeads,
    activeOpportunities, activeCustomers, followupsToday,
    dealsWon: dealsWonAgg._count.id || 0,
    monthlyRevenue: Number(dealsWonAgg._sum.finalAmount || 0),
    conversionRate,
    branchRankings,
  };
}

// BRANCH — Branch Manager
export async function findBranchMetrics({ companyId, branchId, startDate, endDate } = {}) {
  const w = { companyId, branchId };
  const dateFilter = makeDateFilter(startDate, endDate);
  const [
    totalLeads, qualifiedLeads, activeOpportunities, dealsWonAgg,
    activeCustomers, followupsToday, bdeCount, iseCount, rawBranchStaff,
  ] = await Promise.all([
    prisma.lead.count({ where: { ...w, isDeleted: false, ...(startDate && { createdAt: dateFilter }) } }),
    prisma.lead.count({ where: { ...w, isQualified: true, isDeleted: false } }),
    prisma.opportunity.count({ where: { ...w, isDeleted: false, status: { notIn: ["WON","LOST","CANCELLED"] } } }),
    prisma.deal.aggregate({ where: { ...w, outcome: "WON", ...(startDate && { closingDate: dateFilter }) }, _sum: { finalAmount: true }, _count: { id: true } }),
    prisma.customer.count({ where: { ...w, isDeleted: false } }),
    prisma.followup.count({ where: { ...w, status: "PENDING", scheduledAt: { gte: new Date(new Date().setHours(0,0,0,0)), lte: new Date(new Date().setHours(23,59,59,999)) } } }),
    prisma.user.count({ where: { ...w, status: "ACTIVE", userRoles: { some: { role: { name: "BDE" } } } } }),
    prisma.user.count({ where: { ...w, status: "ACTIVE", userRoles: { some: { role: { name: "ISE" } } } } }),
    prisma.user.findMany({
      where: { ...w, status: "ACTIVE", userRoles: { some: { role: { name: { in: ["BDE", "ISE"] } } } } },
      select: {
        id: true,
        name: true,
        email: true,
        userRoles: { select: { role: { select: { name: true } } } },
        ownedTeams: { where: { isDeleted: false }, select: { name: true } },
        teamMemberships: { where: { removedAt: null, team: { isDeleted: false } }, select: { team: { select: { name: true } } } },
        assignedLeads: { where: { isDeleted: false, ...(startDate && { createdAt: dateFilter }) }, select: { id: true } },
        closedDeals: { where: { outcome: "WON", ...(startDate && { closingDate: dateFilter }) }, select: { id: true, finalAmount: true } },
      },
    }),
  ]);

  const teamPerformance = (rawBranchStaff || []).map((u) => ({
    userId: u.id,
    name: u.name,
    email: u.email,
    role: u.userRoles?.[0]?.role?.name || 'Representative',
    teamName: u.ownedTeams?.[0]?.name || u.teamMemberships?.[0]?.team?.name || null,
    leadsCount: u.assignedLeads?.length || 0,
    wonDealsCount: u.closedDeals?.length || 0,
    revenue: (u.closedDeals || []).reduce((sum, d) => sum + Number(d.finalAmount || 0), 0),
  }));

  const conversionRate = totalLeads > 0 ? +((dealsWonAgg._count.id / totalLeads) * 100).toFixed(2) : 0;
  return {
    totalLeads, qualifiedLeads, activeOpportunities, activeCustomers,
    followupsToday, bdeCount, iseCount,
    wonDeals: dealsWonAgg._count.id || 0,
    revenue: Number(dealsWonAgg._sum.finalAmount || 0),
    conversionRate,
    teamPerformance,
  };
}

// PERSONAL — BDE / ISE
export async function findPersonalMetrics({ companyId, employeeId, startDate, endDate } = {}) {
  const w = { companyId, assignedToId: employeeId };
  const dateFilter = makeDateFilter(startDate, endDate);
  const [
    assignedLeads, qualifiedLeads, followupsToday, pendingFollowups,
    activeOpportunities, dealsWonAgg, callsCompletedToday,
  ] = await Promise.all([
    prisma.lead.count({ where: { ...w, isDeleted: false, ...(startDate && { createdAt: dateFilter }) } }),
    prisma.lead.count({ where: { ...w, isQualified: true, isDeleted: false } }),
    prisma.followup.count({ where: { assignedToId: employeeId, status: "PENDING", scheduledAt: { gte: new Date(new Date().setHours(0,0,0,0)), lte: new Date(new Date().setHours(23,59,59,999)) } } }),
    prisma.followup.count({ where: { assignedToId: employeeId, status: "PENDING" } }),
    prisma.opportunity.count({ where: { companyId, ownerId: employeeId, isDeleted: false, status: { notIn: ["WON","LOST","CANCELLED"] } } }),
    prisma.deal.aggregate({ where: { companyId, closedById: employeeId, outcome: "WON", ...(startDate && { closingDate: dateFilter }) }, _sum: { finalAmount: true }, _count: { id: true } }),
    prisma.communicationLog.count({ where: { createdById: employeeId, communicationType: "CALL", isDeleted: false, interactionDate: { gte: new Date(new Date().setHours(0,0,0,0)) } } }),
  ]);
  return {
    assignedLeads, qualifiedLeads, followupsToday, pendingFollowups,
    activeOpportunities, callsCompletedToday,
    dealsWon: dealsWonAgg._count.id || 0,
    revenue: Number(dealsWonAgg._sum.finalAmount || 0),
  };
}

// LEAD AGING — Filtered to active/unclosed leads
export async function findLeadAgingBuckets({ companyId, branchId, employeeId } = {}) {
  const where = {
    ...(companyId && { companyId }),
    ...(branchId && { branchId }),
    ...(employeeId && { assignedToId: employeeId }),
    isDeleted: false,
    isDuplicate: false,
    customers: { none: {} },
    deals: { none: { outcome: "WON" } },
  };
  const leads = await prisma.lead.findMany({ where, select: { createdAt: true } });
  const now = Date.now();
  const buckets = { "0-3": 0, "4-7": 0, "8-15": 0, "16-30": 0, "30+": 0 };
  leads.forEach(({ createdAt }) => {
    const days = Math.floor((now - new Date(createdAt).getTime()) / 86400000);
    if (days <= 3) buckets["0-3"]++;
    else if (days <= 7) buckets["4-7"]++;
    else if (days <= 15) buckets["8-15"]++;
    else if (days <= 30) buckets["16-30"]++;
    else buckets["30+"]++;
  });
  return buckets;
}

// KPI TARGETS
export async function findKpiTargets({ companyId, branchId, employeeId, startDate, endDate } = {}) {
  return prisma.kpiTarget.findMany({
    where: {
      companyId,
      ...(branchId && { branchId }),
      ...(employeeId && { employeeId }),
      status: "ACTIVE",
      ...(startDate && { endDate: { gte: new Date(startDate) } }),
      ...(endDate && { startDate: { lte: new Date(endDate) } }),
    },
    select: { id: true, kpiType: true, targetValue: true, achievedValue: true, duration: true, startDate: true, endDate: true, status: true },
    orderBy: { startDate: "desc" },
    take: 10,
  });
}

// ACTIVITY FEED
export async function findRecentActivities({ companyId, branchId } = {}) {
  return prisma.leadActivity.findMany({
    where: { companyId, ...(branchId && { lead: { branchId } }) },
    include: {
      lead: { select: { id: true, name: true, interestedFor: true } },
      performedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

// CALL QUEUE — ISE/BDE Pending Call Follow-ups (Scoped)
export async function findCallQueue({ companyId, employeeId } = {}) {
  return prisma.followup.findMany({
    where: {
      ...(companyId && { companyId }),
      assignedToId: employeeId,
      status: "PENDING",
      followupType: "CALL",
    },
    include: {
      lead: { select: { id: true, name: true, mobile: true, interestedFor: true, updatedAt: true } },
    },
    orderBy: { scheduledAt: "asc" },
    take: 20,
  });
}
