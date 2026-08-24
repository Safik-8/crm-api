// crm-api/src/modules/revenueReport/revenueReport.routes.js

import { Router } from "express";
import { authenticate } from "../../middleware/Authenticate.js";
import { hasPermission } from "../../middleware/hasPermission.js";
import {
  revenueFilterQuerySchema,
  createExportLogSchema,
  validateQuery,
  validateBody
} from "./revenueReport.validation.js";
import * as revenueReportController from "./revenueReport.controllers.js";

const router = Router();

// Protect all routes with authentication
router.use(authenticate);

// RBAC & Permission Protected Endpoints
router.get(
  "/summary",
  hasPermission("REVENUE_REPORT", "canView"),
  validateQuery(revenueFilterQuerySchema),
  revenueReportController.getRevenueSummary
);

router.get(
  "/monthly",
  hasPermission("REVENUE_REPORT", "canView"),
  validateQuery(revenueFilterQuerySchema),
  revenueReportController.getMonthlyRevenue
);

router.get(
  "/quarterly",
  hasPermission("REVENUE_REPORT", "canView"),
  validateQuery(revenueFilterQuerySchema),
  revenueReportController.getQuarterlyRevenue
);

router.get(
  "/product",
  hasPermission("REVENUE_REPORT", "canView"),
  validateQuery(revenueFilterQuerySchema),
  revenueReportController.getProductRevenue
);

router.get(
  "/team",
  hasPermission("REVENUE_REPORT", "canView"),
  validateQuery(revenueFilterQuerySchema),
  revenueReportController.getTeamRevenue
);

router.get(
  "/branch",
  hasPermission("REVENUE_REPORT", "canView"),
  validateQuery(revenueFilterQuerySchema),
  revenueReportController.getBranchRevenue
);

router.get(
  "/trend",
  hasPermission("REVENUE_REPORT", "canView"),
  validateQuery(revenueFilterQuerySchema),
  revenueReportController.getRevenueTrend
);

router.post(
  "/export-log",
  hasPermission("REVENUE_REPORT", "canCreate"),
  validateBody(createExportLogSchema),
  revenueReportController.logExportAction
);

export default router;
