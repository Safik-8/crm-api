import { Router } from "express";
import { authenticate } from "../../middleware/Authenticate.js";
import {
  getAuditLogs,
  getAuditLogById,
  exportAuditLogs,
} from "./auditLog.controller.js";

const router = Router();

// All routes require valid authentication
router.use(authenticate);

const getActorRole = (user) => (user?.primaryRole || user?.role || "").toUpperCase();

/**
 * Access Control Middleware:
 * Restrict access strictly to Super Admin and Company Admin.
 */
const requireAdminAccess = (req, res, next) => {
  const role = getActorRole(req.user);
  if (role === "SUPER_ADMIN" || role === "COMPANY_ADMIN") {
    return next();
  }
  return res.status(403).json({
    success: false,
    statusCode: 403,
    code: "FORBIDDEN",
    message: "Access Denied: Audit log monitoring is restricted to Super Admin and Company Admin.",
  });
};

/**
 * Access Control Middleware:
 * Restrict export strictly to Super Admin.
 */
const requireSuperAdminAccess = (req, res, next) => {
  const role = getActorRole(req.user);
  if (role === "SUPER_ADMIN") {
    return next();
  }
  return res.status(403).json({
    success: false,
    statusCode: 403,
    code: "FORBIDDEN",
    message: "Access Denied: Exporting audit logs is strictly restricted to Super Admin.",
  });
};

// GET /api/v1/audit-logs & /api/audit-logs — Paginated list with filters
router.get("/", requireAdminAccess, getAuditLogs);

// GET /api/v1/audit-logs/export & /api/audit-logs/export — File export (Super Admin only)
router.get("/export", requireAdminAccess, requireSuperAdminAccess, exportAuditLogs);

// GET /api/v1/audit-logs/:id & /api/audit-logs/:id — Single record details
router.get("/:id", requireAdminAccess, getAuditLogById);

export default router;
