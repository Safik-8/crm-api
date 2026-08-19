// crm-api/src/modules/revenueReport/revenueReport.controllers.js

import { sendSuccess } from "../../utils/response.js";
import * as revenueReportService from "./revenueReport.services.js";

/**
 * Controller: Get Revenue Summary KPIs
 */
export async function getRevenueSummary(req, res, next) {
  try {
    const data = await revenueReportService.getRevenueSummary(req.user, req.query);
    return sendSuccess(res, data, "Revenue summary fetched successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: Get Monthly Revenue Statement Report
 */
export async function getMonthlyRevenue(req, res, next) {
  try {
    const data = await revenueReportService.getMonthlyRevenueReport(req.user, req.query);
    return sendSuccess(res, data, "Monthly revenue report fetched successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: Get Quarterly Revenue Report
 */
export async function getQuarterlyRevenue(req, res, next) {
  try {
    const data = await revenueReportService.getQuarterlyRevenueReport(req.user, req.query);
    return sendSuccess(res, data, "Quarterly revenue report fetched successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: Get Product Revenue Report
 */
export async function getProductRevenue(req, res, next) {
  try {
    const data = await revenueReportService.getProductRevenueReport(req.user, req.query);
    return sendSuccess(res, data, "Product revenue report fetched successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: Get Team Revenue Report
 */
export async function getTeamRevenue(req, res, next) {
  try {
    const data = await revenueReportService.getTeamRevenueReport(req.user, req.query);
    return sendSuccess(res, data, "Team revenue report fetched successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: Get Branch Revenue Report
 */
export async function getBranchRevenue(req, res, next) {
  try {
    const data = await revenueReportService.getBranchRevenueReport(req.user, req.query);
    return sendSuccess(res, data, "Branch revenue report fetched successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: Get Revenue Trend Visualization Data
 */
export async function getRevenueTrend(req, res, next) {
  try {
    const data = await revenueReportService.getRevenueTrendReport(req.user, req.query);
    return sendSuccess(res, data, "Revenue trend data fetched successfully");
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: Log Export Action & Audit Record
 */
export async function logExportAction(req, res, next) {
  try {
    const data = await revenueReportService.logExportAction(req.user, req.body);
    return sendSuccess(res, data, "Export action logged successfully", 201);
  } catch (error) {
    next(error);
  }
}
