import prisma from "../config/db.js";
import {
  findUpcomingFollowups,
  findOverdueFollowups,
  findExistingNotif,
  createNotificationDb,
} from "../modules/notification/notification.repository.js";
import { buildNotificationRecipients } from "../modules/followup/followup.repository.js";

const buildReminderMessage = (type, followup) => {
  const dt      = new Date(followup.scheduledAt);
  const dateStr = dt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
  const timeStr = dt.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });
  const leadName = followup.lead?.name ?? "lead";
  const fType    = followup.followupType;
  const assigneeName = followup.assignedTo?.name ?? "a team member";

  if (type === "REMINDER") {
    return `[REMINDER] ${fType} follow-up with "${leadName}" scheduled for ${dateStr} at ${timeStr}. Assigned to ${assigneeName}.`;
  }
  return `[OVERDUE] ${fType} follow-up with "${leadName}" (assigned to ${assigneeName}) was due on ${dateStr} at ${timeStr} and has not been completed.`;
};

/**
 * Creates a notification row for a single recipient.
 * Non-blocking — errors are swallowed per recipient.
 */
const createRecipientNotif = async (userId, followup, notificationType, message, expiresAt = null) => {
  try {
    await createNotificationDb({
      userId,
      leadId:           followup.leadId,
      companyId:        followup.companyId,
      branchId:         followup.branchId ?? null,
      followupId:       followup.id,
      notificationType,
      message,
      status:           "UNREAD",
      expiresAt,
    });
  } catch (err) {
    console.error(`[ReminderJob] Failed to create ${notificationType} for user ${userId} followup ${followup.id}:`, err.message);
  }
};

export const runReminderScan = async () => {
  console.log("[ReminderJob] Scan started:", new Date().toISOString());
  let createdCount = 0;
  let missedCount  = 0;

  try {
    // ─── STEP 1: UPCOMING REMINDER (within 24h) ───────────────────────────────
    const upcoming = await findUpcomingFollowups(24);
    for (const followup of upcoming) {
      try {
        const assignedUserId = followup.assignedToId;

        // Dedup check: only skip if the ASSIGNED USER already got a reminder today.
        // Supervisors may not have it yet (e.g. BM was added later) — we fan-out all.
        const existing = await findExistingNotif(assignedUserId, followup.id, "REMINDER");
        if (existing) continue;

        const expiresAt = new Date(followup.scheduledAt);
        expiresAt.setHours(23, 59, 59, 999);

        const message = buildReminderMessage("REMINDER", followup);

        // Build full supervisor chain recipients
        const recipientIds = await buildNotificationRecipients({
          assignedToId: followup.assignedToId,
          createdById:  followup.createdById ?? null,
          companyId:    followup.companyId,
          branchId:     followup.branchId ?? null,
        });

        await Promise.allSettled(
          recipientIds.map((uid) => createRecipientNotif(uid, followup, "REMINDER", message, expiresAt))
        );

        createdCount += recipientIds.length;
      } catch (err) {
        console.error("[ReminderJob] Failed to process REMINDER for followup", followup.id, err.message);
      }
    }

    // ─── STEP 2: OVERDUE ALERT + MISSED TRANSITION ────────────────────────────
    const overdue    = await findOverdueFollowups();

    if (overdue.length > 0) {
      const pendingOverdueIds = overdue.filter((f) => f.status === "PENDING").map((f) => f.id);
      if (pendingOverdueIds.length > 0) {
        await prisma.followup.updateMany({
          where: { id: { in: pendingOverdueIds } },
          data:  { status: "MISSED" },
        });
      }
      missedCount = overdue.length;

      for (const followup of overdue) {
        try {
          const assignedUserId = followup.assignedToId;

          // Dedup check against assigned user's row
          const existing = await findExistingNotif(assignedUserId, followup.id, "OVERDUE_ALERT");
          if (existing) continue;

          const message = buildReminderMessage("OVERDUE_ALERT", followup);

          // Build full supervisor chain recipients
          const recipientIds = await buildNotificationRecipients({
            assignedToId: followup.assignedToId,
            createdById:  followup.createdById ?? null,
            companyId:    followup.companyId,
            branchId:     followup.branchId ?? null,
          });

          await Promise.allSettled(
            recipientIds.map((uid) => createRecipientNotif(uid, followup, "OVERDUE_ALERT", message, null))
          );

          createdCount += recipientIds.length;
        } catch (err) {
          console.error("[ReminderJob] Failed to process OVERDUE_ALERT for followup", followup.id, err.message);
        }
      }
    }

    console.log(`[ReminderJob] Complete. Notifications created: ${createdCount}. Marked MISSED: ${missedCount}`);
  } catch (err) {
    console.error("[ReminderJob] Scan failed:", err.message);
  }
};

export const startReminderJob = () => {
  const intervalMs = Number(process.env.REMINDER_SCAN_INTERVAL_MS) || 30 * 60 * 1000;

  // Run immediately on startup
  runReminderScan();

  // Then on interval
  setInterval(runReminderScan, intervalMs);

  console.log(`[ReminderJob] Scheduler started. Interval: ${intervalMs / 60000} minutes.`);
};
