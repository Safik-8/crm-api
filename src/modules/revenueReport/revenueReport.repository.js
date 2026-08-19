// crm-api/src/modules/revenueReport/revenueReport.repository.js

import prisma from "../../config/db.js";

/**
 * Builds Prisma 'where' clause for RevenueLog table queries based on filters
 */
function buildRevenueWhereClause(filters) {
  const where = {};

  if (filters.companyId) {
    where.companyId = filters.companyId;
  }
  if (filters.branchId) {
    where.branchId = filters.branchId;
  }
  if (filters.teamId) {
    where.teamId = filters.teamId;
  }
  if (filters.courseId) {
    where.productId = filters.courseId;
  }

  // BDE Personal Revenue Isolation
  if (filters.closedById) {
    where.deal = {
      closedById: filters.closedById
    };
  }

  // Date Filtering
  if (filters.startDate || filters.endDate) {
    where.revenueDate = {};
    if (filters.startDate) {
      where.revenueDate.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      where.revenueDate.lte = new Date(filters.endDate);
    }
  }

  return where;
}

/**
 * Helper to compute safe division growth %
 */
function calcGrowth(current, previous) {
  const curr = Number(current) || 0;
  const prev = Number(previous) || 0;
  if (prev <= 0) return curr > 0 ? 100 : 0;
  return Number((((curr - prev) / prev) * 100).toFixed(2));
}

/**
 * Repository: Find Revenue Summary & Key Metrics
 */
export async function findSummaryMetrics(filters, prevFilters = {}) {
  const currentWhere = buildRevenueWhereClause(filters);
  const prevWhere = buildRevenueWhereClause(prevFilters);

  // Current Period Aggregate
  const currentAgg = await prisma.revenueLog.aggregate({
    where: currentWhere,
    _sum: { revenueAmount: true },
    _count: { id: true, dealId: true }
  });

  // Previous Period Aggregate
  const prevAgg = await prisma.revenueLog.aggregate({
    where: prevWhere,
    _sum: { revenueAmount: true },
    _count: { id: true, dealId: true }
  });

  const totalRevenue = Number(currentAgg._sum.revenueAmount || 0);
  const prevTotalRevenue = Number(prevAgg._sum.revenueAmount || 0);

  const totalDeals = currentAgg._count.dealId || 0;
  const prevTotalDeals = prevAgg._count.dealId || 0;

  const averageDealSize = totalDeals > 0 ? Number((totalRevenue / totalDeals).toFixed(2)) : 0;
  const prevAverageDealSize = prevTotalDeals > 0 ? Number((prevTotalRevenue / prevTotalDeals).toFixed(2)) : 0;

  const revenueGrowthPct = calcGrowth(totalRevenue, prevTotalRevenue);
  const dealsGrowthPct = calcGrowth(totalDeals, prevTotalDeals);
  const adsGrowthPct = calcGrowth(averageDealSize, prevAverageDealSize);

  // Monthly Revenue (Current Month)
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));

  const startOfPrevMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0));
  const endOfPrevMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999));

  const monthWhere = { ...currentWhere, revenueDate: { gte: startOfMonth, lte: endOfMonth } };
  const prevMonthWhere = { ...currentWhere, revenueDate: { gte: startOfPrevMonth, lte: endOfPrevMonth } };

  const currentMonthAgg = await prisma.revenueLog.aggregate({
    where: monthWhere,
    _sum: { revenueAmount: true }
  });
  const prevMonthAgg = await prisma.revenueLog.aggregate({
    where: prevMonthWhere,
    _sum: { revenueAmount: true }
  });

  const monthlyRevenue = Number(currentMonthAgg._sum.revenueAmount || 0);
  const prevMonthlyRevenue = Number(prevMonthAgg._sum.revenueAmount || 0);
  const monthlyGrowthPct = calcGrowth(monthlyRevenue, prevMonthlyRevenue);

  // Quarterly Revenue (Current Quarter)
  const currentQuarter = Math.floor((now.getMonth() + 3) / 3);
  let qStartMonth = 0;
  let qEndMonth = 2;
  if (currentQuarter === 2) { qStartMonth = 3; qEndMonth = 5; }
  else if (currentQuarter === 3) { qStartMonth = 6; qEndMonth = 8; }
  else if (currentQuarter === 4) { qStartMonth = 9; qEndMonth = 11; }

  const startOfQuarter = new Date(Date.UTC(now.getFullYear(), qStartMonth, 1, 0, 0, 0));
  const endOfQuarter = new Date(Date.UTC(now.getFullYear(), qEndMonth + 1, 0, 23, 59, 59, 999));

  const quarterWhere = { ...currentWhere, revenueDate: { gte: startOfQuarter, lte: endOfQuarter } };
  const currentQuarterAgg = await prisma.revenueLog.aggregate({
    where: quarterWhere,
    _sum: { revenueAmount: true }
  });
  const quarterlyRevenue = Number(currentQuarterAgg._sum.revenueAmount || 0);

  // Yearly Revenue (Current Year)
  const startOfYear = new Date(Date.UTC(now.getFullYear(), 0, 1, 0, 0, 0));
  const endOfYear = new Date(Date.UTC(now.getFullYear(), 11, 31, 23, 59, 59, 999));

  const yearWhere = { ...currentWhere, revenueDate: { gte: startOfYear, lte: endOfYear } };
  const currentYearAgg = await prisma.revenueLog.aggregate({
    where: yearWhere,
    _sum: { revenueAmount: true }
  });
  const yearlyRevenue = Number(currentYearAgg._sum.revenueAmount || 0);

  return {
    isCustomRange: Boolean(filters.startDate || filters.endDate || filters.rankingPeriod === 'CUSTOM'),
    totalRevenue,
    prevTotalRevenue,
    revenueGrowthPct,
    monthlyRevenue,
    monthlyGrowthPct,
    quarterlyRevenue,
    yearlyRevenue,
    averageDealSize,
    adsGrowthPct,
    totalDeals,
    dealsGrowthPct
  };
}

