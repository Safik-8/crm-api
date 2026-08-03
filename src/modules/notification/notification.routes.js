import { Router } from "express";
import { authenticate }  from "../../middleware/Authenticate.js";
import { hasPermission } from "../../middleware/hasPermission.js";
import {
  getNotifications, getUnreadCount, getReminderSummary,
  markAsRead, markAllRead, deleteNotif, deleteAllNotifs,
} from "./notification.controller.js";

const router = Router();
router.use(authenticate);

// ── Lightweight badge (all authenticated users, no RBAC gate) ─────────────────
router.get("/unread-count",      getUnreadCount);

// ── Reminder summary for dashboard widget ─────────────────────────────────────
router.get("/reminder-summary",  hasPermission("NOTIFICATION", "canView"),   getReminderSummary);

// ── Full paginated list ────────────────────────────────────────────────────────
router.get("/",                  hasPermission("NOTIFICATION", "canView"),   getNotifications);

// ── Mark operations (CRITICAL: /read-all BEFORE /:id) ─────────────────────────
router.patch("/read-all",        hasPermission("NOTIFICATION", "canEdit"),   markAllRead);
router.patch("/:id/read",        hasPermission("NOTIFICATION", "canEdit"),   markAsRead);

// ── Delete operations (CRITICAL: /clear-all BEFORE /:id) ──────────────────────
router.delete("/clear-all",      hasPermission("NOTIFICATION", "canEdit"),   deleteAllNotifs);
router.delete("/:id",            hasPermission("NOTIFICATION", "canEdit"),   deleteNotif);

export default router;
