// src/modules/team/team.repository.js

import prisma from "../../config/db.js";

/**
 * Creates a team, assigns the BDE as the team owner (TeamMember), and logs the audit entry in a single transaction.
 */
export const createTeamTransaction = async (data, actorId) => {
  const { companyId, branchId, name, code, bdeId, status, createdById, iseIds = [] } = data;

  return prisma.$transaction(async (tx) => {
    // 1. Create Team
    const team = await tx.team.create({
      data: {
        companyId,
        branchId,
        name,
        code,
        bdeId,
        status,
        createdById,
        isDeleted: false
      }
    });

    // 2. Create BDE Team Member entry as the owner/member
    await tx.teamMember.create({
      data: {
        teamId: team.id,
        userId: bdeId,
        memberRole: "BDE",
        assignedById: actorId
      }
    });

    // 2b. Create ISE Team Member entries
    if (iseIds && iseIds.length > 0) {
      await tx.teamMember.createMany({
        data: iseIds.map((userId) => ({
          teamId: team.id,
          userId,
          memberRole: "ISE",
          assignedById: actorId
        }))
      });
    }

    // 3. Create Audit Log
    await tx.auditLog.create({
      data: {
        companyId,
        entityType: "TEAM",
        entityId: team.id,
        action: "CREATE",
        newValue: {
          name: team.name,
          code: team.code,
          branchId: team.branchId,
          bdeId: team.bdeId,
          status: team.status
        },
        performedById: actorId
      }
    });

    return team;
  });
};

/**
 * Reassigns team BDE owner atomically: updates team's bdeId, sets removedAt on previous BDE active team member entry,
 * adds the new BDE as active team member, and writes the audit log.
 */
export const updateTeamOwnerTransaction = async (teamId, companyId, newBdeId, oldBdeId, actorId) => {
  return prisma.$transaction(async (tx) => {
    // 1. Update the team owner (BDE ID)
    const updatedTeam = await tx.team.update({
      where: { id: teamId },
      data: {
        bdeId: newBdeId,
        updatedById: actorId
      }
    });

    // 2. Remove the old BDE owner (mark removedAt) if they exist as a member
    if (oldBdeId) {
      await tx.teamMember.updateMany({
        where: {
          teamId,
          userId: oldBdeId,
          removedAt: null
        },
        data: {
          removedAt: new Date()
        }
      });
    }

    // 3. Check if new BDE is already a member (either active or removed)
    const existingMember = await tx.teamMember.findFirst({
      where: {
        teamId,
        userId: newBdeId
      }
    });

    if (existingMember) {
      // Reactivate or update their role to BDE
      await tx.teamMember.update({
        where: { id: existingMember.id },
        data: {
          memberRole: "BDE",
          removedAt: null,
          assignedById: actorId,
          assignedDate: new Date()
        }
      });
    } else {
      // Create new TeamMember record for new BDE
      await tx.teamMember.create({
        data: {
          teamId,
          userId: newBdeId,
          memberRole: "BDE",
          assignedById: actorId
        }
      });
    }

    // 4. Log the audit entry
    await tx.auditLog.create({
      data: {
        companyId,
        entityType: "TEAM",
        entityId: teamId,
        action: "UPDATE",
        oldValue: { bdeId: oldBdeId },
        newValue: { bdeId: newBdeId },
        performedById: actorId
      }
    });

    return updatedTeam;
  });
};

/**
 * Fetches a single team by ID including its branch, BDE owner, and currently active members.
 */
export const findTeamById = async (id) => {
  const team = await prisma.team.findUnique({
    where: { id },
    include: {
      branch: true,
      bde: {
        select: {
          id: true,
          name: true,
          email: true,
          employeeId: true,
          status: true
        }
      },
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              employeeId: true,
              status: true
            }
          }
        }
      }
    }
  });

  return team;
};

/**
 * Checks if a team code or name duplicate exists (excluding soft-deleted teams).
 */
export const checkTeamDuplicate = async (criteria) => {
  const { companyId, code, branchId, name, excludeId } = criteria;

  if (code) {
    const duplicateCode = await prisma.team.findFirst({
      where: {
        companyId,
        code: code.trim().toUpperCase(),
        isDeleted: false,
        ...(excludeId ? { id: { not: excludeId } } : {})
      }
    });
    if (duplicateCode) return { field: "code", message: `Team code '${code}' already exists in this company` };
  }

  if (name && branchId) {
    const duplicateName = await prisma.team.findFirst({
      where: {
        branchId,
        name: { equals: name.trim(), mode: "insensitive" },
        isDeleted: false,
        ...(excludeId ? { id: { not: excludeId } } : {})
      }
    });
    if (duplicateName) return { field: "name", message: `Team name '${name}' already exists in this branch` };
  }

  return null;
};

/**
 * Performs updates (e.g. name, status) on team and records audit log.
 */
