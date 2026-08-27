import prisma from "../../config/db.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../utils/AppError.js";
import { dispatchNotification } from "../notification/notification.dispatcher.js";
import {
  findFollowupById, findFollowups, countFollowups,
  createFollowupDb, updateFollowupDb, deleteFollowupDb,
  findLeadForFollowup, findBdeTeamMemberIds, findUserInScope,
  buildNotificationRecipients,
} from "./followup.repository.js";

// ── INTERNAL HELPERS ──────────────────────────────────────────────────────────

/**
 * Builds Prisma `where` for LIST queries (scope by role rank).
 * BDE scope handled per-query (requires async team lookup).
 */
const buildScopeWhere = (actor) => {
  const scope = {};
  if (actor.companyId) scope.companyId = actor.companyId;
  // Branch Manager: restrict to own branch
  if (actor.primaryRoleRank >= 60 && actor.primaryRoleRank < 80 && actor.branchId) {
    scope.branchId = actor.branchId;
  }
  // ISE and custom rank < 60 (non-BDE): own assigned only
  if (actor.primaryRoleRank < 60 && actor.primaryRole !== "BDE") {
    scope.assignedToId = actor.id;
  }
  return scope;
};

/**
 * Asserts scope on a SINGLE followup record.
 * BDE can access any followup assigned to their team members or created by them.
 *
 * @param {Object}   actor                - req.user
 * @param {Object}   followup             - Followup record
 * @param {number[]} [bdeTeamMemberIds]  - Preloaded team IDs for BDE (null if not BDE)
 */
const assertFollowupScope = (actor, followup, bdeTeamMemberIds = null) => {
  // 1. Company isolation (always)
  if (actor.companyId && followup.companyId && followup.companyId !== actor.companyId) {
    throw new ForbiddenError("Follow-up does not belong to your company");
  }
  // 2. Branch Manager: branch-scoped read
  if (actor.primaryRoleRank >= 60 && actor.primaryRoleRank < 80) {
    if (actor.branchId && followup.branchId && followup.branchId !== actor.branchId) {
      throw new ForbiddenError("Follow-up does not belong to your branch");
    }
    return;
  }
  // 3. BDE: team-scoped
  if (actor.primaryRole === "BDE") {
    if (
      bdeTeamMemberIds &&
      !bdeTeamMemberIds.includes(followup.assignedToId) &&
      followup.createdById !== actor.id
    ) {
      throw new ForbiddenError("This follow-up is not within your team scope");
    }
    return;
  }
  // 4. ISE / custom rank < 60: own only
  if (actor.primaryRoleRank < 60) {
    if (followup.assignedToId !== actor.id && followup.createdById !== actor.id) {
      throw new ForbiddenError("You can only manage your own follow-ups");
    }
  }
};

/**
 * Log a LeadActivity. Non-blocking — errors are swallowed.
 * metadata is a PLAIN JS OBJECT. Prisma Json? handles serialization natively.
 */
const logFollowupActivity = async (leadId, companyId, activityType, description, metadata, performedById) => {
  try {
    await prisma.leadActivity.create({
      data: {
        leadId,
        companyId,
        activityType,
        description,
        metadata,
        performedById,
      },
    });
  } catch (err) {
    console.error("[FollowupService] Failed to log LeadActivity:", err.message);
  }

  try {
    await prisma.auditLog.create({
      data: {
        companyId: companyId ?? null,
        entityType: "LEAD",
        entityId: leadId,
        action: activityType,
        newValue: typeof metadata === 'string' ? metadata : JSON.stringify(metadata ?? {}),
        performedById,
      },
    });
  } catch (err) {
    console.error("[FollowupService] Failed to log AuditLog:", err.message);
  }
};

/**
 * Creates a FOLLOWUP_ALERT notification for a single recipient user.
 * Non-blocking fire-and-forget — errors are swallowed, never interrupt main flow.
 *
 * @param {number} userId       - Recipient user ID
 * @param {Object} followup     - Followup record (must have leadId, companyId, branchId, id)
 * @param {string} message      - Human-readable message body
 * @param {'SCHEDULED'|'COMPLETED'|'CANCELLED'} eventSubType - Controls icon on frontend
 */
