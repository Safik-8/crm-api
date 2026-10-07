import { Router } from "express";
import { authenticate } from "../../middleware/Authenticate.js";
import {
  getNotificationsQuerySchema,
  updateNotificationConfigSchema,
  validateQuery,
  validateBody,
} from "./notification.validation.js";
import {
  getNotifications,
  getUnreadCount,
  getReminderSummary,
  markAsRead,
  markAllRead,
  deleteNotif,
  deleteAllNotifs,
  getNotificationConfigs,
  updateNotificationConfig,
} from "./notification.controller.js";

const router = Router();
router.use(authenticate);

// ── Admin guard for configuration management ───────────────────────────────
const requireNotificationAdmin = (req, res, next) => {
  const role = (req.user?.primaryRole || req.user?.role || "").toUpperCase();
  const rank = Number(req.user?.primaryRoleRank ?? 0);
  if (role === "SUPER_ADMIN" || role === "COMPANY_ADMIN" || rank >= 61) {
    return next();
  }
  return res.status(403).json({
    success: false,
    statusCode: 403,
    code: "FORBIDDEN",
    message: "Access Denied: Notification configuration is restricted to administrators.",
  });
};

// ── Unread Badge Counter (All authenticated users) ──────────────────────────
router.get("/unread-count", getUnreadCount);

// ── Reminder summary for dashboard widget ───────────────────────────────────
router.get("/reminder-summary", getReminderSummary);

// ── Notification Event Configurations (Admin Only, guarded in service) ───────
router.get("/configs", requireNotificationAdmin, getNotificationConfigs);
router.patch("/configs/:id", requireNotificationAdmin, validateBody(updateNotificationConfigSchema), updateNotificationConfig);

// ── Full paginated list & audit history (Personal by default, scoped in service)
router.get(
  "/",
  validateQuery(getNotificationsQuerySchema),
  getNotifications
);

// ── Mark operations (CRITICAL: /read-all BEFORE /:id) ───────────────────────
router.patch("/read-all", markAllRead);
router.patch("/:id/read", markAsRead);

// ── Delete operations (CRITICAL: /clear-all BEFORE /:id) ────────────────────
router.delete("/clear-all", deleteAllNotifs);
router.delete("/:id", deleteNotif);

export default router;

