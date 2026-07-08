import { sendSuccess } from "../../utils/response.js"
import {
  submitDailyBranchReportService,
  getDailyBranchReportsService,
  getDashboardReportsService
} from "./dailyBranchReport.service.js"

export const submitDailyBranchReport = async (req, res, next) => {
  try {
     await submitDailyBranchReportService(req.body, req.user);
     return sendSuccess(res, {}, "Form filled successfully", 201);
  } catch (err) { next(err) }
}

export const getDailyBranchReports = async (req, res, next) => {
  try {
    const result = await getDailyBranchReportsService(req.query, req.user);
    return sendSuccess(res, result, "Daily branch reports fetched successfully", 200);
  } catch (err) { next(err) }
}

export const getDashboardReports = async (req, res, next) => {
  try {
    const result = await getDashboardReportsService(req.query, req.user);
    return sendSuccess(res, result, "Dashboard data fetched successfully", 200);
  } catch (err) { next(err) }
}
