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

  if (actor.primaryRoleRank <= ROLE_RANKS.BDE) {
    return dashboardRepo.findPersonalMetrics({ ...filters, employeeId: actor.id });
  }
  if (actor.primaryRoleRank < ROLE_RANKS.COMPANY_ADMIN) {
    return dashboardRepo.findBranchMetrics(filters);
  }
  if (actor.primaryRoleRank < ROLE_RANKS.SUPER_ADMIN) {
    return dashboardRepo.findCompanyMetrics(filters);
  }
  return dashboardRepo.findGlobalMetrics(filters);
}

export async function getLeadAgingBuckets(actor, queryFilters) {
  const scopedFilters = applyRoleScopingGuard(actor, queryFilters);
  const employeeId    = actor.primaryRoleRank <= ROLE_RANKS.BDE ? actor.id : scopedFilters.employeeId;
  return dashboardRepo.findLeadAgingBuckets({ ...scopedFilters, employeeId });
}

export async function getKpiTargets(actor, queryFilters) {
  const scopedFilters = applyRoleScopingGuard(actor, queryFilters);
  const dateRange     = getDateRangeForPeriod(scopedFilters);
  const employeeId    = actor.primaryRoleRank <= ROLE_RANKS.BDE ? actor.id : undefined;
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
