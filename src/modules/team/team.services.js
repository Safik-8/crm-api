// src/modules/team/team.services.js

import {
  createTeamTransaction,
  updateTeamOwnerTransaction,
  updateTeamMembersTransaction,
  findTeamById,
  checkTeamDuplicate,
  updateTeamAndLog,
  softDeleteTeamAndLog,
  findTeams,
  countTeams,
  removeTeamMemberTransaction
} from "./team.repository.js";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError
} from "../../utils/AppError.js";
import prisma from "../../config/db.js";

/**
 * Enforces company boundary.
 */
const assertCompanyScope = (actor, targetCompanyId) => {
  if (actor.primaryRole === "SUPER_ADMIN") return;
  if (Number(actor.companyId) !== Number(targetCompanyId)) {
    throw new ForbiddenError("You cannot access data from another company");
  }
};

/**
 * Validates that a user exists, has a BDE role, and belongs to the specified branch.
 */
const validateBdeUser = async (bdeId, branchId, companyId, excludeTeamId) => {
  const user = await prisma.user.findUnique({
    where: { id: bdeId },
    include: {
      userRoles: {
        include: {
          role: true
        }
      }
    }
  });

  if (!user) {
    throw new NotFoundError("BDE User");
  }

  if (user.companyId !== companyId) {
    throw new ValidationError("BDE user company mismatch");
  }

  if (user.branchId !== branchId) {
    throw new ValidationError("BDE user must belong to the same branch as the team");
  }

  // Check if any role of the user is "BDE"
  const isBde = user.userRoles.some((ur) => ur.role.name === "BDE");
  if (!isBde) {
    throw new ValidationError("Selected user does not hold a BDE role");
  }

  if (user.status !== "ACTIVE") {
    throw new ValidationError("Selected BDE user is inactive");
  }

  // Verify BDE is not already owning another active team
  const existingOwnedTeam = await prisma.team.findFirst({
    where: {
      bdeId,
      isDeleted: false,
      ...(excludeTeamId ? { id: { not: excludeTeamId } } : {})
    }
  });
  if (existingOwnedTeam) {
    throw new ValidationError(`Selected BDE is already the owner of team "${existingOwnedTeam.name}"`);
  }

  return user;
};

/**
 * Validates that multiple users exist, hold an ISE role, are active, and belong to the specified branch.
 */
const validateIseUsers = async (iseIds, branchId, companyId, excludeTeamId) => {
  if (!iseIds || iseIds.length === 0) return;

  const users = await prisma.user.findMany({
    where: {
      id: { in: iseIds }
    },
    include: {
      userRoles: {
        include: {
          role: true
        }
      }
    }
  });

  if (users.length !== iseIds.length) {
    throw new ValidationError("One or more selected ISE users do not exist");
  }

  for (const user of users) {
    if (user.companyId !== companyId) {
      throw new ValidationError(`ISE user ${user.name} company mismatch`);
    }
    if (user.branchId !== branchId) {
      throw new ValidationError(`ISE user ${user.name} must belong to the same branch as the team`);
    }
    if (user.status !== "ACTIVE") {
      throw new ValidationError(`ISE user ${user.name} is inactive`);
    }
    const isIse = user.userRoles.some((ur) => ur.role.name === "ISE");
    if (!isIse) {
      throw new ValidationError(`ISE user ${user.name} does not hold an ISE role`);
    }
  }

  // Check if any selected ISE users are already in another team
  const activeMemberships = await prisma.teamMember.findMany({
    where: {
      userId: { in: iseIds },
      removedAt: null,
      memberRole: "ISE",
      team: { isDeleted: false },
      ...(excludeTeamId ? { teamId: { not: excludeTeamId } } : {})
    },
    include: {
      team: { select: { name: true } },
      user: { select: { name: true } }
    }
  });

  if (activeMemberships.length > 0) {
    const details = activeMemberships.map(m => `${m.user.name} is active in team "${m.team.name}"`).join(", ");
    throw new ValidationError(`One or more ISEs are already assigned to other teams: ${details}`);
  }
};

/**
 * Creates a new team.
 */
