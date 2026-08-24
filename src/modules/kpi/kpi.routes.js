// BackEnd/src/modules/kpi/kpi.routes.js

import { Router } from "express";
import { authenticate } from "../../middleware/Authenticate.js";
import { hasPermission } from "../../middleware/hasPermission.js";
import * as kpiController from "./kpi.controller.js";

const router = Router();

// Protect all KPI endpoints with authentication middleware
router.use(authenticate);

// KPI Dashboard & Performance endpoints
router.get("/dashboard", hasPermission("KPI", "canView"), kpiController.getKpiDashboard);
router.get("/my-performance", hasPermission("KPI", "canView"), kpiController.getKpiDashboard);
router.get("/analytics", hasPermission("KPI", "canView"), kpiController.getKpiDashboard);

// KPI Target Detail (accessible for drill down)
router.get("/targets/:id", hasPermission("KPI", "canView"), kpiController.getKpiDetail);

// Create KPI Target (requires manage/create permissions)
router.post("/targets", hasPermission("KPI", "canManage"), kpiController.createKpiTarget);

// Update KPI Target
router.put("/targets/:id", hasPermission("KPI", "canManage"), kpiController.updateKpiTarget);

// Soft Delete KPI Target
router.delete("/targets/:id", hasPermission("KPI", "canManage"), kpiController.deleteKpiTarget);

// Export KPI Report Data
router.get("/export", hasPermission("KPI", "canView"), kpiController.exportKpiData);

export default router;
