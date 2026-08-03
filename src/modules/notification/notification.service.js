import { BadRequestError, ForbiddenError, NotFoundError } from "../../utils/AppError.js";
import {
  findNotifications, countNotifications, countUnread,
  findNotificationById, updateNotificationDb, markAllReadDb,
  deleteNotificationDb, deleteAllNotificationsDb, fetchReminderSummary,
} from "./notification.repository.js";

// ── SCOPE BUILDER ─────────────────────────────────────────────────────────────
/**
 * Scope builder for user notification center.
 * Notifications in the user drawer are strictly personal — each user sees only
 * notifications generated for their userId, bounded by tenant isolation.
 */
const buildNotifScope = (actor) => {
  const scope = { userId: actor.id };
  if (actor.companyId) scope.companyId = actor.companyId;
  return scope;
};

// ── SERVICE FUNCTIONS ─────────────────────────────────────────────────────────

export const getNotificationsService = async (query, actor) => {
  const perm = actor.permissions?.NOTIFICATION;
  // Allow SA/CA by role name (they bypass hasPermission middleware already,
  // but may have custom DB rows without canView if created via non-seeded path)
  const isSupervisor = actor.primaryRole === "SUPER_ADMIN" || actor.primaryRole === "COMPANY_ADMIN";
  if (!isSupervisor && !perm?.canView) {
    throw new ForbiddenError("You do not have permission to view notifications");
  }

  const where = buildNotifScope(actor);

  // Optional filters
  if (query.status && ["UNREAD", "READ"].includes(query.status)) {
    where.status = query.status;
  }
  const VALID_TYPES = ["REMINDER", "OVERDUE_ALERT", "ASSIGNMENT_ALERT", "FOLLOWUP_ALERT"];
  if (query.notificationType && VALID_TYPES.includes(query.notificationType)) {
    where.notificationType = query.notificationType;
  }

  // ── Date window filter ────────────────────────────────────────────────────
  // UNREAD notifications are ALWAYS included regardless of age so the bell badge
  // count matches the drawer unread count 100%.
  // daysLimit=3 (default) filters READ notifications to the past 3 days.
  // daysLimit=0 disables the date filter (used by "Load Older" infinite scroll).
  const daysLimit = Number(query.daysLimit ?? 3);
  if (daysLimit > 0) {
    const since = new Date(Date.now() - daysLimit * 24 * 60 * 60 * 1000);
    if (query.status === "READ") {
      where.createdAt = { gte: since };
    } else if (!query.status) {
      where.OR = [
        { status: "UNREAD" },
        { status: "READ", createdAt: { gte: since } },
      ];
    }
  }

  const page  = Math.max(1, Number(query.page)  || 1);
  const limit = Math.min(100, Number(query.limit) || 50);
  const skip  = (page - 1) * limit;

  const [notifications, total, unreadCount] = await Promise.all([
    findNotifications(where, skip, limit),
    countNotifications(where),
    countUnread(buildNotifScope(actor)),
  ]);

  const totalPages = Math.ceil(total / limit);
  return {
    notifications,
    unreadCount,
    pagination: { page, limit, total, totalPages, hasMore: page < totalPages },
  };
};

export const getUnreadCountService = async (actor) => {
  if (!actor) throw new ForbiddenError("Authentication required");
  const where = buildNotifScope(actor);
  const count = await countUnread(where);
  return { unreadCount: count };
};


export const getReminderSummaryService = async (actor) => {
  const perm = actor.permissions?.NOTIFICATION;
  if (!perm?.canView) throw new ForbiddenError("You do not have permission to view reminders");
  // Summary is always user-scoped (actor's own assigned followups)
  return fetchReminderSummary(actor.id);
};

export const markNotificationReadService = async (id, actor) => {
  const perm = actor.permissions?.NOTIFICATION;
  if (!perm?.canEdit) throw new ForbiddenError("You do not have permission to update notifications");

  const notifId = Number(id);
  if (!Number.isInteger(notifId) || notifId < 1) throw new BadRequestError("Invalid notification ID");

  const notif = await findNotificationById(notifId);
  if (!notif) throw new NotFoundError("Notification");

  // Personal ownership guard: users can only update notifications sent to them
  if (notif.userId !== actor.id && actor.primaryRole !== "SUPER_ADMIN") {
    throw new ForbiddenError("You can only update your own notifications");
  }

  return updateNotificationDb(notifId, { status: "READ", readAt: new Date() });
};

export const markAllReadService = async (actor) => {
  const perm = actor.permissions?.NOTIFICATION;
  if (!perm?.canEdit) throw new ForbiddenError("You do not have permission to update notifications");

  await markAllReadDb(actor.id);
  return { success: true, message: "All notifications marked as read" };
};

export const deleteNotificationService = async (id, actor) => {
  const perm = actor.permissions?.NOTIFICATION;
  // Require canEdit OR canDelete — canView alone is NOT sufficient to delete
  const isSupervisor = actor.primaryRole === "SUPER_ADMIN" || actor.primaryRole === "COMPANY_ADMIN";
  if (!isSupervisor && !perm?.canEdit && !perm?.canDelete) {
    throw new ForbiddenError("You do not have permission to delete notifications");
  }

  const notifId = Number(id);
  if (!Number.isInteger(notifId) || notifId < 1) throw new BadRequestError("Invalid notification ID");

  const notif = await findNotificationById(notifId);
  if (!notif) throw new NotFoundError("Notification");

  // Personal ownership guard: users can only delete notifications sent to them
  if (notif.userId !== actor.id && actor.primaryRole !== "SUPER_ADMIN") {
    throw new ForbiddenError("You can only delete your own notifications");
  }

  await deleteNotificationDb(notifId);
  return { success: true, message: "Notification deleted" };
};

export const deleteAllNotificationsService = async (actor) => {
  const perm = actor.permissions?.NOTIFICATION;
  // Require canEdit OR canDelete — canView alone is NOT sufficient to clear all
  const isSupervisor = actor.primaryRole === "SUPER_ADMIN" || actor.primaryRole === "COMPANY_ADMIN";
  if (!isSupervisor && !perm?.canEdit && !perm?.canDelete) {
    throw new ForbiddenError("You do not have permission to delete notifications");
  }

  await deleteAllNotificationsDb(actor.id);
  return { success: true, message: "All notifications deleted successfully" };
};