/**
 * Repository: Find Month-by-Month Financial Report
 */
export async function findMonthlyRevenueReport(filters, page = 1, limit = 20) {
  const where = buildRevenueWhereClause(filters);

  // Fetch raw logs with deal and customer
  const logs = await prisma.revenueLog.findMany({
    where,
    select: {
      id: true,
      revenueAmount: true,
      revenueDate: true,
      dealId: true,
      customerId: true
    },
    orderBy: { revenueDate: "desc" }
  });

  // Group by YYYY-MM
  const monthGroupMap = new Map();

  logs.forEach((log) => {
    const d = new Date(log.revenueDate);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1; // 1-indexed
    const key = `${year}-${String(month).padStart(2, '0')}`;

    if (!monthGroupMap.has(key)) {
      monthGroupMap.set(key, {
        year,
        month,
        monthName: d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
        periodKey: key,
        totalRevenue: 0,
        dealsMap: new Set(),
        customersMap: new Set()
      });
    }

    const item = monthGroupMap.get(key);
    item.totalRevenue += Number(log.revenueAmount || 0);
    if (log.dealId) item.dealsMap.add(log.dealId);
    if (log.customerId) item.customersMap.add(log.customerId);
  });

  // Convert to sorted array
  const monthArray = Array.from(monthGroupMap.values()).sort((a, b) => b.periodKey.localeCompare(a.periodKey));

  // Compute MoM Growth %
  const processedData = monthArray.map((item, idx) => {
    const prevItem = monthArray[idx + 1]; // Next in array is previous month because sorted desc
    const prevRevenue = prevItem ? prevItem.totalRevenue : 0;
    const growthPct = calcGrowth(item.totalRevenue, prevRevenue);

    return {
      year: item.year,
      month: item.month,
      monthName: item.monthName,
      periodKey: item.periodKey,
      totalRevenue: Number(item.totalRevenue.toFixed(2)),
      dealsClosed: item.dealsMap.size,
      customersAdded: item.customersMap.size,
      growthPct
    };
  });

  // Paginate
  const totalRecords = processedData.length;
  const startIndex = (page - 1) * limit;
  const paginatedData = processedData.slice(startIndex, startIndex + limit);

  return {
    data: paginatedData,
    pagination: {
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit) || 1
    }
  };
}

