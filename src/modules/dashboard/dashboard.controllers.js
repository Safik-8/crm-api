// crm-api/src/modules/dashboard/dashboard.controllers.js
import { sendSuccess } from "../../utils/response.js";
import * as dashboardService from "./dashboard.services.js";

export async function getDashboardMetrics(req, res, next) {
  try {
    const data = await dashboardService.getDashboardMetrics(req.user, req.query);
    return sendSuccess(res, data, "Dashboard metrics fetched successfully");
  } catch (error) { next(error); }
}

export async function getLeadAging(req, res, next) {
  try {
    const data = await dashboardService.getLeadAgingBuckets(req.user, req.query);
    return sendSuccess(res, data, "Lead aging data fetched");
  } catch (error) { next(error); }
}

export async function getKpiTargets(req, res, next) {
  try {
    const data = await dashboardService.getKpiTargets(req.user, req.query);
    return sendSuccess(res, data, "KPI targets fetched");
  } catch (error) { next(error); }
}

export async function getActivityFeed(req, res, next) {
  try {
    const data = await dashboardService.getActivityFeed(req.user, req.query);
    return sendSuccess(res, data, "Activity feed fetched");
  } catch (error) { next(error); }
}

export async function getCallQueue(req, res, next) {
  try {
    const data = await dashboardService.getCallQueue(req.user, req.query);
    return sendSuccess(res, data, "Call queue fetched");
  } catch (error) { next(error); }
}
