import { Router } from "express"
import { authenticate } from "../../middleware/Authenticate.js"
import { authorize } from "../../middleware/authorize.js"
import { submitDailyBranchReport, getDailyBranchReports, getDashboardReports } from "./dailyBranchReport.controller.js"

const router = Router()

router.use(authenticate)

const canViewDailyReports = (req, res, next) => {
  const allowedRoles = ["SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER"];
  const userRoles = (req.user?.allRoles || []).map(r => r.name);
  const isAllowedRole = allowedRoles.some(r => userRoles.includes(r));
  const hasManagerRank = (req.user?.primaryRoleRank || 0) >= 60;
  const hasReportPerm = Boolean(req.user?.permissions?.REPORT?.canView);

  if (isAllowedRole || hasManagerRank || hasReportPerm) {
    return next();
  }
  return res.status(403).json({
    success: false,
    statusCode: 403,
    code: "FORBIDDEN",
    message: "Access denied: You do not have permission to view daily branch reports.",
  });
};

const canViewDashboardReports = (req, res, next) => {
  const allowedRoles = ["SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER", "ISE", "BDE"];
  const userRoles = (req.user?.allRoles || []).map(r => r.name);
  const isAllowedRole = allowedRoles.some(r => userRoles.includes(r));
  const hasValidRank = (req.user?.primaryRoleRank || 0) >= 20;

  if (isAllowedRole || hasValidRank) {
    return next();
  }
  return res.status(403).json({
    success: false,
    statusCode: 403,
    code: "FORBIDDEN",
    message: "Access denied: You do not have permission to view dashboard reports.",
  });
};

router.post("/submit",      authorize("ISE"),        submitDailyBranchReport)
router.get("/get-reports",  canViewDailyReports,     getDailyBranchReports)
router.get("/dashboard",    canViewDashboardReports, getDashboardReports)

export default router

