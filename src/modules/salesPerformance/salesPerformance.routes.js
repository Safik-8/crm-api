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
router.get("/bde", hasPermission("REPORT", "canView"), validateQuery(performanceFilterQuerySchema), salesPerformanceController.getBDEPerformance);
router.get("/ise", hasPermission("REPORT", "canView"), validateQuery(performanceFilterQuerySchema), salesPerformanceController.getISEPerformance);
router.get("/team", hasPermission("REPORT", "canView"), validateQuery(performanceFilterQuerySchema), salesPerformanceController.getTeamPerformance);
router.get("/branch", hasPermission("REPORT", "canView"), validateQuery(performanceFilterQuerySchema), salesPerformanceController.getBranchPerformance);
router.get("/rankings", hasPermission("REPORT", "canView"), validateQuery(performanceFilterQuerySchema), salesPerformanceController.getPerformanceRankings);

export default router;
