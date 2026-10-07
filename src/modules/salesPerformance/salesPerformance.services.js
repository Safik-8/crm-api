// crm-api/src/modules/salesPerformance/salesPerformance.services.js

import { ROLE_RANKS } from "../../config/roleConstants.js";
import * as salesPerformanceRepo from "./salesPerformance.repository.js";

/**
 * Parse ID query params to integers (req.query sends everything as strings)
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
  if (parsed.employeeId !== undefined && parsed.employeeId !== '') {
    const n = parseInt(parsed.employeeId, 10);
    if (!isNaN(n)) parsed.employeeId = n;
  }
  return parsed;
}

/**
 * Role-Based Data Isolation Guard (Supports System & Custom Roles)
 * 
 * - Super Admin (Rank >= 100): Full cross-company analytics access.
 * - Company Admin / Executive Custom Roles (Rank 80 - 99): Company-wide analytics access.
 * - Branch Manager / Operational / Custom Roles (Rank < 80): Branch-scoped analytics (if branchId assigned).
 */
export function applyRoleScopingGuard(actor, queryFilters) {
  const scopedFilters = parseIdFilters({ ...queryFilters });

  if (!actor) return scopedFilters;

  // 1. Company Scoping: Enforced for all roles below Super Admin (Rank < 100) or when companyId is assigned
  if (actor.companyId && actor.primaryRoleRank < ROLE_RANKS.SUPER_ADMIN) {
    scopedFilters.companyId = actor.companyId;
  }

  // 2. Branch Scoping: Enforced for branch tier and below (Rank <= 60) if assigned to a branch
  if (actor.primaryRoleRank <= ROLE_RANKS.BRANCH_MANAGER) {
    if (actor.branchId) {
      scopedFilters.branchId = actor.branchId;
    }
  }

  // 3. Optional Employee ID filter override (if explicitly passed)
  if (queryFilters.employeeId) {
    const n = parseInt(queryFilters.employeeId, 10);
    if (!isNaN(n)) scopedFilters.employeeId = n;
  }

  return scopedFilters;
}

/**
 * Period Date Range Helper
 */