export const createTeamService = async (data, actor) => {
  const { name, code, branchId, bdeId, status, iseIds = [] } = data;

  // 1. Resolve companyId based on actor
  const companyId = actor.primaryRole === "SUPER_ADMIN" ? data.companyId : actor.companyId;
  if (!companyId) {
    throw new ValidationError("Company ID is required");
  }

  // 2. Assert company boundary
  assertCompanyScope(actor, companyId);

  // 3. Branch manager scoping: can only onboard in their own branch
  if (actor.primaryRole === "BRANCH_MANAGER" && Number(branchId) !== actor.branchId) {
    throw new ForbiddenError("You can only create teams within your assigned branch");
  }

  // 4. Verify branch exists and matches company
  const branch = await prisma.branch.findUnique({
    where: { id: Number(branchId) }
  });
  if (!branch || branch.isDeleted) {
    throw new NotFoundError("Branch");
  }
  if (branch.companyId !== companyId) {
    throw new ValidationError("Selected branch does not belong to the selected company");
  }
  if (branch.status !== "ACTIVE") {
    throw new ValidationError("Selected branch is inactive");
  }

  // 5. Verify BDE owner user
  await validateBdeUser(Number(bdeId), Number(branchId), companyId);

  // 5b. Verify ISE users
  await validateIseUsers(iseIds, Number(branchId), companyId);

  // 6. Check unique constraints (team name unique in branch, team code unique in company)
  const codeDuplicate = await checkTeamDuplicate({ companyId, code });
  if (codeDuplicate) throw new ConflictError(codeDuplicate.message, codeDuplicate.field);

  const nameDuplicate = await checkTeamDuplicate({ branchId: Number(branchId), name });
  if (nameDuplicate) throw new ConflictError(nameDuplicate.message, nameDuplicate.field);

  // 7. Execute creation transaction
  const team = await createTeamTransaction({
    companyId,
    branchId: Number(branchId),
    name: name.trim(),
    code: code.trim().toUpperCase(),
    bdeId: Number(bdeId),
    status: status || "ACTIVE",
    iseIds,
    createdById: actor.id
  }, actor.id);

  return team;
};

/**
 * Updates a team's editable fields (name, BDE owner, status).
 */
export const updateTeamService = async (id, data, actor) => {
  const teamId = Number(id);
  const team = await prisma.team.findUnique({
    where: { id: teamId, isDeleted: false }
  });

  if (!team) {
    throw new NotFoundError("Team");
  }

  // 1. Assert company boundary
  assertCompanyScope(actor, team.companyId);

  // 2. Branch manager scoping
  if (actor.primaryRole === "BRANCH_MANAGER" && team.branchId !== actor.branchId) {
    throw new ForbiddenError("You can only modify teams within your assigned branch");
  }

  // 3. Reject branch or code change attempts
  if (data.branchId && Number(data.branchId) !== team.branchId) {
    throw new ValidationError("Changing team branch is not allowed");
  }
  if (data.code && data.code.trim().toUpperCase() !== team.code) {
    throw new ValidationError("Changing team code is not allowed");
  }

  const updates = {};
  const oldValue = {};

  // 4. Validate name change
  if (data.name && data.name.trim() !== team.name) {
    const nameDuplicate = await checkTeamDuplicate({
      branchId: team.branchId,
      name: data.name,
      excludeId: teamId
    });
    if (nameDuplicate) throw new ConflictError(nameDuplicate.message, nameDuplicate.field);

    updates.name = data.name.trim();
    oldValue.name = team.name;
  }

  // 5. Validate status change
  if (data.status && data.status !== team.status) {
    updates.status = data.status;
    oldValue.status = team.status;
  }

  let finalTeam = team;

  // 6. Execute name/status updates if any
  if (Object.keys(updates).length > 0) {
    finalTeam = await updateTeamAndLog(teamId, team.companyId, updates, oldValue, actor.id);
  }

  // 7. Handle BDE owner reassignment atomically if requested
  if (data.bdeId && Number(data.bdeId) !== team.bdeId) {
    await validateBdeUser(Number(data.bdeId), team.branchId, team.companyId, teamId);
    finalTeam = await updateTeamOwnerTransaction(
      teamId,
      team.companyId,
      Number(data.bdeId),
      team.bdeId,
      actor.id
    );
  }

  // 7b. Handle ISE members updates atomically if requested
  if (data.iseIds) {
    const iseIds = data.iseIds.map(Number);
    await validateIseUsers(iseIds, team.branchId, team.companyId, teamId);
    await updateTeamMembersTransaction(teamId, team.companyId, iseIds, actor.id);
  }

  return finalTeam;
};

/**
 * Toggles status (ACTIVE/INACTIVE) of a team.
 */
