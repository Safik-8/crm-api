// crm-api/src/modules/revenueReport/revenueReport.services.js

import { ROLE_RANKS } from "../../config/roleConstants.js";
import * as revenueReportRepo from "./revenueReport.repository.js";

/**
 * Parse ID query parameters to integers safely
 */
function parseIdFilters(filters) {
  const parsed = { ...filters };
  if (parsed.branchId !== undefined && parsed.branchId !== '') {
    const n = parseInt(parsed.branchId, 10);
    parsed.branchId = isNaN(n) ? undefined : n;
  } else if (parsed.branchId === '') {
    parsed.branchId = undefined;
  }

  if (parsed.teamId !== undefined && parsed.teamId !== '') {
    const n = parseInt(parsed.teamId, 10);
    parsed.teamId = isNaN(n) ? undefined : n;
  } else if (parsed.teamId === '') {
    parsed.teamId = undefined;
  }

  if (parsed.companyId !== undefined && parsed.companyId !== '') {
    const n = parseInt(parsed.companyId, 10);
    if (!isNaN(n)) parsed.companyId = n;
  }

  if (parsed.courseId !== undefined && parsed.courseId !== '') {
    const n = parseInt(parsed.courseId, 10);
    if (!isNaN(n)) parsed.courseId = n;
  }

  return parsed;
}

/**
 * Helper to calculate start & end dates for period filters
 */
export function getDateRangeForPeriod({ rankingPeriod, year, quarter, startDate, endDate }) {
  const now = new Date();
  const currentYear = year || now.getFullYear();

  if (rankingPeriod === 'ALL' || !rankingPeriod) {
    return { startDate: undefined, endDate: undefined };
  }

  if (rankingPeriod === 'CUSTOM') {
    if (startDate && endDate) {
      return {
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString()
      };
    }
    return { startDate: undefined, endDate: undefined };
  }

  if (rankingPeriod === 'QUARTERLY') {
    const q = quarter || Math.floor((now.getMonth() + 3) / 3);
    let startMonth = 0;
    let endMonth = 2;
    if (q === 2) { startMonth = 3; endMonth = 5; }
    else if (q === 3) { startMonth = 6; endMonth = 8; }
    else if (q === 4) { startMonth = 9; endMonth = 11; }

    const start = new Date(Date.UTC(currentYear, startMonth, 1, 0, 0, 0));
    const end = new Date(Date.UTC(currentYear, endMonth + 1, 0, 23, 59, 59, 999));
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }

  if (rankingPeriod === 'YEARLY') {
    const start = new Date(Date.UTC(currentYear, 0, 1, 0, 0, 0));
    const end = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999));
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }

  if (rankingPeriod === 'MONTHLY') {
    const month = now.getMonth();
    const start = new Date(Date.UTC(currentYear, month, 1, 0, 0, 0));
    const end = new Date(Date.UTC(currentYear, month + 1, 0, 23, 59, 59, 999));
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }

  return { startDate: undefined, endDate: undefined };
}

/**
 * Role-Based & Rank-Based Data Scoping Guard (Strict Hierarchy Consistency)
 * 
 * - Super Admin (Rank >= 100): Global cross-company & branch analytics.
 * - Company Admin (Rank 80 - 99): Company-wide analytics access (companyId = actor.companyId).
 * - Branch Manager (Rank 60 - 79), BDE (Rank 40), ISE (Rank 20): Branch-scoped analytics (branchId = actor.branchId).
 */
