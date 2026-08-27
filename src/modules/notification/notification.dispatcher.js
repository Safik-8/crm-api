import prisma from "../../config/db.js";
import { emitToUser } from "../../sockets/socket.emitter.js";

/**
 * Default event priority & module mapping catalog
 */
const EVENT_CATALOG = {
  LEAD_ASSIGNED:          { moduleName: "LEAD",        priority: "HIGH",   defaultTitle: "New Lead Assigned" },
  LEAD_REASSIGNED:        { moduleName: "LEAD",        priority: "HIGH",   defaultTitle: "Lead Reassigned" },
  LEAD_STATUS_CHANGED:    { moduleName: "LEAD",        priority: "MEDIUM", defaultTitle: "Lead Status Updated" },
  FOLLOWUP_REMINDER:      { moduleName: "FOLLOWUP",    priority: "HIGH",   defaultTitle: "Upcoming Follow-up Reminder" },
  FOLLOWUP_MISSED:        { moduleName: "FOLLOWUP",    priority: "URGENT", defaultTitle: "Missed Follow-up Alert" },
  FOLLOWUP_COMPLETED:     { moduleName: "FOLLOWUP",    priority: "LOW",    defaultTitle: "Follow-up Completed" },
  OPPORTUNITY_CREATED:    { moduleName: "OPPORTUNITY",  priority: "MEDIUM", defaultTitle: "New Opportunity Created" },
  OPPORTUNITY_STAGE_CHANGED: { moduleName: "OPPORTUNITY", priority: "HIGH",   defaultTitle: "Opportunity Stage Changed" },
  OPPORTUNITY_WON:        { moduleName: "OPPORTUNITY",  priority: "URGENT", defaultTitle: "Opportunity Won 🎉" },
  OPPORTUNITY_LOST:       { moduleName: "OPPORTUNITY",  priority: "HIGH",   defaultTitle: "Opportunity Lost" },
  TARGET_ACHIEVED:        { moduleName: "KPI",         priority: "URGENT", defaultTitle: "KPI Target Achieved 🏆" },
  REVENUE_MILESTONE:      { moduleName: "REVENUE",     priority: "URGENT", defaultTitle: "Revenue Milestone Reached 🚀" },
  KPI_BELOW_TARGET:       { moduleName: "KPI",         priority: "HIGH",   defaultTitle: "KPI Warning: Below Target" },
  USER_CREATED:           { moduleName: "SYSTEM",      priority: "LOW",    defaultTitle: "New User Created" },
  PASSWORD_CHANGED:       { moduleName: "SYSTEM",      priority: "URGENT", defaultTitle: "Security Alert: Password Changed" },
  MAINTENANCE_ANNOUNCEMENT: { moduleName: "SYSTEM",    priority: "HIGH",   defaultTitle: "System Maintenance Notice" },
  BACKUP_COMPLETED:       { moduleName: "SYSTEM",      priority: "LOW",    defaultTitle: "Database Backup Completed" },
};

/**
 * Non-blocking Central Notification Dispatcher
 *
 * @param {Object} params
 * @param {string} params.eventType - e.g. "LEAD_ASSIGNED"
 * @param {number} [params.companyId]
 * @param {number} [params.branchId]
 * @param {number} [params.senderId]
 * @param {number|number[]} params.recipientIds - single user ID or array of user IDs
 * @param {string} [params.title]
 * @param {string} params.message
 * @param {number} [params.relatedRecordId]
 * @param {number} [params.leadId]
 * @param {number} [params.followupId]
 * @param {number} [params.opportunityId]
 * @param {string} [params.priority] - "URGENT" | "HIGH" | "MEDIUM" | "LOW"
 * @param {string} [params.actionUrl]
 */
export const dispatchNotification = async (params) => {
  // Non-blocking try-catch safeguard
  try {
    const {
      eventType,
      companyId,
      branchId,
      senderId,
      recipientIds,
      title,
      message,
      relatedRecordId,
      leadId,
      followupId,
      opportunityId,
      priority: customPriority,
      actionUrl,
    } = params;

    if (!eventType || !message || !recipientIds) return;

    // Normalize recipient IDs array
    const rawIds = Array.isArray(recipientIds) ? recipientIds : [recipientIds];
    const validRecipients = [...new Set(rawIds.map((id) => Number(id)).filter((id) => Boolean(id) && id > 0))];

    if (validRecipients.length === 0) return;

    // Check NotificationEventConfig for enablement if companyId is present
    if (companyId) {
      const config = await prisma.notificationEventConfig.findUnique({
        where: { companyId_eventType: { companyId, eventType } },
      }).catch(() => null);

      if (config && config.isEnabled === false) {
        // Event disabled for this company
        return;
      }
    }

    const catalogEntry = EVENT_CATALOG[eventType] || {
      moduleName: "SYSTEM",
      priority: "MEDIUM",
      defaultTitle: "System Notification",
    };

    const notifTitle = title || catalogEntry.defaultTitle;
    const moduleName = catalogEntry.moduleName;
    const finalPriority = customPriority || catalogEntry.priority;

    // Bulk create notifications in DB
    const notificationsToCreate = validRecipients.map((userId) => ({
      title: notifTitle,
      message,
      notificationType: eventType,
      moduleName,
      relatedRecordId: relatedRecordId ?? leadId ?? followupId ?? opportunityId ?? null,
      senderId: senderId ?? null,
      userId,
      companyId: companyId ?? null,
      branchId: branchId ?? null,
      leadId: leadId ?? null,
      followupId: followupId ?? null,
      opportunityId: opportunityId ?? null,
      priority: finalPriority,
      isRead: false,
      status: "UNREAD",
      deliveryChannel: "IN_APP",
      actionUrl: actionUrl ?? null,
    }));

    await prisma.notification.createMany({
      data: notificationsToCreate,
    });

    // Real-time socket emit to each recipient's user room
    validRecipients.forEach((userId) => {
      emitToUser(userId, "notification:new", {
        title: notifTitle,
        message,
        notificationType: eventType,
        moduleName,
        priority: finalPriority,
        actionUrl,
        createdAt: new Date().toISOString(),
      });
    });
  } catch (err) {
    // Non-blocking safe logging
    console.error("[NotificationDispatcher] Dispatched safely with error:", err.message);
  }
};