/**
 * Repository: Find Quarter-by-Quarter Financial Report
 */
export async function findQuarterlyRevenueReport(filters, page = 1, limit = 20) {
  const where = buildRevenueWhereClause(filters);

  const logs = await prisma.revenueLog.findMany({
    where,
    select: {
      id: true,
      revenueAmount: true,
      revenueDate: true,
      dealId: true,
      customerId: true
    },
    orderBy: { revenueDate: "desc" }
  });

  const quarterGroupMap = new Map();

  logs.forEach((log) => {
    const d = new Date(log.revenueDate);
    const year = d.getUTCFullYear();
    const quarter = Math.floor(d.getUTCMonth() / 3) + 1; // Q1..Q4
    const key = `${year}-Q${quarter}`;

    if (!quarterGroupMap.has(key)) {
      quarterGroupMap.set(key, {
        year,
        quarter,
        periodKey: key,
        totalRevenue: 0,
        dealsMap: new Set(),
        customersMap: new Set()
      });
    }

    const item = quarterGroupMap.get(key);
    item.totalRevenue += Number(log.revenueAmount || 0);
    if (log.dealId) item.dealsMap.add(log.dealId);
    if (log.customerId) item.customersMap.add(log.customerId);
  });

  const quarterArray = Array.from(quarterGroupMap.values()).sort((a, b) => b.periodKey.localeCompare(a.periodKey));

  const processedData = quarterArray.map((item, idx) => {
    const prevItem = quarterArray[idx + 1];
    const prevRevenue = prevItem ? prevItem.totalRevenue : 0;
    const growthPct = calcGrowth(item.totalRevenue, prevRevenue);

    return {
      year: item.year,
      quarter: item.quarter,
      periodKey: item.periodKey,
      totalRevenue: Number(item.totalRevenue.toFixed(2)),
      dealsClosed: item.dealsMap.size,
      customersAdded: item.customersMap.size,
      growthPct
    };
  });

  const totalRecords = processedData.length;
  const startIndex = (page - 1) * limit;
  const paginatedData = processedData.slice(startIndex, startIndex + limit);

  return {
    data: paginatedData,
    pagination: {
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit) || 1
    }
  };
}

/**
 * Repository: Find Product Revenue Report
 */
export async function findProductRevenueReport(filters, page = 1, limit = 20) {
  const where = buildRevenueWhereClause(filters);

  const logs = await prisma.revenueLog.findMany({
    where,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          code: true,
          category: true
        }
      }
    }
  });

  const totalCompanyRevenue = logs.reduce((sum, l) => sum + Number(l.revenueAmount || 0), 0);

  const productMap = new Map();

  logs.forEach((log) => {
    const productId = log.productId || 0;
    const productName = log.product?.name || "Uncategorized Course/Product";
    const productCode = log.product?.code || "N/A";
    const category = log.product?.category || "General";

    if (!productMap.has(productId)) {
      productMap.set(productId, {
        productId,
        productName,
        productCode,
        category,
        totalRevenue: 0,
        salesCount: 0,
        dealsSet: new Set()
      });
    }

    const item = productMap.get(productId);
    item.totalRevenue += Number(log.revenueAmount || 0);
    if (log.dealId) item.dealsSet.add(log.dealId);
  });

  const productArray = Array.from(productMap.values()).map((item) => {
    const salesCount = item.dealsSet.size || 1;
    const averageSellingPrice = Number((item.totalRevenue / salesCount).toFixed(2));
    const contributionPct = totalCompanyRevenue > 0
      ? Number(((item.totalRevenue / totalCompanyRevenue) * 100).toFixed(2))
      : 0;

    return {
      productId: item.productId,
      productName: item.productName,
      productCode: item.productCode,
      category: item.category,
      totalRevenue: Number(item.totalRevenue.toFixed(2)),
      salesCount,
      averageSellingPrice,
      contributionPct
    };
  });

  // Sort descending by total revenue
  productArray.sort((a, b) => b.totalRevenue - a.totalRevenue);

  const totalRecords = productArray.length;
  const startIndex = (page - 1) * limit;
  const paginatedData = productArray.slice(startIndex, startIndex + limit);

  return {
    data: paginatedData,
    pagination: {
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit) || 1
    }
  };
}