export function applyRoleScopingGuard(actor, queryFilters) {
  const scopedFilters = parseIdFilters({ ...queryFilters });

  if (!actor) return scopedFilters;

  const roleRank = actor.primaryRoleRank || 0;

  // 1. Company Scoping: Enforced for all roles below Super Admin (Rank < 100)
  if (actor.companyId && roleRank < ROLE_RANKS.SUPER_ADMIN) {
    scopedFilters.companyId = actor.companyId;
  }

  // 2. Branch Scoping: Enforced for all operational roles below Company Admin (Rank < 80)
  if (roleRank < ROLE_RANKS.COMPANY_ADMIN) {
    if (actor.branchId) {
      scopedFilters.branchId = actor.branchId;
    }
  }

  // 3. BDE Personal Scoping: Enforced for BDE (Rank = 40)
  if (actor.primaryRole === 'BDE' || roleRank === ROLE_RANKS.BDE) {
    scopedFilters.closedById = actor.id;
  }

  return scopedFilters;
}

/**
 * Helper to compute previous period date range for growth comparison
 */
function getPreviousPeriodDateRange(filters) {
  if (!filters.startDate || !filters.endDate) {
    return {};
  }

  const start = new Date(filters.startDate);
  const end = new Date(filters.endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 30;

  const prevEnd = new Date(start.getTime() - (1000 * 60 * 60 * 24));
  const prevStart = new Date(prevEnd.getTime() - (diffDays * 1000 * 60 * 60 * 24));

  return {
    startDate: prevStart.toISOString(),
    endDate: prevEnd.toISOString()
  };
}

/**
 * Service: Get Revenue Summary KPIs & Growth %
 */
export async function getRevenueSummary(actor, queryFilters) {
  const scopedFilters = applyRoleScopingGuard(actor, queryFilters);

  if (scopedFilters.rankingPeriod === 'ALL') {
    delete scopedFilters.startDate;
    delete scopedFilters.endDate;
  } else if (scopedFilters.rankingPeriod && scopedFilters.rankingPeriod !== 'CUSTOM') {
    const dates = getDateRangeForPeriod(scopedFilters);
    if (dates.startDate && dates.endDate && !scopedFilters.startDate) {
      scopedFilters.startDate = dates.startDate;
      scopedFilters.endDate = dates.endDate;
    }
  }

  const prevDateRange = getPreviousPeriodDateRange(scopedFilters);
  const prevFilters = { ...scopedFilters, ...prevDateRange };

  const summary = await revenueReportRepo.findSummaryMetrics(scopedFilters, prevFilters);

  return {
    period: scopedFilters.rankingPeriod || "ALL",
    filters: scopedFilters,
    metrics: summary
  };
}

/**
 * Service: Get Monthly Revenue Statement Report
 */
export async function getMonthlyRevenueReport(actor, queryFilters) {
  const scopedFilters = applyRoleScopingGuard(actor, queryFilters);

  if (scopedFilters.rankingPeriod && scopedFilters.rankingPeriod !== 'ALL') {
    const dates = getDateRangeForPeriod(scopedFilters);
    if (dates.startDate && dates.endDate && !scopedFilters.startDate) {
      scopedFilters.startDate = dates.startDate;
      scopedFilters.endDate = dates.endDate;
    }
  }

  const page = scopedFilters.page || 1;
  const limit = scopedFilters.limit || 20;

  const result = await revenueReportRepo.findMonthlyRevenueReport(scopedFilters, page, limit);

  return {
    period: scopedFilters.rankingPeriod || "ALL",
    filters: scopedFilters,
    ...result
  };
}

/**
 * Service: Get Quarterly Revenue Breakdown Report
 */
export async function getQuarterlyRevenueReport(actor, queryFilters) {
  const scopedFilters = applyRoleScopingGuard(actor, queryFilters);

  if (scopedFilters.rankingPeriod && scopedFilters.rankingPeriod !== 'ALL') {
    const dates = getDateRangeForPeriod(scopedFilters);
    if (dates.startDate && dates.endDate && !scopedFilters.startDate) {
      scopedFilters.startDate = dates.startDate;
      scopedFilters.endDate = dates.endDate;
    }
  }

  const page = scopedFilters.page || 1;
  const limit = scopedFilters.limit || 20;

  const result = await revenueReportRepo.findQuarterlyRevenueReport(scopedFilters, page, limit);

  return {
    period: scopedFilters.rankingPeriod || "ALL",
    filters: scopedFilters,
    ...result
  };
}

/**
 * Service: Get Revenue by Product / Course Report
 */
export async function getProductRevenueReport(actor, queryFilters) {
  const scopedFilters = applyRoleScopingGuard(actor, queryFilters);

  if (scopedFilters.rankingPeriod && scopedFilters.rankingPeriod !== 'ALL') {
    const dates = getDateRangeForPeriod(scopedFilters);
    if (dates.startDate && dates.endDate && !scopedFilters.startDate) {
      scopedFilters.startDate = dates.startDate;
      scopedFilters.endDate = dates.endDate;
    }
  }

  const page = scopedFilters.page || 1;
  const limit = scopedFilters.limit || 20;

  const result = await revenueReportRepo.findProductRevenueReport(scopedFilters, page, limit);

  return {
    period: scopedFilters.rankingPeriod || "ALL",
    filters: scopedFilters,
    ...result
  };
}

/**
 * Service: Get Revenue by Team Attribution Report
 */
export async function getTeamRevenueReport(actor, queryFilters) {
  const scopedFilters = applyRoleScopingGuard(actor, queryFilters);

  if (scopedFilters.rankingPeriod && scopedFilters.rankingPeriod !== 'ALL') {
    const dates = getDateRangeForPeriod(scopedFilters);
    if (dates.startDate && dates.endDate && !scopedFilters.startDate) {
      scopedFilters.startDate = dates.startDate;
      scopedFilters.endDate = dates.endDate;
    }
  }

  const page = scopedFilters.page || 1;
  const limit = scopedFilters.limit || 20;

  const result = await revenueReportRepo.findTeamRevenueReport(scopedFilters, page, limit);

  return {
    period: scopedFilters.rankingPeriod || "ALL",
    filters: scopedFilters,
    ...result
  };
}

/**
 * Service: Get Revenue by Branch Comparison Report
 */
export async function getBranchRevenueReport(actor, queryFilters) {
  const scopedFilters = applyRoleScopingGuard(actor, queryFilters);

  if (scopedFilters.rankingPeriod && scopedFilters.rankingPeriod !== 'ALL') {
    const dates = getDateRangeForPeriod(scopedFilters);
    if (dates.startDate && dates.endDate && !scopedFilters.startDate) {
      scopedFilters.startDate = dates.startDate;
      scopedFilters.endDate = dates.endDate;
    }
  }

  const page = scopedFilters.page || 1;
  const limit = scopedFilters.limit || 20;

  const result = await revenueReportRepo.findBranchRevenueReport(scopedFilters, page, limit);

  return {
    period: scopedFilters.rankingPeriod || "ALL",
    filters: scopedFilters,
    ...result
  };
}

/**
 * Service: Get Revenue Trend Visualization Report
 */
export async function getRevenueTrendReport(actor, queryFilters) {
  const scopedFilters = applyRoleScopingGuard(actor, queryFilters);

  if (scopedFilters.rankingPeriod && scopedFilters.rankingPeriod !== 'ALL') {
    const dates = getDateRangeForPeriod(scopedFilters);
    if (dates.startDate && dates.endDate && !scopedFilters.startDate) {
      scopedFilters.startDate = dates.startDate;
      scopedFilters.endDate = dates.endDate;
    }
  }

  const trendData = await revenueReportRepo.findRevenueTrendData(scopedFilters);

  return {
    filters: scopedFilters,
    trend: trendData
  };
}

/**
 * Service: Log Report Export & Audit Record
 */
export async function logExportAction(actor, exportPayload) {
  const result = await revenueReportRepo.createExportLogWithAudit(exportPayload, actor);

  return {
    exportLogId: result.exportLog.id,
    exportedAt: result.exportLog.exportedAt,
    message: "Export logged successfully"
  };
}