export const toggleTeamStatusService = async (id, status, actor) => {
  const teamId = Number(id);
  const team = await prisma.team.findUnique({
    where: { id: teamId, isDeleted: false }
  });

  if (!team) {
    throw new NotFoundError("Team");
  }

  assertCompanyScope(actor, team.companyId);

  if (actor.primaryRole === "BRANCH_MANAGER" && team.branchId !== actor.branchId) {
    throw new ForbiddenError("You can only modify teams within your assigned branch");
  }

  const updatedTeam = await updateTeamAndLog(
    teamId,
    team.companyId,
    { status },
    { status: team.status },
    actor.id
  );

  return updatedTeam;
};

/**
 * Soft deletes a team.
 */
export const softDeleteTeamService = async (id, actor) => {
  const teamId = Number(id);
  const team = await prisma.team.findUnique({
    where: { id: teamId, isDeleted: false }
  });

  if (!team) {
    throw new NotFoundError("Team");
  }

  assertCompanyScope(actor, team.companyId);

  if (actor.primaryRole === "BRANCH_MANAGER" && team.branchId !== actor.branchId) {
    throw new ForbiddenError("You can only delete teams within your assigned branch");
  }

  await softDeleteTeamAndLog(teamId, team.companyId, actor.id);

  return { success: true, message: "Team soft deleted successfully" };
};

/**
 * Fetches single team details.
 */
export const getTeamByIdService = async (id, actor) => {
  const teamId = Number(id);
  const team = await findTeamById(teamId);

  if (!team) {
    throw new NotFoundError("Team");
  }

  assertCompanyScope(actor, team.companyId);

  if (actor.primaryRole === "BRANCH_MANAGER" && team.branchId !== actor.branchId) {
    throw new ForbiddenError("You can only view details of teams within your assigned branch");
  }

  return team;
};

/**
 * Lists teams based on search, filter, pagination, and scoping.
 */
export const getTeamsListService = async (params, actor) => {
  const { page = 1, limit = 10, search, branchId, status, view = 'active' } = params;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where = {};

  // Apply view filter (active, archived, all)
  if (view === 'archived') {
    where.isDeleted = true;
  } else if (view === 'all') {
    // Return both deleted and non-deleted
  } else {
    where.isDeleted = false;
  }

  // 1. Scoping
  // 1. Scoping & Filters
  if (actor.primaryRole === "SUPER_ADMIN") {
    if (params.companyId) {
      where.companyId = Number(params.companyId);
    }
    if (branchId) {
      where.branchId = Number(branchId);
    }
  } else if (actor.primaryRole === "COMPANY_ADMIN") {
    where.companyId = actor.companyId;
    if (branchId) {
      where.branchId = Number(branchId);
    }
  } else {
    // Branch manager: strictly locked to their own branch
    where.companyId = actor.companyId;
    where.branchId = actor.branchId;
  }

  if (status) {
    where.status = status;
  }

  // 3. Text Search (name or code)
  if (search && search.trim() !== "") {
    const searchString = search.trim();
    where.OR = [
      { name: { contains: searchString, mode: "insensitive" } },
      { code: { contains: searchString, mode: "insensitive" } }
    ];
  }

  // 4. Fetch list & count
  const teams = await findTeams({
    where,
    skip,
    take,
    orderBy: { createdAt: "desc" }
  });

  const total = await countTeams(where);

  return {
    teams,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / take)
    }
  };
};

/**
 * Service to remove a member (ISE) from a team.
 */
export const removeTeamMemberService = async (id, userId, actor) => {
  const teamId = Number(id);
  const targetUserId = Number(userId);

  const team = await prisma.team.findUnique({
    where: { id: teamId, isDeleted: false }
  });

  if (!team) {
    throw new NotFoundError("Team");
  }

  // 1. Assert company boundary
  assertCompanyScope(actor, team.companyId);

  // 2. Branch manager scoping
  if (actor.primaryRole === "BRANCH_MANAGER" && team.branchId !== actor.branchId) {
    throw new ForbiddenError("You can only modify teams within your assigned branch");
  }

  try {
    const updatedMembership = await removeTeamMemberTransaction(
      teamId,
      team.companyId,
      targetUserId,
      actor.id
    );
    return updatedMembership;
  } catch (err) {
    throw new ValidationError(err.message);
  }
};

/**
 * Service to reassign/replace a team's BDE owner.
 */