const fanOutFollowupNotification = async (followup, message, eventSubType, createdById = null) => {
  try {
    const recipientIds = await buildNotificationRecipients({
      assignedToId: followup.assignedToId,
      createdById:  createdById ?? followup.createdById ?? null,
      companyId:    followup.companyId,
      branchId:     followup.branchId ?? null,
    });

    if (recipientIds.length === 0) return;

    const PREFIX_MAP = {
      SCHEDULED:  '[SCHEDULED]',
      COMPLETED:  '[COMPLETED]',
      CANCELLED:  '[CANCELLED]',
    };
    const prefix = PREFIX_MAP[eventSubType] ?? '[SCHEDULED]';

    const EVENT_MAP = {
      SCHEDULED: 'FOLLOWUP_REMINDER',
      COMPLETED: 'FOLLOWUP_COMPLETED',
      CANCELLED: 'FOLLOWUP_MISSED',
    };
    const eventType = EVENT_MAP[eventSubType] ?? 'FOLLOWUP_COMPLETED';

    const titleMap = {
      SCHEDULED: 'Follow-up Scheduled',
      COMPLETED: 'Follow-up Completed',
      CANCELLED: 'Follow-up Cancelled',
    };

    dispatchNotification({
      eventType,
      companyId: followup.companyId,
      branchId: followup.branchId ?? null,
      recipientIds,
      leadId: followup.leadId ?? null,
      followupId: followup.id,
      title: titleMap[eventSubType] || 'Follow-up Notification',
      message: `${prefix} ${message}`,
      actionUrl: followup.leadId ? `/leads?leadId=${followup.leadId}` : '/followups',
    });
  } catch (err) {
    console.error("[FollowupService] fanOutFollowupNotification failed:", err.message);
  }
};

// ── EXPORTED SERVICE FUNCTIONS ────────────────────────────────────────────────

export const createFollowupService = async (data, actor) => {
  // Service-level guard: catches CA/BM who bypass hasPermission middleware (rank >= 80)
  const perm = actor.permissions?.FOLLOWUP;
  if (!perm?.canCreate) throw new ForbiddenError("You do not have permission to create follow-ups");

  const leadId = Number(data.leadId);
  const lead = await findLeadForFollowup(leadId);
  if (!lead || lead.isDeleted) throw new NotFoundError("Lead");

  if (actor.companyId && lead.companyId !== actor.companyId)
    throw new ForbiddenError("Lead does not belong to your company");

  if (actor.branchId && lead.branchId && lead.branchId !== actor.branchId)
    throw new ForbiddenError("Lead does not belong to your branch");

  // Lead ownership check for rank < 60
  if (actor.primaryRoleRank < 60) {
    if (lead.assignedToId !== actor.id) {
      if (actor.primaryRole === "BDE") {
        const teamIds = await findBdeTeamMemberIds(actor.id);
        if (!teamIds.includes(lead.assignedToId))
          throw new ForbiddenError("You can only schedule follow-ups for leads assigned to you or your team");
      } else {
        throw new ForbiddenError("You can only schedule follow-ups for leads assigned to you");
      }
    }
  }

  // Validate assignedToId is in scope
  let assignedToId = actor.id;
  if (data.assignedToId) {
    const reqId = Number(data.assignedToId);
    if (actor.primaryRoleRank < 60) {
      if (reqId !== actor.id) throw new ForbiddenError("You can only assign follow-ups to yourself");
    } else {
      const scopedBranchId = actor.primaryRoleRank < 80 ? actor.branchId : null;
      const targetUser = await findUserInScope(reqId, actor.companyId || lead.companyId, scopedBranchId);
      if (!targetUser) throw new ForbiddenError("The specified user is not within your scope");
    }
    assignedToId = reqId;
  }

  const scheduledAt = new Date(data.scheduledAt);
  if (isNaN(scheduledAt.getTime())) throw new BadRequestError("Invalid scheduledAt datetime");

  const followup = await createFollowupDb({
    leadId,
    companyId:    lead.companyId,
    branchId:     lead.branchId ?? null,
    followupType: data.followupType,
    scheduledAt,
    status:       "PENDING",
    notes:        data.notes?.trim() || null,
    assignedToId,
    createdById:  actor.id,
  });

  await logFollowupActivity(
    leadId, lead.companyId, "FOLLOWUP_CREATED",
    `Follow-up scheduled: ${data.followupType} on ${scheduledAt.toLocaleDateString("en-IN")}`,
    { followupId: followup.id, followupType: data.followupType, scheduledAt: data.scheduledAt, assignedToId },
    actor.id
  );

  // Fan-out SCHEDULED notification to: assigned user + creator + BM + CA + SA
  fanOutFollowupNotification(
    followup,
    `Follow-up scheduled: ${data.followupType} on ${scheduledAt.toLocaleDateString("en-IN")} for lead "${lead.name}". Assigned to ${followup.assignedTo?.name ?? 'a team member'}.`,
    'SCHEDULED',
    actor.id // creator
  );

  return followup;
};

