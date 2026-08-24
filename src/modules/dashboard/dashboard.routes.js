// crm-api/src/modules/dashboard/dashboard.routes.js
import { Router } from "express";
import { authenticate } from "../../middleware/Authenticate.js";
import { hasPermission } from "../../middleware/hasPermission.js";
import { dashboardQuerySchema, validateQuery } from "./dashboard.validation.js";
import * as dashboardController from "./dashboard.controllers.js";

const router = Router();
router.use(authenticate);
router.use(hasPermission("DASHBOARD", "canView"));

// Role scoping applied server-side via applyRoleScopingGuard
router.get("/metrics",       validateQuery(dashboardQuerySchema), dashboardController.getDashboardMetrics);
router.get("/lead-aging",    validateQuery(dashboardQuerySchema), dashboardController.getLeadAging);
router.get("/kpi-targets",   validateQuery(dashboardQuerySchema), dashboardController.getKpiTargets);
router.get("/activity-feed", validateQuery(dashboardQuerySchema), dashboardController.getActivityFeed);
router.get("/call-queue",    validateQuery(dashboardQuerySchema), dashboardController.getCallQueue);

export default router;
