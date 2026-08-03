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

/**
 * Build the full notification recipient chain for a follow-up event.
 *
 * Fan-out tiers (industry-standard supervisor chain):
 *   Tier 1 — The assigned user     (ISE / BDE / whoever owns the follow-up)
 *   Tier 2 — The creator           (if different from assignee, e.g. BM created on behalf of ISE)
 *   Tier 3 — BDE team owner        (the BDE whose team the assigned user belongs to)
 *   Tier 4 — Branch Manager(s)     (BM of the same branch)
 *   Tier 5 — Company Admin(s)      (CA of the same company)
 *   Tier 6 — Super Admin(s)        (global)
 *
 * Chain: ISE → BDE → BM → CA → SA
 *
 * All IDs are deduplicated via Set. Inactive users are excluded.
 *
 * @param {Object} params
 * @param {number}  params.assignedToId  - Primary recipient (the follow-up owner)
 * @param {number}  [params.createdById] - Creator of the follow-up (optional)
 * @param {number}  params.companyId     - Company scope for chain lookup
 * @param {number}  [params.branchId]    - Branch scope for Branch Manager lookup
 * @returns {Promise<number[]>}          - Deduplicated ordered array of userId numbers
 */
export const buildNotificationRecipients = async ({ assignedToId, createdById, companyId, branchId }) => {
  const recipientSet = new Set();

  // Tier 1: The assigned user (always first — primary recipient)
  if (assignedToId) recipientSet.add(assignedToId);

  // Tier 2: Creator (if different from assignee, e.g. BM scheduled for ISE)
  if (createdById && createdById !== assignedToId) recipientSet.add(createdById);

  try {
    // ── Tier 3: BDE — find the BDE who owns the team that the assigned user belongs to ──
    // TeamMember.userId = assignedToId, active (removedAt = null) → Team.bdeId = BDE
    if (assignedToId) {
      const teamMembership = await prisma.teamMember.findFirst({
        where: {
          userId:    assignedToId,
          removedAt: null,           // active members only
          team: { isDeleted: false } // active team only
        },
        select: {
          team: { select: { bdeId: true } }
        }
      });

      const bdeId = teamMembership?.team?.bdeId;
      if (bdeId && bdeId !== assignedToId && bdeId !== createdById) {
        // Verify BDE is still active before adding
        const bdeUser = await prisma.user.findFirst({
          where: { id: bdeId, status: "ACTIVE" },
          select: { id: true }
        });
        if (bdeUser) recipientSet.add(bdeUser.id);
      }
    }

    // ── Tiers 4/5/6: Branch Manager, Company Admin, Super Admin — one query ──
    const supervisors = await prisma.user.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          // Tier 4: Branch Managers in same branch
          ...(branchId ? [{
            companyId,
            branchId,
            userRoles: {
              some: {
                isPrimary: true,
                role: { name: "BRANCH_MANAGER", companyId: null }
              }
            }
          }] : []),
          // Tier 5: Company Admins in same company
          {
            companyId,
            userRoles: {
              some: {
                isPrimary: true,
                role: { name: "COMPANY_ADMIN", companyId: null }
              }
            }
          },
          // Tier 6: Super Admins (global)
          {
            userRoles: {
              some: {
                isPrimary: true,
                role: { name: "SUPER_ADMIN", companyId: null }
              }
            }
          },
        ]
      },
      select: { id: true }
    });

    for (const sup of supervisors) {
      recipientSet.add(sup.id);
    }
  } catch (err) {
    // Non-blocking: if supervisor lookup fails, still notify primary recipients
    console.error("[buildNotificationRecipients] Supervisor lookup failed:", err.message);
  }

  return Array.from(recipientSet);
};