export const getFollowupsService = async (query, actor) => {
  const where = buildScopeWhere(actor);

  // BDE OR clause — sees own created + all team assignees
  if (actor.primaryRole === "BDE") {
    const teamIds = await findBdeTeamMemberIds(actor.id);
    where.OR = [
      { assignedToId: { in: teamIds } },
      { createdById: actor.id }
    ];
    delete where.assignedToId;
  }

  const VALID_STATUSES = ["PENDING","COMPLETED","MISSED","CANCELLED"];
  const VALID_TYPES    = ["CALL","MEETING","DEMO","WHATSAPP","EMAIL","VISIT"];
  if (query.leadId)                                            where.leadId       = Number(query.leadId);
  if (query.status      && VALID_STATUSES.includes(query.status))   where.status       = query.status;
  if (query.followupType && VALID_TYPES.includes(query.followupType)) where.followupType = query.followupType;
  if (query.assignedToId && actor.primaryRoleRank >= 60)       where.assignedToId = Number(query.assignedToId);
  if (query.dateFrom || query.dateTo) {
    where.scheduledAt = {};
    if (query.dateFrom) where.scheduledAt.gte = new Date(query.dateFrom);
    if (query.dateTo)   where.scheduledAt.lte = new Date(query.dateTo);
  }

  const page  = Math.max(1, Number(query.page)  || 1);
  const limit = Math.min(100, Number(query.limit) || 20);
  const skip  = (page - 1) * limit;
  const [followups, total] = await Promise.all([
    findFollowups(where, [{ scheduledAt: "desc" }], skip, limit),
    countFollowups(where),
  ]);
  return { followups, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
};

// Lazy MISSED transition at query time
export const getFollowupsByLeadService = async (leadId, query, actor) => {
  const id = Number(leadId);
  if (!Number.isInteger(id) || id < 1) throw new BadRequestError("Invalid lead ID");

  const lead = await findLeadForFollowup(id);
  if (!lead || lead.isDeleted) throw new NotFoundError("Lead");
  if (actor.companyId && lead.companyId !== actor.companyId)
    throw new ForbiddenError("Lead does not belong to your company");

  const where = { leadId: id };
  if (actor.companyId) where.companyId = actor.companyId;

  if (actor.primaryRole === "BDE") {
    const teamIds = await findBdeTeamMemberIds(actor.id);
    where.OR = [{ assignedToId: { in: teamIds } }, { createdById: actor.id }];
  } else if (actor.primaryRoleRank < 60) {
    where.assignedToId = actor.id;
  }

  const VALID_STATUSES = ["PENDING","COMPLETED","MISSED","CANCELLED"];
  if (query.status && VALID_STATUSES.includes(query.status)) where.status = query.status;

  const page  = Math.max(1, Number(query.page)  || 1);
  const limit = Math.min(500, Math.max(1, Number(query.limit) || 200));
  const skip  = (page - 1) * limit;

  const [followups, total] = await Promise.all([
    findFollowups(where, [{ scheduledAt: "desc" }], skip, limit),
    countFollowups(where),
  ]);

  // Lazy MISSED transition: mark overdue PENDING as MISSED non-blocking
  const now = new Date();
  const overdueIds = followups
    .filter(f => f.status === "PENDING" && new Date(f.scheduledAt) < now)
    .map(f => f.id);
  if (overdueIds.length > 0) {
    prisma.followup.updateMany({
      where: { id: { in: overdueIds }, status: "PENDING" },
      data:  { status: "MISSED" }
    }).catch(err => console.error("[FollowupService] MISSED transition failed:", err.message));
    return {
      followups: followups.map(f => overdueIds.includes(f.id) ? { ...f, status: "MISSED" } : f),
      total,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    };
  }
  return {
    followups,
    total,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};

export const getFollowupByIdService = async (id, actor) => {
  const followupId = Number(id);
  if (!Number.isInteger(followupId) || followupId < 1) throw new BadRequestError("Invalid follow-up ID");
  const followup = await findFollowupById(followupId);
  if (!followup) throw new NotFoundError("Follow-up");
  let bdeTeamMemberIds = null;
  if (actor.primaryRole === "BDE") bdeTeamMemberIds = await findBdeTeamMemberIds(actor.id);
  assertFollowupScope(actor, followup, bdeTeamMemberIds);
  return followup;
};

export const updateFollowupService = async (id, data, actor) => {
  const perm = actor.permissions?.FOLLOWUP;
  if (!perm?.canEdit) throw new ForbiddenError("You do not have permission to update follow-ups");

  const followupId = Number(id);
  if (!Number.isInteger(followupId) || followupId < 1) throw new BadRequestError("Invalid follow-up ID");
  const followup = await findFollowupById(followupId);
  if (!followup) throw new NotFoundError("Follow-up");
  if (followup.status !== "PENDING")
    throw new BadRequestError(`Cannot edit a follow-up with status "${followup.status}". Only PENDING can be edited.`);

  let bdeTeamMemberIds = null;
  if (actor.primaryRole === "BDE") bdeTeamMemberIds = await findBdeTeamMemberIds(actor.id);
  assertFollowupScope(actor, followup, bdeTeamMemberIds);

  const updateData = { updatedById: actor.id };
  if (data.followupType !== undefined) updateData.followupType = data.followupType;
  if (data.scheduledAt  !== undefined) {
    const dt = new Date(data.scheduledAt);
    if (isNaN(dt.getTime())) throw new BadRequestError("Invalid scheduledAt");
    updateData.scheduledAt = dt;
  }
  if (data.notes !== undefined) updateData.notes = data.notes?.trim() || null;

  const updated = await updateFollowupDb(followupId, updateData);
  await logFollowupActivity(
    followup.leadId, followup.companyId, "FOLLOWUP_UPDATED",
    `Follow-up rescheduled: ${updated.followupType}`,
    { followupId, followupType: updated.followupType, scheduledAt: updated.scheduledAt },
    actor.id
  );
  return updated;
};

export const completeFollowupService = async (id, data, actor) => {
  const perm = actor.permissions?.FOLLOWUP;
  if (!perm?.canEdit) throw new ForbiddenError("You do not have permission to complete follow-ups");

  const followupId = Number(id);
  if (!Number.isInteger(followupId) || followupId < 1) throw new BadRequestError("Invalid follow-up ID");
  const followup = await findFollowupById(followupId);
  if (!followup) throw new NotFoundError("Follow-up");
  if (followup.status !== "PENDING" && followup.status !== "MISSED")
    throw new BadRequestError(`Cannot complete a follow-up with status "${followup.status}"`);

  let bdeTeamMemberIds = null;
  if (actor.primaryRole === "BDE") bdeTeamMemberIds = await findBdeTeamMemberIds(actor.id);
  assertFollowupScope(actor, followup, bdeTeamMemberIds);

  // ISE: can only complete their OWN assigned followups
  if (actor.primaryRoleRank < 60 && actor.primaryRole !== "BDE") {
    if (followup.assignedToId !== actor.id)
      throw new ForbiddenError("You can only complete follow-ups assigned to you");
  }

  const updated = await updateFollowupDb(followupId, {
    status:          "COMPLETED",
    completedAt:     new Date(),
    completedById:   actor.id,
    completionNotes: data.completionNotes?.trim() || null,
    updatedById:     actor.id,
  });
  await logFollowupActivity(
    followup.leadId, followup.companyId, "FOLLOWUP_COMPLETED",
    `Follow-up completed: ${followup.followupType}`,
    { followupId, followupType: followup.followupType, completedAt: updated.completedAt },
    actor.id
  );

  // Fan-out COMPLETED notification to: assigned user + creator + BM + CA + SA
  fanOutFollowupNotification(
    followup,
    `Follow-up completed: ${followup.followupType} for lead "${followup.lead?.name ?? 'Unknown'}" was marked done by ${actor.name ?? 'a team member'}.`,
    'COMPLETED',
    actor.id
  );


  return updated;
};

export const cancelFollowupService = async (id, actor) => {
  const perm = actor.permissions?.FOLLOWUP;
  if (!perm?.canEdit) throw new ForbiddenError("You do not have permission to cancel follow-ups");

  const followupId = Number(id);
  if (!Number.isInteger(followupId) || followupId < 1) throw new BadRequestError("Invalid follow-up ID");
  const followup = await findFollowupById(followupId);
  if (!followup) throw new NotFoundError("Follow-up");
  if (followup.status !== "PENDING")
    throw new BadRequestError(`Cannot cancel a follow-up with status "${followup.status}"`);

  let bdeTeamMemberIds = null;
  if (actor.primaryRole === "BDE") bdeTeamMemberIds = await findBdeTeamMemberIds(actor.id);
  assertFollowupScope(actor, followup, bdeTeamMemberIds);

  const updated = await updateFollowupDb(followupId, { status: "CANCELLED", updatedById: actor.id });
  await logFollowupActivity(
    followup.leadId, followup.companyId, "FOLLOWUP_CANCELLED",
    `Follow-up cancelled: ${followup.followupType}`,
    { followupId, followupType: followup.followupType },
    actor.id
  );

  // Fan-out CANCELLED notification to: assigned user + creator + BM + CA + SA
  fanOutFollowupNotification(
    followup,
    `Follow-up cancelled: ${followup.followupType} for lead "${followup.lead?.name ?? 'Unknown'}" was cancelled by ${actor.name ?? 'a team member'}.`,
    'CANCELLED',
    actor.id
  );

  return updated;
};


export const deleteFollowupService = async (id, actor) => {
  const perm = actor.permissions?.FOLLOWUP;
  if (!perm?.canDelete) throw new ForbiddenError("You do not have permission to delete follow-ups");

  const followupId = Number(id);
  if (!Number.isInteger(followupId) || followupId < 1) throw new BadRequestError("Invalid follow-up ID");
  const followup = await findFollowupById(followupId);
  if (!followup) throw new NotFoundError("Follow-up");

  let bdeTeamMemberIds = null;
  if (actor.primaryRole === "BDE") bdeTeamMemberIds = await findBdeTeamMemberIds(actor.id);
  assertFollowupScope(actor, followup, bdeTeamMemberIds);

  await deleteFollowupDb(followupId);
  await logFollowupActivity(
    followup.leadId, followup.companyId, "FOLLOWUP_DELETED",
    `Follow-up deleted: ${followup.followupType}`,
    { followupId, followupType: followup.followupType },
    actor.id
  );
  return { success: true, message: "Follow-up deleted successfully" };
};
