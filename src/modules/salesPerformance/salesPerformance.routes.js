// crm-api/src/modules/salesPerformance/salesPerformance.routes.js

import { Router } from "express";
import { authenticate } from "../../middleware/Authenticate.js";
import { hasPermission } from "../../middleware/hasPermission.js";
import { performanceFilterQuerySchema, validateQuery } from "./salesPerformance.validation.js";
import * as salesPerformanceController from "./salesPerformance.controllers.js";

const router = Router();

// Protect all routes with authentication
router.use(authenticate);

// RBAC Protected endpoints using singular MODULE: 'REPORT'
router.get("/bde", hasPermission("SALES_PERFORMANCE", "canView"), validateQuery(performanceFilterQuerySchema), salesPerformanceController.getBDEPerformance);
router.get("/ise", hasPermission("SALES_PERFORMANCE", "canView"), validateQuery(performanceFilterQuerySchema), salesPerformanceController.getISEPerformance);
router.get("/team", hasPermission("SALES_PERFORMANCE", "canView"), validateQuery(performanceFilterQuerySchema), salesPerformanceController.getTeamPerformance);
router.get("/branch", hasPermission("SALES_PERFORMANCE", "canView"), validateQuery(performanceFilterQuerySchema), salesPerformanceController.getBranchPerformance);
router.get("/rankings", hasPermission("SALES_PERFORMANCE", "canView"), validateQuery(performanceFilterQuerySchema), salesPerformanceController.getPerformanceRankings);
router.post("/export-log", hasPermission("SALES_PERFORMANCE", "canView"), salesPerformanceController.logExportAction);

export default router;