export const replaceTeamOwnerService = async (id, newBdeId, actor) => {
  const teamId = Number(id);
  const targetBdeId = Number(newBdeId);

  const team = await prisma.team.findUnique({
    where: { id: teamId, isDeleted: false }
  });

  if (!team) {
    throw new NotFoundError("Team");
  }

  // 1. Assert company boundary
  assertCompanyScope(actor, team.companyId);

  // 2. Branch manager scoping
  if (actor.primaryRole === "BRANCH_MANAGER" && team.branchId !== actor.branchId) {
    throw new ForbiddenError("You can only modify teams within your assigned branch");
  }

  if (targetBdeId === team.bdeId) {
    throw new ValidationError("Proposed new owner is already the active owner of this team");
  }

  // Validate the proposed new owner
  await validateBdeUser(targetBdeId, team.branchId, team.companyId, teamId);

  // Check if owner being replaced is already ended or not matching
  // BDE ID on team is team.bdeId. The membership record of old owner must be active.
  const activeOldOwnerMember = await prisma.teamMember.findFirst({
    where: {
      teamId,
      userId: team.bdeId,
      memberRole: "BDE",
      removedAt: null
    }
  });

  if (!activeOldOwnerMember) {
    throw new ValidationError("Current owner membership is not active");
  }

  // Perform owner update atomically
  const updatedTeam = await updateTeamOwnerTransaction(
    teamId,
    team.companyId,
    targetBdeId,
    team.bdeId,
    actor.id
  );

  return updatedTeam;
};


// ──────────────────────────────────────────────────────────────────────────────
// BDE-SCOPED ISE ASSIGNMENT (My Team — restricted to own team only)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Returns today's assignment count for each active ISE in the BDE's team,
 * together with the branch daily limit. Used to show the "42/50 today" badges
 * in the assignment drawer so the BDE can make informed decisions.
 *
 * Only callable by the BDE who owns the team.
 */
export const getTeamISEDailyStatsService = async (teamId, actor) => {
  const id = Number(teamId);

  // 1. Fetch team and assert ownership
  const team = await prisma.team.findUnique({
    where: { id, isDeleted: false },
    include: {
      branch: { select: { id: true, maxDailyLeadsPerUser: true } },
      members: {
        where: { removedAt: null },
        include: {
          user: {
            select: { id: true, name: true, status: true }
          }
        }
      }
    }
  });

  if (!team) throw new NotFoundError("Team");

  // Only the BDE who owns this team may call this
  if (team.bdeId !== actor.id && actor.primaryRole !== "BRANCH_MANAGER" &&
      actor.primaryRole !== "COMPANY_ADMIN" && actor.primaryRole !== "SUPER_ADMIN") {
    throw new ForbiddenError("You do not have permission to view this team's stats");
  }

  const maxLimit = team.branch?.maxDailyLeadsPerUser ?? 50;

  // 2. Build today's date range
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  // 3. Fetch today's assignment counts for all members in one query
  const activeMembers = team.members.filter(m => m.user?.status === "ACTIVE");
  const memberUserIds = activeMembers.map(m => m.userId);

  const todayAssignments = await prisma.leadAssignment.groupBy({
    by: ["assignedToUserId"],
    where: {
      assignedToUserId: { in: memberUserIds },
      assignedAt: { gte: startOfToday, lte: endOfToday }
    },
    _count: { id: true }
  });

  const countMap = {};
  for (const row of todayAssignments) {
    countMap[row.assignedToUserId] = row._count.id;
  }

  const memberStats = activeMembers.map(m => ({
    userId: m.userId,
    name: m.user.name,
    memberRole: m.memberRole,
    todayCount: countMap[m.userId] || 0,
    maxLimit,
    isAtLimit: (countMap[m.userId] || 0) >= maxLimit
  }));

  return { memberStats, maxLimit };
};

/**
 * BDE assigns a lead (from their own team's pool OR already with one of their ISEs)
 * to a specific ISE on the same team.
 *
 * Restrictions enforced here (NOT delegated to the general assignLeadsService):
 *  - Actor must be the BDE who owns teamId
 *  - Lead must belong to that team (lead.teamId === teamId)
 *  - Target ISE must be an active member of that team
 *  - Daily limit check (same rule as the auto-assignment engine)
 *  - BDE cannot assign to themselves via this endpoint
 */
