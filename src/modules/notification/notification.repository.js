import prisma from "../../config/db.js";

const NOTIFICATION_INCLUDE = {
  lead:     { select: { id: true, name: true } },
  followup: { select: { id: true, followupType: true, scheduledAt: true } },
  company:  { select: { id: true, name: true } },
  branch:   { select: { id: true, name: true } },
};

// ── CRUD ─────────────────────────────────────────────────────────────────────
export const findNotificationById = (id) =>
  prisma.notification.findUnique({ where: { id }, include: NOTIFICATION_INCLUDE });

export const findNotifications = (where, skip = 0, take = 50) =>
  prisma.notification.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    skip,
    take,
    include: NOTIFICATION_INCLUDE,
  });

export const countNotifications = (where) => prisma.notification.count({ where });

export const countUnread = (where) =>
  prisma.notification.count({ where: { ...where, status: "UNREAD" } });


export const createNotificationDb = (data) =>
  prisma.notification.create({ data, include: NOTIFICATION_INCLUDE });

export const updateNotificationDb = (id, data) =>
  prisma.notification.update({ where: { id }, data });

export const markAllReadDb = (userId) =>
  prisma.notification.updateMany({
    where: { userId, status: "UNREAD" },
    data:  { status: "READ", readAt: new Date() },
  });

export const deleteNotificationDb = (id) =>
  prisma.notification.delete({ where: { id } });

export const deleteAllNotificationsDb = (userId) =>
  prisma.notification.deleteMany({ where: { userId } });

// ── SCANNER HELPERS ───────────────────────────────────────────────────────────

/**
 * Deduplication: returns existing notification for this user + followup + type
 * created today. Prevents duplicate alerts on every scanner run.
 */
export const findExistingNotif = (userId, followupId, notificationType) =>
  prisma.notification.findFirst({
    where: {
      userId,
      followupId,
      notificationType,
      createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
  });

/**
 * Fetch all PENDING followups due within the next `hoursAhead` hours.
 * Used by reminderJob.js to generate REMINDER notifications.
 * Includes assignedTo.name for the reminder message and scalar fields
 * (companyId, branchId, createdById) are auto-included by Prisma.
 */
export const findUpcomingFollowups = (hoursAhead = 24) => {
  const now    = new Date();
  const cutoff = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);
  return prisma.followup.findMany({
    where: {
      status:      "PENDING",
      scheduledAt: { gte: now, lte: cutoff },
    },
    include: {
      assignedTo: { select: { id: true, name: true, companyId: true, branchId: true } },
      lead:       { select: { id: true, name: true } },
    },
  });
};

/**
 * Fetch all PENDING/MISSED followups where scheduledAt < now (overdue).
 * Used by reminderJob.js to mark MISSED + generate OVERDUE_ALERT notifications.
 * Includes assignedTo.name for the overdue message.
 */
export const findOverdueFollowups = () =>
  prisma.followup.findMany({
    where: {
      status:      { in: ["PENDING", "MISSED"] },
      scheduledAt: { lt: new Date() },
    },
    include: {
      assignedTo: { select: { id: true, name: true, companyId: true, branchId: true } },
      lead:       { select: { id: true, name: true } },
    },
  });


/**
 * Fetch summary counts for the dashboard reminder widget.
 * Always user-scoped (assignedToId = userId) regardless of actor rank.
 * Returns: { todayCount, upcomingCount, overdueCount, total }
 */
export const fetchReminderSummary = async (userId) => {
  const now      = new Date();
  const todayEnd = new Date(new Date().setHours(23, 59, 59, 999));
  const baseWhere = { assignedToId: userId, status: "PENDING" };

  const [todayCount, upcomingCount, overdueCount] = await Promise.all([
    prisma.followup.count({ where: { ...baseWhere, scheduledAt: { gte: now, lte: todayEnd } } }),
    prisma.followup.count({ where: { ...baseWhere, scheduledAt: { gt: todayEnd } } }),
    prisma.followup.count({ where: { ...baseWhere, scheduledAt: { lt: now } } }),
  ]);

  return {
    todayCount,
    upcomingCount,
    overdueCount,
    total: todayCount + upcomingCount + overdueCount,
  };
};
