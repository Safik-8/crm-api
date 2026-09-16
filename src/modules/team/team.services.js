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
 * Asserts team management permission.
 */
const assertTeamManagementPermission = (actor, action) => {
  if (actor.primaryRole === "SUPER_ADMIN" || actor.primaryRole === "COMPANY_ADMIN") return;
  const rank = actor.primaryRoleRank ?? 0;
  if (rank >= 41) return;
  throw new ForbiddenError("You do not have permission to perform team management actions");
};

/**
 * Checks if actor is scoped to their specific branch (< Rank 80)
 */
const isBranchScopedActor = (actor) => {
  if (actor.primaryRole === "SUPER_ADMIN" || actor.primaryRole === "COMPANY_ADMIN" || (actor.primaryRoleRank && actor.primaryRoleRank >= 61)) return false;
  const rank = actor.primaryRoleRank ?? 0;
  return actor.primaryRole === "BRANCH_MANAGER" || (rank <= 60 && !!actor.branchId);
};

/**
 * Validates that a user exists, has a BDE role, and belongs to the specified branch.
 */
const validateBdeUser = async (bdeId, branchId, companyId, excludeTeamId) => {
  const user = await prisma.user.findFirst({
    where: {
      id: Number(bdeId),
      companyId: Number(companyId),
      userRoles: {
        some: {
          role: {
            name: "BDE"
          }
        }
      }
    },
    include: {
      userRoles: {
        include: {
          role: true
        }
      }
    }
  });

  if (!user) {
    throw new NotFoundError("BDE User not found in this company");
  }

  // Branch check
  if (user.branchId !== Number(branchId)) {
    throw new ValidationError("User does not belong to the selected branch");
  }

  // Active membership check (cannot lead multiple active teams simultaneously)
  const existingActiveLeader = await prisma.team.findFirst({
    where: {
      bdeId: Number(bdeId),
      status: "ACTIVE",
      ...(excludeTeamId ? { id: { not: Number(excludeTeamId) } } : {})
    }
  });

  if (existingActiveLeader) {
    throw new ConflictError("User is already leading another active team");
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
export const createTeamService = async (data, actor, req = null) => {
  const { name, code, branchId, bdeId, status, iseIds = [] } = data;

  // 1. Resolve companyId based on actor
  const companyId = actor.primaryRole === "SUPER_ADMIN" ? data.companyId : actor.companyId;
  if (!companyId) {
    throw new ValidationError("Company ID is required");
  }

  // 2. Assert company boundary
  assertCompanyScope(actor, companyId);

  // 3. Branch manager scoping: can only onboard in their own branch
  if (isBranchScopedActor(actor) && Number(branchId) !== actor.branchId) {
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
  }, actor.id, req);

  return team;
};

/**
 * Updates a team's editable fields (name, BDE owner, status).
 */
export const updateTeamService = async (id, data, actor, req = null) => {
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
  if (isBranchScopedActor(actor) && team.branchId !== actor.branchId) {
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
    finalTeam = await updateTeamAndLog(teamId, team.companyId, updates, oldValue, actor.id, req);
  }

  // 7. Handle BDE owner reassignment atomically if requested
  if (data.bdeId && Number(data.bdeId) !== team.bdeId) {
    await validateBdeUser(Number(data.bdeId), team.branchId, team.companyId, teamId);
    finalTeam = await updateTeamOwnerTransaction(
      teamId,
      team.companyId,
      Number(data.bdeId),
      team.bdeId,
      actor.id,
      req
    );
  }

  // 7b. Handle ISE members updates atomically if requested
  if (data.iseIds) {
    const iseIds = data.iseIds.map(Number);
    await validateIseUsers(iseIds, team.branchId, team.companyId, teamId);
    await updateTeamMembersTransaction(teamId, team.companyId, iseIds, actor.id, req);
  }

  return finalTeam;
};

/**
 * Toggles status (ACTIVE/INACTIVE) of a team.
 */
export const toggleTeamStatusService = async (id, status, actor, req = null) => {
  const teamId = Number(id);
  const team = await prisma.team.findUnique({
    where: { id: teamId, isDeleted: false }
  });

  if (!team) {
    throw new NotFoundError("Team");
  }

  assertCompanyScope(actor, team.companyId);

  if (isBranchScopedActor(actor) && team.branchId !== actor.branchId) {
    throw new ForbiddenError("You can only modify teams within your assigned branch");
  }

  const updatedTeam = await updateTeamAndLog(
    teamId,
    team.companyId,
    { status },
    { status: team.status },
    actor.id,
    req
  );

  return updatedTeam;
};

/**
 * Soft deletes a team.
 */
export const softDeleteTeamService = async (id, actor, req = null) => {
  const teamId = Number(id);
  const team = await prisma.team.findUnique({
    where: { id: teamId, isDeleted: false }
  });

  if (!team) {
    throw new NotFoundError("Team");
  }

  assertCompanyScope(actor, team.companyId);

  if (isBranchScopedActor(actor) && team.branchId !== actor.branchId) {
    throw new ForbiddenError("You can only delete teams within your assigned branch");
  }

  return await softDeleteTeamAndLog(teamId, team.companyId, actor.id, req);
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

  if (isBranchScopedActor(actor) && team.branchId !== actor.branchId) {
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
  } else if (actor.primaryRole === "COMPANY_ADMIN" || (actor.primaryRoleRank && actor.primaryRoleRank >= 61)) {
    where.companyId = actor.companyId;
    if (branchId) {
      where.branchId = Number(branchId);
    }
  } else {
    // Branch scoped (Branch Manager + Level 2 custom roles + sales reps)
    where.companyId = actor.companyId;
    if (actor.branchId) {
      where.branchId = actor.branchId;
    }
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
export const removeTeamMemberService = async (teamIdParam, userIdParam, actor, req = null) => {
  const teamId = Number(teamIdParam);
  const targetUserId = Number(userIdParam);

  const team = await prisma.team.findUnique({
    where: { id: teamId, isDeleted: false }
  });

  if (!team) {
    throw new NotFoundError("Team");
  }

  // 1. Assert company boundary
  assertCompanyScope(actor, team.companyId);

  // 2. Branch manager scoping
  if (isBranchScopedActor(actor) && team.branchId !== actor.branchId) {
    throw new ForbiddenError("You can only modify teams within your assigned branch");
  }

  try {
    const updatedMembership = await removeTeamMemberTransaction(
      teamId,
      team.companyId,
      targetUserId,
      actor.id,
      req
    );
    return updatedMembership;
  } catch (err) {
    throw new ValidationError(err.message);
  }
};

/**
 * Service to reassign/replace a team's BDE owner.
 */
export const replaceTeamOwnerService = async (id, newBdeId, actor, req = null) => {
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
  if (isBranchScopedActor(actor) && team.branchId !== actor.branchId) {
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
    actor.id,
    req
  );

  return updatedTeam;
};

