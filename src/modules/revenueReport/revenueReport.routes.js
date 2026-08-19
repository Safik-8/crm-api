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
  hasPermission("REPORT", "canView"),
  validateQuery(revenueFilterQuerySchema),
  revenueReportController.getRevenueSummary
);

router.get(
  "/monthly",
  hasPermission("REPORT", "canView"),
  validateQuery(revenueFilterQuerySchema),
  revenueReportController.getMonthlyRevenue
);

router.get(
  "/quarterly",
  hasPermission("REPORT", "canView"),
  validateQuery(revenueFilterQuerySchema),
  revenueReportController.getQuarterlyRevenue
);

router.get(
  "/product",
  hasPermission("REPORT", "canView"),
  validateQuery(revenueFilterQuerySchema),
  revenueReportController.getProductRevenue
);

router.get(
  "/team",
  hasPermission("REPORT", "canView"),
  validateQuery(revenueFilterQuerySchema),
  revenueReportController.getTeamRevenue
);

router.get(
  "/branch",
  hasPermission("REPORT", "canView"),
  validateQuery(revenueFilterQuerySchema),
  revenueReportController.getBranchRevenue
);

router.get(
  "/trend",
  hasPermission("REPORT", "canView"),
  validateQuery(revenueFilterQuerySchema),
  revenueReportController.getRevenueTrend
);

router.post(
  "/export-log",
  hasPermission("REPORT", "canCreate"),
  validateBody(createExportLogSchema),
  revenueReportController.logExportAction
);

export default router;
