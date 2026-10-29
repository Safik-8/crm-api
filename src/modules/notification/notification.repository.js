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
    where: { userId, isRead: false },
    data:  { status: "READ", isRead: true, readAt: new Date() },
  });

export const deleteNotificationDb = (id) =>
  prisma.notification.delete({ where: { id } });

export const deleteAllNotificationsDb = (userId) =>
  prisma.notification.deleteMany({ where: { userId } });

// ── NOTIFICATION CONFIGS ──────────────────────────────────────────────────────
export const findNotificationConfigs = (companyId) =>
  prisma.notificationEventConfig.findMany({
    where: companyId ? { companyId } : {},
    orderBy: { moduleName: "asc" },
  });

export const updateNotificationConfigDb = (id, data) =>
  prisma.notificationEventConfig.update({ where: { id }, data });

// ── SCANNER HELPERS ───────────────────────────────────────────────────────────

/**
 * Deduplication: returns existing notification for this user + followup + type.
 * Handles both job token names ("REMINDER", "OVERDUE_ALERT") and DB eventType names
 * ("FOLLOWUP_REMINDER", "FOLLOWUP_MISSED") to prevent duplicate alerts on scanner runs.
 */
export const findExistingNotif = (userId, followupId, notificationType) => {
  const isReminder = notificationType === "REMINDER" || notificationType === "FOLLOWUP_REMINDER";
  const isMissed   = notificationType === "OVERDUE_ALERT" || notificationType === "FOLLOWUP_MISSED";
  const types      = isReminder
    ? ["REMINDER", "FOLLOWUP_REMINDER"]
    : isMissed
    ? ["OVERDUE_ALERT", "FOLLOWUP_MISSED"]
    : [notificationType];

  return prisma.notification.findFirst({
    where: {
      ...(userId ? { userId } : {}),
      followupId,
      notificationType: { in: types },
      ...(isReminder ? { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } : {}),
    },
  });
};

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
      lead:        { isDeleted: false },
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
      lead:        { isDeleted: false },
    },
    include: {
      assignedTo: { select: { id: true, name: true, companyId: true, branchId: true } },
      lead:       { select: { id: true, name: true } },
    },
  });


/**
 * Fetch summary counts for the dashboard reminder widget.
 * Respects role scoping:
 * - Super Admin: global or company
 * - Company Admin: company-wide
 * - Branch Manager: branch-wide
 * - Reps (BDE/ISE): assigned to user
 * Returns: { todayCount, upcomingCount, overdueCount, total }
 */
export const fetchReminderSummary = async (actor) => {
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));
  const todayEnd     = new Date(new Date().setHours(23, 59, 59, 999));

  const scopeWhere = {};

  if (typeof actor === "object" && actor !== null) {
    if (actor.companyId && (actor.primaryRoleRank ?? 0) < 100) {
      scopeWhere.companyId = actor.companyId;
    }
    // Branch Manager & Branch Custom Roles (Rank 41..60)
    if (actor.branchId && (actor.primaryRoleRank ?? 0) <= 60 && (actor.primaryRoleRank ?? 0) >= 41) {
      scopeWhere.branchId = actor.branchId;
    }
    // BDE Tier (Rank 21..40 or primaryRole === "BDE")
    if (actor.primaryRole === "BDE" || ((actor.primaryRoleRank ?? 0) >= 21 && (actor.primaryRoleRank ?? 0) <= 40)) {
      const team = await prisma.team.findFirst({
        where: { bdeId: actor.id, isDeleted: false },
        include: { members: { where: { removedAt: null }, select: { userId: true } } },
      });
      const teamIds = team ? [actor.id, ...team.members.map((m) => m.userId)] : [actor.id];
      scopeWhere.OR = [
        { assignedToId: { in: teamIds } },
        { createdById: actor.id },
      ];
    } else if ((actor.primaryRoleRank ?? 0) <= 20) {
      // ISE & Personal Reps: own assigned only
      scopeWhere.assignedToId = actor.id;
    }
  } else if (typeof actor === "number") {
    scopeWhere.assignedToId = actor;
  }

  const [todayCount, upcomingCount, overdueCount] = await Promise.all([
    prisma.followup.count({
      where: {
        AND: [
          scopeWhere,
          { status: "PENDING" },
          { scheduledAt: { gte: startOfToday, lte: todayEnd } },
        ],
      },
    }),
    prisma.followup.count({
      where: {
        AND: [
          scopeWhere,
          { status: "PENDING" },
          { scheduledAt: { gt: todayEnd } },
        ],
      },
    }),
    prisma.followup.count({
      where: {
        AND: [
          scopeWhere,
          {
            OR: [
              { status: "MISSED" },
              { status: "PENDING", scheduledAt: { lt: startOfToday } },
            ],
          },
        ],
      },
    }),
  ]);

  return {
    todayCount,
    upcomingCount,
    overdueCount,
    total: todayCount + upcomingCount + overdueCount,
  };
};