/**
 * Repository: Find Team Revenue Report
 */
export async function findTeamRevenueReport(filters, page = 1, limit = 20) {
  const where = buildRevenueWhereClause(filters);

  const logs = await prisma.revenueLog.findMany({
    where,
    include: {
      team: {
        select: {
          id: true,
          name: true,
          code: true,
          branch: { select: { id: true, name: true } }
        }
      }
    }
  });

  const teamMap = new Map();

  logs.forEach((log) => {
    const teamId = log.teamId || 0;
    const teamName = log.team?.name || "Direct / Independent Sales";
    const teamCode = log.team?.code || "N/A";
    const branchName = log.team?.branch?.name || "N/A";

    if (!teamMap.has(teamId)) {
      teamMap.set(teamId, {
        teamId,
        teamName,
        teamCode,
        branchName,
        totalRevenue: 0,
        dealsSet: new Set(),
        customersSet: new Set()
      });
    }

    const item = teamMap.get(teamId);
    item.totalRevenue += Number(log.revenueAmount || 0);
    if (log.dealId) item.dealsSet.add(log.dealId);
    if (log.customerId) item.customersSet.add(log.customerId);
  });

  const teamArray = Array.from(teamMap.values()).map((item) => ({
    teamId: item.teamId,
    teamName: item.teamName,
    teamCode: item.teamCode,
    branchName: item.branchName,
    totalRevenue: Number(item.totalRevenue.toFixed(2)),
    dealsWon: item.dealsSet.size,
    customerCount: item.customersSet.size,
    growthPct: 0 // Will be populated in service layer or computed if historical baseline present
  }));

  teamArray.sort((a, b) => b.totalRevenue - a.totalRevenue);

  const totalRecords = teamArray.length;
  const startIndex = (page - 1) * limit;
  const paginatedData = teamArray.slice(startIndex, startIndex + limit);

  return {
    data: paginatedData,
    pagination: {
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit) || 1
    }
  };
}

/**
 * Repository: Find Branch Revenue Report
 */
export async function findBranchRevenueReport(filters, page = 1, limit = 20) {
  const where = buildRevenueWhereClause(filters);

  const logs = await prisma.revenueLog.findMany({
    where,
    include: {
      branch: {
        select: {
          id: true,
          name: true,
          code: true,
          company: { select: { id: true, name: true } }
        }
      }
    }
  });

  const branchMap = new Map();

  logs.forEach((log) => {
    const branchId = log.branchId || 0;
    const branchName = log.branch?.name || "Head Office / Corporate";
    const branchCode = log.branch?.code || "HO";
    const companyName = log.branch?.company?.name || "Main Company";

    if (!branchMap.has(branchId)) {
      branchMap.set(branchId, {
        branchId,
        branchName,
        branchCode,
        companyName,
        totalRevenue: 0,
        dealsSet: new Set(),
        customersSet: new Set()
      });
    }

    const item = branchMap.get(branchId);
    item.totalRevenue += Number(log.revenueAmount || 0);
    if (log.dealId) item.dealsSet.add(log.dealId);
    if (log.customerId) item.customersSet.add(log.customerId);
  });

  const branchArray = Array.from(branchMap.values()).map((item) => ({
    branchId: item.branchId,
    branchName: item.branchName,
    branchCode: item.branchCode,
    companyName: item.companyName,
    totalRevenue: Number(item.totalRevenue.toFixed(2)),
    dealsWon: item.dealsSet.size,
    customerCount: item.customersSet.size,
    growthPct: 0
  }));

  branchArray.sort((a, b) => b.totalRevenue - a.totalRevenue);

  const totalRecords = branchArray.length;
  const startIndex = (page - 1) * limit;
  const paginatedData = branchArray.slice(startIndex, startIndex + limit);

  return {
    data: paginatedData,
    pagination: {
      page,
      limit,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit) || 1
    }
  };
}

