import { BadRequestError, ForbiddenError, NotFoundError } from "../../utils/AppError.js";
import { emitToUser } from "../../sockets/socket.emitter.js";
import {
  findNotifications, countNotifications, countUnread,
  findNotificationById, updateNotificationDb, markAllReadDb,
  deleteNotificationDb, deleteAllNotificationsDb, fetchReminderSummary,
  findNotificationConfigs, updateNotificationConfigDb,
} from "./notification.repository.js";

// ── SCOPE BUILDER ─────────────────────────────────────────────────────────────
/**
 * Dual-Scope HRBAC Scoping Guard
 *
 * Scope "personal" (default): strictly isolated to userId = actor.id
 * Scope "company": audit view for Company Admin / Super Admin (Rank >= 80)
 * Scope "branch": audit view for Branch Manager / Company Admin (Rank >= 60)
 *
 * Reps (BDE/ISE, Rank < 60) requesting company or branch scope get 403 Forbidden!
 */
const buildNotifScope = (actor, query = {}) => {
  const scopeType = query.scope || "personal";

  // Reps (BDE/ISE, Rank < 60) requesting company or branch scope get 403 Forbidden
  if (scopeType !== "personal" && actor.primaryRoleRank < 60) {
    throw new ForbiddenError("Access denied: You do not have permission to view company or branch notification audits.");
  }

  const where = {};

  if (scopeType === "company") {
    if (actor.primaryRoleRank < 61) {
      throw new ForbiddenError("Access denied: Only Company Admin and Super Admin can access company-wide notification audits.");
    }
    if (actor.companyId && actor.primaryRoleRank < 100) {
      where.companyId = actor.companyId;
    }
  } else if (scopeType === "branch") {
    if (actor.companyId && actor.primaryRoleRank < 100) {
      where.companyId = actor.companyId;
    }
    if (actor.branchId) {
      where.branchId = actor.branchId;
    }
  } else {
    // Default "personal" scope
    where.userId = actor.id;
    if (actor.companyId) where.companyId = actor.companyId;
  }

  return where;
};

// ── SERVICE FUNCTIONS ─────────────────────────────────────────────────────────

export const getNotificationsService = async (query, actor) => {
  if (!actor) {
    throw new ForbiddenError("Authentication required to view notifications");
  }

  const where = buildNotifScope(actor, query);

  // Status Filter
  if (query.status === "UNREAD") {
    where.OR = [{ status: "UNREAD" }, { isRead: false }];
  } else if (query.status === "READ") {
    where.OR = [{ status: "READ" }, { isRead: true }];
  }

  // Priority Filter
  if (query.priority && ["URGENT", "HIGH", "MEDIUM", "LOW"].includes(query.priority)) {
    where.priority = query.priority;
  }

  // Module Filter
  if (query.moduleName) {
    where.moduleName = query.moduleName;
  }

  // Text Search across title & message
  if (query.search && query.search.trim()) {
    const q = query.search.trim();
    where.AND = [
      {
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { message: { contains: q, mode: "insensitive" } },
        ],
      },
    ];
  }

  // Date Range Filter
  if (query.startDate || query.endDate) {
    where.createdAt = {};
    if (query.startDate) where.createdAt.gte = new Date(query.startDate);
    if (query.endDate) {
      const end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  } else {
    // Default days window for personal drawer
    const daysLimit = Number(query.daysLimit ?? 3);
    if (daysLimit > 0 && query.scope === "personal") {
      const since = new Date(Date.now() - daysLimit * 24 * 60 * 60 * 1000);
      if (query.status === "READ") {
        where.createdAt = { gte: since };
      } else if (!query.status || query.status === "ALL") {
        where.OR = [
          { status: "UNREAD" },
          { isRead: false },
          { status: "READ", createdAt: { gte: since } },
        ];
      }
    }
  }

  const page  = Math.max(1, Number(query.page)  || 1);
  const limit = Math.min(100, Number(query.limit) || 50);
  const skip  = (page - 1) * limit;

  const [notifications, total, unreadCount] = await Promise.all([
    findNotifications(where, skip, limit),
    countNotifications(where),
    countUnread({ userId: actor.id, ...(actor.companyId ? { companyId: actor.companyId } : {}) }),
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
  const count = await countUnread({
    userId: actor.id,
    ...(actor.companyId ? { companyId: actor.companyId } : {}),
  });
  return { unreadCount: count };
};

export const getReminderSummaryService = async (actor) => {
  if (!actor) throw new ForbiddenError("Authentication required");
  return fetchReminderSummary(actor);
};

export const markNotificationReadService = async (id, actor) => {
  const notifId = Number(id);
  if (!Number.isInteger(notifId) || notifId < 1) throw new BadRequestError("Invalid notification ID");

  const notif = await findNotificationById(notifId);
  if (!notif) throw new NotFoundError("Notification");

  // Personal ownership guard: users can update notifications sent to them or supervisors (rank >= 61)
  if (notif.userId !== actor.id && actor.primaryRoleRank < 61) {
    throw new ForbiddenError("You can only update your own notifications");
  }

  const updated = await updateNotificationDb(notifId, { status: "READ", isRead: true, readAt: new Date() });
  try {
    const unread = await countUnread({ userId: actor.id, ...(actor.companyId ? { companyId: actor.companyId } : {}) });
    emitToUser(actor.id, "notification:count", { unreadCount: unread });
  } catch (_) {}
  return updated;
};

export const markAllReadService = async (actor) => {
  await markAllReadDb(actor.id);
  try {
    emitToUser(actor.id, "notification:count", { unreadCount: 0 });
  } catch (_) {}
  return { success: true, message: "All notifications marked as read" };
};

export const deleteNotificationService = async (id, actor) => {
  const notifId = Number(id);
  if (!Number.isInteger(notifId) || notifId < 1) throw new BadRequestError("Invalid notification ID");

  const notif = await findNotificationById(notifId);
  if (!notif) throw new NotFoundError("Notification");

  // Personal ownership guard: users can delete their own personal notifications OR supervisors (rank >= 61)
  if (notif.userId !== actor.id && actor.primaryRoleRank < 61) {
    throw new ForbiddenError("You can only delete your own notifications");
  }

  await deleteNotificationDb(notifId);
  try {
    const unread = await countUnread({ userId: actor.id, ...(actor.companyId ? { companyId: actor.companyId } : {}) });
    emitToUser(actor.id, "notification:count", { unreadCount: unread });
  } catch (_) {}
  return { success: true, message: "Notification deleted" };
};

export const deleteAllNotificationsService = async (actor) => {
  await deleteAllNotificationsDb(actor.id);
  try {
    emitToUser(actor.id, "notification:count", { unreadCount: 0 });
  } catch (_) {}
  return { success: true, message: "All personal notifications deleted successfully" };
};

// ── NOTIFICATION EVENT CONFIG SERVICES ────────────────────────────────────────

export const getNotificationConfigsService = async (actor) => {
  if (actor.primaryRoleRank < 61) {
    throw new ForbiddenError("Access denied: Only Company Admin and Super Admin can access event configurations.");
  }
  return findNotificationConfigs(actor.companyId);
};

export const updateNotificationConfigService = async (id, body, actor) => {
  if (actor.primaryRoleRank < 61) {
    throw new ForbiddenError("Access denied: Only Company Admin and Super Admin can modify event configurations.");
  }
  const configId = Number(id);
  if (!Number.isInteger(configId) || configId < 1) throw new BadRequestError("Invalid config ID");

  return updateNotificationConfigDb(configId, body);
};
