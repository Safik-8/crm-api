import { Router } from "express";
import { authenticate } from "../../middleware/Authenticate.js";
import { hasPermission } from "../../middleware/hasPermission.js";
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

// ── Unread Badge Counter (All authenticated users) ──────────────────────────
router.get("/unread-count", getUnreadCount);

// ── Reminder summary for dashboard widget ───────────────────────────────────
router.get("/reminder-summary", getReminderSummary);

// ── Notification Event Configurations (Admin Only, guarded in service) ───────
router.get("/configs", getNotificationConfigs);
router.patch("/configs/:id", validateBody(updateNotificationConfigSchema), updateNotificationConfig);

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