/**
 * Repository: Find Revenue Trend Data for Charting
 */
export async function findRevenueTrendData(filters) {
  const where = buildRevenueWhereClause(filters);
  const now = new Date();
  const targetYear = filters.year || now.getFullYear();

  // 1. Fetch current year logs
  const currentYearStart = new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0));
  const currentYearEnd = new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59, 999));

  const currentYearWhere = {
    ...where,
    revenueDate: { gte: currentYearStart, lte: currentYearEnd }
  };

  const currentLogs = await prisma.revenueLog.findMany({
    where: currentYearWhere,
    select: { revenueAmount: true, revenueDate: true }
  });

  // 2. Fetch previous year logs for YoY
  const prevYearStart = new Date(Date.UTC(targetYear - 1, 0, 1, 0, 0, 0));
  const prevYearEnd = new Date(Date.UTC(targetYear - 1, 11, 31, 23, 59, 59, 999));

  const prevYearWhere = {
    ...where,
    revenueDate: { gte: prevYearStart, lte: prevYearEnd }
  };

  const prevLogs = await prisma.revenueLog.findMany({
    where: prevYearWhere,
    select: { revenueAmount: true, revenueDate: true }
  });

  // Build Monthly Breakdown (12 Months)
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyTrend = monthNames.map((name, idx) => ({
    month: idx + 1,
    monthName: name,
    revenue: 0,
    previousYearRevenue: 0
  }));

  currentLogs.forEach((log) => {
    const m = new Date(log.revenueDate).getUTCMonth();
    if (monthlyTrend[m]) {
      monthlyTrend[m].revenue += Number(log.revenueAmount || 0);
    }
  });

  prevLogs.forEach((log) => {
    const m = new Date(log.revenueDate).getUTCMonth();
    if (monthlyTrend[m]) {
      monthlyTrend[m].previousYearRevenue += Number(log.revenueAmount || 0);
    }
  });

  monthlyTrend.forEach((m) => {
    m.revenue = Number(m.revenue.toFixed(2));
    m.previousYearRevenue = Number(m.previousYearRevenue.toFixed(2));
  });

  // Build Quarterly Breakdown (4 Quarters)
  const quarterlyTrend = [
    { quarter: "Q1", label: "Q1 (Jan-Mar)", revenue: 0 },
    { quarter: "Q2", label: "Q2 (Apr-Jun)", revenue: 0 },
    { quarter: "Q3", label: "Q3 (Jul-Sep)", revenue: 0 },
    { quarter: "Q4", label: "Q4 (Oct-Dec)", revenue: 0 }
  ];

  monthlyTrend.forEach((m) => {
    const qIdx = Math.floor((m.month - 1) / 3);
    quarterlyTrend[qIdx].revenue += m.revenue;
  });

  quarterlyTrend.forEach((q) => {
    q.revenue = Number(q.revenue.toFixed(2));
  });

  return {
    year: targetYear,
    monthlyTrend,
    quarterlyTrend
  };
}

/**
 * Repository: Log Export Activity & Create Audit Record inside a Transaction
 */
export async function createExportLogWithAudit(exportData, actor) {
  return await prisma.$transaction(async (tx) => {
    // 1. Insert into ExportLog
    const exportLog = await tx.exportLog.create({
      data: {
        companyId: actor.companyId || 1,
        branchId: actor.branchId || null,
        reportName: exportData.reportName,
        exportType: exportData.exportType,
        fileName: exportData.fileName,
        filtersUsed: exportData.filtersUsed || {},
        exportedById: actor.id
      }
    });

    // 2. Insert into AuditLog using repo pattern
    const auditLog = await tx.auditLog.create({
      data: {
        companyId: actor.companyId || null,
        entityType: "REPORT_EXPORT",
        entityId: exportLog.id,
        action: `EXPORT_REVENUE_${exportData.exportType}`,
        newValue: {
          reportName: exportData.reportName,
          exportType: exportData.exportType,
          fileName: exportData.fileName,
          filtersUsed: exportData.filtersUsed || {}
        },
        performedById: actor.id
      }
    });

    return { exportLog, auditLog };
  });
}