export const updateTeamAndLog = async (teamId, companyId, updates, oldValue, actorId) => {
  return prisma.$transaction(async (tx) => {
    const team = await tx.team.update({
      where: { id: teamId },
      data: {
        ...updates,
        updatedById: actorId
      }
    });

    await tx.auditLog.create({
      data: {
        companyId,
        entityType: "TEAM",
        entityId: teamId,
        action: "UPDATE",
        oldValue,
        newValue: updates,
        performedById: actorId
      }
    });

    return team;
  });
};

/**
 * Soft deletes a team by setting isDeleted to true.
 */
export const softDeleteTeamAndLog = async (teamId, companyId, actorId) => {
  return prisma.$transaction(async (tx) => {
    const existingTeam = await tx.team.findUnique({
      where: { id: teamId }
    });
    if (!existingTeam) {
      throw new Error("Team not found");
    }

    const originalName = existingTeam.name;
    const originalCode = existingTeam.code;

    const archivedName = `${originalName} (archived-${existingTeam.id})`;
    const archivedCode = `${originalCode}-archived-${existingTeam.id}`;

    const team = await tx.team.update({
      where: { id: teamId },
      data: {
        name: archivedName,
        code: archivedCode,
        isDeleted: true,
        updatedById: actorId
      }
    });

    await tx.auditLog.create({
      data: {
        companyId,
        entityType: "TEAM",
        entityId: teamId,
        action: "DELETE",
        newValue: {
          isDeleted: true,
          originalName,
          originalCode,
          archivedName,
          archivedCode
        },
        performedById: actorId
      }
    });

    return team;
  });
};

/**
 * Finds list of active (non-soft-deleted) teams matching query, filter, and scoping rules.
 */
export const findTeams = async (params) => {
  const { where, skip, take, orderBy } = params;

  return prisma.team.findMany({
    where,
    include: {
      branch: {
        select: {
          id: true,
          name: true,
          code: true
        }
      },
      bde: {
        select: {
          id: true,
          name: true,
          email: true
        }
      },
      members: {
        where: { removedAt: null }
      }
    },
    skip,
    take,
    orderBy
  });
};

/**
 * Counts total teams matching filters.
 */
export const countTeams = async (where) => {
  return prisma.team.count({
    where
  });
};

/**
 * Updates team ISE members atomically.
 */
export const updateTeamMembersTransaction = async (teamId, companyId, newIseIds, actorId) => {
  return prisma.$transaction(async (tx) => {
    // 1. Get currently active ISE members
    const activeMembers = await tx.teamMember.findMany({
      where: {
        teamId,
        memberRole: "ISE",
        removedAt: null
      }
    });

    const activeIseIds = activeMembers.map(m => m.userId);

    // 2. Identify IDs to add
    const idsToAdd = newIseIds.filter(id => !activeIseIds.includes(id));

    // 3. Identify IDs to remove
    const idsToRemove = activeIseIds.filter(id => !newIseIds.includes(id));

    // 4. Deactivate removed members
    if (idsToRemove.length > 0) {
      await tx.teamMember.updateMany({
        where: {
          teamId,
          userId: { in: idsToRemove },
          removedAt: null
        },
        data: {
          removedAt: new Date()
        }
      });
    }

    // 5. Add or reactivate added members
    for (const userId of idsToAdd) {
      const existing = await tx.teamMember.findFirst({
        where: { teamId, userId }
      });

      if (existing) {
        await tx.teamMember.update({
          where: { id: existing.id },
          data: {
            memberRole: "ISE",
            removedAt: null,
            assignedDate: new Date(),
            assignedById: actorId
          }
        });
      } else {
        await tx.teamMember.create({
          data: {
            teamId,
            userId,
            memberRole: "ISE",
            assignedById: actorId
          }
        });
      }
    }

    // 6. Log audit entry for membership update
    if (idsToAdd.length > 0 || idsToRemove.length > 0) {
      await tx.auditLog.create({
        data: {
          companyId,
          entityType: "TEAM",
          entityId: teamId,
          action: "UPDATE",
          newValue: { addedIseIds: idsToAdd, removedIseIds: idsToRemove },
          performedById: actorId
        }
      });
    }
  });
};

/**
 * Removes a member (ISE) from a team atomically: marks the membership record ended (sets removedAt to current time)
 * and creates an audit log entry.
 */
export const removeTeamMemberTransaction = async (teamId, companyId, userId, actorId) => {
  return prisma.$transaction(async (tx) => {
    // 1. Fetch active membership record
    const membership = await tx.teamMember.findFirst({
      where: {
        teamId,
        userId,
        memberRole: "ISE",
        removedAt: null
      }
    });

    if (!membership) {
      throw new Error("Active membership not found for this team and user");
    }

    // 2. Mark membership as ended
    const updatedMembership = await tx.teamMember.update({
      where: { id: membership.id },
      data: {
        removedAt: new Date()
      }
    });

    // 3. Log audit entry
    await tx.auditLog.create({
      data: {
        companyId,
        entityType: "TEAM",
        entityId: teamId,
        action: "MEMBER_REMOVE",
        newValue: { userId },
        performedById: actorId
      }
    });

    return updatedMembership;
  });
};