export const bdeAssignLeadToISEService = async (teamId, data, actor) => {
  const { leadId, assignedToId } = data;
  const id = Number(teamId);
  const targetUserId = Number(assignedToId);
  const targetLeadId = Number(leadId);

  // 1. Fetch team and assert ownership or management scoping
  const team = await prisma.team.findUnique({
    where: { id, isDeleted: false },
    include: {
      branch: { select: { id: true, maxDailyLeadsPerUser: true } },
      members: {
        where: { removedAt: null },
        include: { user: { select: { id: true, name: true, status: true } } }
      }
    }
  });

  if (!team) throw new NotFoundError("Team");

  const isOwner = team.bdeId === actor.id;
  const isManagerOrAdmin =
    actor.primaryRole === "SUPER_ADMIN" ||
    actor.primaryRole === "COMPANY_ADMIN" ||
    actor.primaryRole === "BRANCH_MANAGER" ||
    actor.primaryRole === "BDE";

  if (!isOwner && !isManagerOrAdmin) {
    throw new ForbiddenError("You can only assign leads within your own team");
  }

  // 3. BDE cannot assign to themselves
  if (targetUserId === actor.id) {
    throw new ValidationError("BDE cannot assign a lead to themselves via this endpoint");
  }

  // 4. Target user must be an active ISE member of this team
  const membership = team.members.find(
    m => m.userId === targetUserId && m.user?.status === "ACTIVE"
  );
  if (!membership) {
    throw new ValidationError("Target user is not an active ISE member of your team");
  }

  // 5. Fetch and validate lead
  const lead = await prisma.lead.findUnique({
    where: { id: targetLeadId },
    include: {
      assignedTo: { select: { id: true, name: true } },
      team: { select: { id: true, name: true } }
    }
  });

  if (!lead || lead.isDeleted) throw new NotFoundError("Lead");

  // Lead must belong to this team (either unassigned pool or already with a team member)
  if (lead.teamId !== id) {
    throw new ValidationError("Lead does not belong to your team's pool");
  }

  // 6. Daily limit check — same rule as autoAssignLead engine
  const maxLimit = team.branch?.maxDailyLeadsPerUser ?? 50;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const todayCount = await prisma.leadAssignment.count({
    where: {
      assignedToUserId: targetUserId,
      assignedAt: { gte: startOfToday, lte: endOfToday }
    }
  });

  if (todayCount >= maxLimit) {
    throw new ValidationError(
      `${membership.user.name} has already received ${todayCount}/${maxLimit} leads today. Daily limit reached.`
    );
  }

  // 7. Execute in transaction
  return await prisma.$transaction(async (tx) => {
    const prevUserId = lead.assignedToId;
    const prevTeamId = lead.teamId;

    // Update lead: assign to ISE, keep teamId intact
    const updatedLead = await tx.lead.update({
      where: { id: targetLeadId },
      data: {
        assignedToId: targetUserId,
        teamId: id,
        updatedById: actor.id
      },
      include: {
        assignedTo: { select: { id: true, name: true } },
        team: { select: { id: true, name: true } }
      }
    });

    const assignmentType = prevUserId ? "REASSIGNMENT" : "MANUAL";

    // LeadAssignment history record
    await tx.leadAssignment.create({
      data: {
        leadId: targetLeadId,
        companyId: lead.companyId ?? actor.companyId,
        branchId: lead.branchId,
        assignmentType,
        assignedToUserId: targetUserId,
        assignedToTeamId: id,
        previousUserId: prevUserId,
        previousTeamId: prevTeamId,
        assignedById: actor.id,
        notes: data.notes || null,
        reason: "BDE manual assignment"
      }
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        companyId: lead.companyId ?? actor.companyId,
        entityId: targetLeadId,
        entityType: "LEAD",
        action: "UPDATE",
        oldValue: JSON.stringify({ assignedToId: prevUserId, teamId: prevTeamId }),
        newValue: JSON.stringify({ assignedToId: targetUserId, teamId: id }),
        performedById: actor.id
      }
    });

    // Lead activity entry
    const activityType = prevUserId ? "REASSIGNED" : "ASSIGNED";
    const assigneeName = membership.user.name;
    await tx.leadActivity.create({
      data: {
        leadId: targetLeadId,
        companyId: lead.companyId ?? actor.companyId,
        activityType,
        description: `Lead ${activityType.toLowerCase()} to ${assigneeName} by BDE`,
        performedById: actor.id,
        metadata: {
          previousUserId: prevUserId,
          previousTeamId: prevTeamId,
          nextUserId: targetUserId,
          nextTeamId: id,
          reason: "BDE manual assignment"
        }
      }
    });

    return updatedLead;
  });
};
