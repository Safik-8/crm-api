// crm-api/src/modules/dashboard/dashboard.services.js
import {
  applyRoleScopingGuard,
  getDateRangeForPeriod,
} from "../salesPerformance/salesPerformance.services.js";
import * as dashboardRepo from "./dashboard.repository.js";
import { ROLE_RANKS } from "../../config/roleConstants.js";

export async function getDashboardMetrics(actor, queryFilters) {
  const scopedFilters = applyRoleScopingGuard(actor, queryFilters);
  const dateRange     = getDateRangeForPeriod(scopedFilters);
  const filters       = { ...scopedFilters, ...dateRange };
  const rank          = actor.primaryRoleRank ?? 0;

  if (rank <= ROLE_RANKS.BDE) { // Rank <= 40 (ISE & BDE tiers)
    return dashboardRepo.findPersonalMetrics({ ...filters, employeeId: actor.id });
  }
  if (rank <= ROLE_RANKS.BRANCH_MANAGER) { // Rank 41..60 (Branch tier)
    return dashboardRepo.findBranchMetrics(filters);
  }
  if (rank < ROLE_RANKS.SUPER_ADMIN) { // Rank 61..99 (Company Admin & Tier 1 Custom Roles)
    return dashboardRepo.findCompanyMetrics(filters);
  }
  return dashboardRepo.findGlobalMetrics(filters);
}

export async function getLeadAgingBuckets(actor, queryFilters) {
  const scopedFilters = applyRoleScopingGuard(actor, queryFilters);
  const rank          = actor.primaryRoleRank ?? 0;
  const employeeId    = rank <= ROLE_RANKS.ISE ? actor.id : scopedFilters.employeeId;
  return dashboardRepo.findLeadAgingBuckets({ ...scopedFilters, employeeId });
}

export async function getKpiTargets(actor, queryFilters) {
  const scopedFilters = applyRoleScopingGuard(actor, queryFilters);
  const dateRange     = getDateRangeForPeriod(scopedFilters);
  const rank          = actor.primaryRoleRank ?? 0;
  const employeeId    = rank <= ROLE_RANKS.ISE ? actor.id : undefined;
  return dashboardRepo.findKpiTargets({ ...scopedFilters, ...dateRange, employeeId });
}

export async function getActivityFeed(actor, queryFilters) {
  const scopedFilters = applyRoleScopingGuard(actor, queryFilters);
  return dashboardRepo.findRecentActivities(scopedFilters);
}

export async function getCallQueue(actor, queryFilters) {
  const scopedFilters = applyRoleScopingGuard(actor, queryFilters);
  return dashboardRepo.findCallQueue({ ...scopedFilters, employeeId: actor.id });
}
