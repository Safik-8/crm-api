// src/modules/followup/followup.repository.js

import prisma from "../../config/db.js";

const FOLLOWUP_INCLUDE = {
  lead:        { select: { id: true, name: true, mobile: true, companyId: true, branchId: true, teamId: true } },
  assignedTo:  { select: { id: true, name: true, email: true } },
  createdBy:   { select: { id: true, name: true } },
  completedBy: { select: { id: true, name: true } },
  updatedBy:   { select: { id: true, name: true } },
};

export const findFollowupById = (id) =>
  prisma.followup.findUnique({ where: { id }, include: FOLLOWUP_INCLUDE });

export const findFollowups = (where, orderBy = [{ scheduledAt: "desc" }], skip = 0, take = 20) =>
  prisma.followup.findMany({ where, orderBy, skip, take, include: FOLLOWUP_INCLUDE });

export const countFollowups  = (where) => prisma.followup.count({ where });
export const createFollowupDb = (data) => prisma.followup.create({ data, include: FOLLOWUP_INCLUDE });
export const updateFollowupDb = (id, data) => prisma.followup.update({ where: { id }, data, include: FOLLOWUP_INCLUDE });
export const deleteFollowupDb = (id) => prisma.followup.delete({ where: { id } });

export const findLeadForFollowup = (id) =>
  prisma.lead.findUnique({
    where: { id },
    select: { id: true, name: true, companyId: true, branchId: true, assignedToId: true, teamId: true, isDeleted: true }
  });

/**
 * Returns [bdeUserId, ...activeTeamMemberIds].
 * Team.members = TeamMember[] (schema.prisma:683). removedAt: null = active.
 */
export const findBdeTeamMemberIds = async (bdeUserId) => {
  const team = await prisma.team.findFirst({
    where: { bdeId: bdeUserId, isDeleted: false },
    include: {
      members: {
        where: { removedAt: null },
        select: { userId: true }
      }
    }
  });
  if (!team) return [bdeUserId];
  return [bdeUserId, ...team.members.map((m) => m.userId)];
};

/**
 * Validates that userId belongs to the given company (and optionally branch).
 * Prevents BM/CA from assigning followups to users in other companies/branches.
 */
export const findUserInScope = (userId, companyId, branchId = null) =>
  prisma.user.findFirst({
    where: {
      id: userId,
      companyId,
      ...(branchId ? { branchId } : {}),
      status: "ACTIVE"
    },
    select: { id: true, companyId: true, branchId: true }
  });
