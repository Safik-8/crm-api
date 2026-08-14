// crm-api/src/modules/salesPerformance/salesPerformance.controllers.js

import { sendSuccess } from "../../utils/response.js";
import * as salesPerformanceService from "./salesPerformance.services.js";

/**
 * Controller: Get BDE Performance Report
 */
export async function getBDEPerformance(req, res, next) {
  try {
    const report = await salesPerformanceService.getBDEPerformanceReport(req.user, req.query);
    return sendSuccess(res, report, "BDE performance report fetched successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: Get ISE Performance Report
 */
export async function getISEPerformance(req, res, next) {
  try {
    const report = await salesPerformanceService.getISEPerformanceReport(req.user, req.query);
    return sendSuccess(res, report, "ISE performance report fetched successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: Get Team Performance Report
 */
export async function getTeamPerformance(req, res, next) {
  try {
    const report = await salesPerformanceService.getTeamPerformanceReport(req.user, req.query);
    return sendSuccess(res, report, "Team performance report fetched successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: Get Branch Performance Report
 */
export async function getBranchPerformance(req, res, next) {
  try {
    const report = await salesPerformanceService.getBranchPerformanceReport(req.user, req.query);
    return sendSuccess(res, report, "Branch performance report fetched successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: Get Performance Rankings & Leaderboards
 */
export async function getPerformanceRankings(req, res, next) {
  try {
    const rankings = await salesPerformanceService.getPerformanceRankings(req.user, req.query);
    return sendSuccess(res, rankings, "Performance rankings fetched successfully");
  } catch (error) {
    next(error);
  }
}