export function getDateRangeForPeriod({ rankingPeriod, year, quarter, startDate, endDate }) {
  const now = new Date();
  const currentYear = year || now.getFullYear();

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

  // Default: MONTHLY (Current month)
  const month = now.getMonth();
  const start = new Date(Date.UTC(currentYear, month, 1, 0, 0, 0));
  const end = new Date(Date.UTC(currentYear, month + 1, 0, 23, 59, 59, 999));
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

/**
 * Absolute & Relative Hybrid Performance Score Normalization Algorithm
 */
export function calculateNormalizedRankings(dataset) {
  if (!dataset || dataset.length === 0) return [];

  const maxRev = Math.max(...dataset.map((d) => d.totalRevenue || 0), 1);
  const maxConv = Math.max(...dataset.map((d) => d.conversionRate || 0), 1);
  const maxDeals = Math.max(...dataset.map((d) => d.dealsWon || 0), 1);
  const maxQual = Math.max(...dataset.map((d) => d.qualifiedLeads || 0), 1);

  const normalizeRatio = (val, max) => {
    if (!val || val <= 0) return 0;
    if (max <= 0) return 100;
    return Number(((val / max) * 100).toFixed(2));
  };

  const rankedDataset = dataset.map((item) => {
    const normRevenue = normalizeRatio(item.totalRevenue || 0, maxRev);
    const normConversion = normalizeRatio(item.conversionRate || 0, maxConv);
    const normDeals = normalizeRatio(item.dealsWon || 0, maxDeals);
    const normQualified = normalizeRatio(item.qualifiedLeads || 0, maxQual);

    // Weighted performance formula: Revenue (40%), Conversion (30%), Deals Won (20%), Qualified (10%)
    const performanceScore = Number(
      (0.4 * normRevenue + 0.3 * normConversion + 0.2 * normDeals + 0.1 * normQualified).toFixed(1)
    );

    return {
      ...item,
      performanceScore
    };
  });

  // Sort descending by performance score
  rankedDataset.sort((a, b) => b.performanceScore - a.performanceScore);

  // Assign ranks
  return rankedDataset.map((item, idx) => ({
    ...item,
    rank: idx + 1
  }));
}

/**
 * Service: Get BDE Performance Report
 */
export async function getBDEPerformanceReport(actor, queryFilters) {
  const scopedFilters = applyRoleScopingGuard(actor, queryFilters);
  const dateRange = getDateRangeForPeriod(scopedFilters);
  const filters = { ...scopedFilters, ...dateRange };

  const rawMetrics = await salesPerformanceRepo.findBDEPerformanceMetrics(filters);
  const rankedMetrics = calculateNormalizedRankings(rawMetrics);

  return {
    period: filters.rankingPeriod,
    dateRange,
    totalRecords: rankedMetrics.length,
    data: rankedMetrics
  };
}

/**
 * Service: Get ISE Performance Report
 */
export async function getISEPerformanceReport(actor, queryFilters) {
  const scopedFilters = applyRoleScopingGuard(actor, queryFilters);
  const dateRange = getDateRangeForPeriod(scopedFilters);
  const filters = { ...scopedFilters, ...dateRange };

  const rawMetrics = await salesPerformanceRepo.findISEPerformanceMetrics(filters);
  const rankedMetrics = calculateNormalizedRankings(rawMetrics);

  return {
    period: filters.rankingPeriod,
    dateRange,
    totalRecords: rankedMetrics.length,
    data: rankedMetrics
  };
}

/**
 * Service: Get Team Performance Report
 */
export async function getTeamPerformanceReport(actor, queryFilters) {
  const scopedFilters = applyRoleScopingGuard(actor, queryFilters);
  const dateRange = getDateRangeForPeriod(scopedFilters);
  const filters = { ...scopedFilters, ...dateRange };

  const rawMetrics = await salesPerformanceRepo.findTeamPerformanceMetrics(filters);
  const rankedMetrics = calculateNormalizedRankings(rawMetrics);

  return {
    period: filters.rankingPeriod,
    dateRange,
    totalRecords: rankedMetrics.length,
    data: rankedMetrics
  };
}

/**
 * Service: Get Branch Performance Report
 */
export async function getBranchPerformanceReport(actor, queryFilters) {
  const scopedFilters = applyRoleScopingGuard(actor, queryFilters);
  const dateRange = getDateRangeForPeriod(scopedFilters);
  const filters = { ...scopedFilters, ...dateRange };

  const rawMetrics = await salesPerformanceRepo.findBranchPerformanceMetrics(filters);
  const rankedMetrics = calculateNormalizedRankings(rawMetrics);

  return {
    period: filters.rankingPeriod,
    dateRange,
    totalRecords: rankedMetrics.length,
    data: rankedMetrics
  };
}

/**
 * Service: Get Overall Performance Leaderboards
 */
export async function getPerformanceRankings(actor, queryFilters) {
  const bdeReport = await getBDEPerformanceReport(actor, queryFilters);
  const teamReport = await getTeamPerformanceReport(actor, queryFilters);

  return {
    topBDEs: bdeReport.data.slice(0, 5),
    topTeams: teamReport.data.slice(0, 5)
  };
}

/**
 * Service: Log Export Action in AuditLog
 */
export async function logExportAction(actor, payload) {
  const { reportType, format, filters, rowCount } = payload;
  const auditLog = await salesPerformanceRepo.createExportAuditLog({
    companyId: actor.companyId,
    performedById: actor.id,
    reportType: reportType || 'sales-performance',
    format: format || 'XLSX',
    filters: filters || {},
    rowCount: rowCount || 0
  });

  return auditLog;
}

