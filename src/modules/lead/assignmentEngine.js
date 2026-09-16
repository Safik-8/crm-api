import prisma from "../../config/db.js";
import { recordAuditLog } from "../auditLog/auditLog.service.js";
import { dispatchNotification } from "../notification/notification.dispatcher.js";

/**
 * Automatically assigns a lead to an eligible user or team in the lead's branch.
 * @param {number} leadId 
 * @param {object} tx Optional Prisma transaction client
 */
export const autoAssignLead = async (leadId, tx = prisma) => {
  const lead = await tx.lead.findUnique({
    where: { id: leadId },
    include: { branch: true }
  });

  if (!lead || !lead.branchId) {
    return;
  }

  const branch = lead.branch;
  let sysSettings = null;
  if (lead.companyId) {
    try {
      sysSettings = await tx.systemSettings.findUnique({
        where: { companyId: Number(lead.companyId) },
        select: { autoAssignmentEnabled: true, defaultAssignmentAlgorithm: true }
      });
    } catch (_) {}
  }

  const isAutoAssignmentActive = branch?.autoAssignmentEnabled ?? sysSettings?.autoAssignmentEnabled ?? false;
  if (!isAutoAssignmentActive) {
    return;
  }

  // 1. Resolve limits and configuration
  const maxLimit = branch?.maxDailyLeadsPerUser ?? 50;
  const algorithm = branch?.assignmentAlgorithm || sysSettings?.defaultAssignmentAlgorithm || "ROUND_ROBIN";
  const resolutionLevel = branch?.assignmentResolutionLevel ?? "PERSON";

  // Date boundaries for today (local server timezone, consistent with spec)
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  let selectedCandidate = null;

  if (resolutionLevel === "PERSON") {
    // 2. Fetch all active users in the branch
    const users = await tx.user.findMany({
      where: {
        branchId: lead.branchId,
        status: "ACTIVE"
      },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  where: { module: "LEAD" }
                }
              }
            }
          }
        },
        teamMemberships: {
          where: { removedAt: null },
          include: { team: true }
        }
      }
    });

    // Filter by role eligibility & active team membership
    const eligibleUsers = users.filter(user => {
      // Check system roles or custom roles
      const hasSalesRole = user.userRoles.some(ur => {
        const r = ur.role;
        if (r.name === "BDE" || r.name === "ISE") return true;
        if (r.rank <= 40) {
          const leadPerm = r.rolePermissions?.find(rp => rp.module === "LEAD");
          if (!leadPerm) return true;
          return leadPerm.canView || leadPerm.canEdit;
        }
        return false;
      });
      if (!hasSalesRole) return false;

      return true;
    });

    if (eligibleUsers.length === 0) {
      return await handleAllFullOrNoCandidates(lead, tx);
    }

    // 3. Apply algorithm ordering & select candidate
    if (algorithm === "ROUND_ROBIN") {
      eligibleUsers.sort((a, b) => a.id - b.id);

      const lastAssignment = await tx.leadAssignment.findFirst({
        where: {
          branchId: lead.branchId,
          assignmentType: "AUTOMATIC",
          assignedToUserId: { not: null }
        },
        orderBy: { id: "desc" }
      });
      const lastUserId = lastAssignment?.assignedToUserId;

      let startIndex = 0;
      if (lastUserId) {
        const lastIndex = eligibleUsers.findIndex(u => u.id === lastUserId);
        if (lastIndex !== -1) {
          startIndex = (lastIndex + 1) % eligibleUsers.length;
        }
      }

      for (let i = 0; i < eligibleUsers.length; i++) {
        const index = (startIndex + i) % eligibleUsers.length;
        const user = eligibleUsers[index];
        const todayCount = await tx.leadAssignment.count({
          where: {
            assignedToUserId: user.id,
            assignedAt: {
              gte: startOfToday,
              lte: endOfToday
            }
          }
        });
        if (todayCount < maxLimit) {
          selectedCandidate = { type: "USER", id: user.id, user };
          break;
        }
      }
    } else {
      if (algorithm === "LEAST_WORKLOAD") {
        // Count today's assignments for each user
        const dailyAssignments = await tx.leadAssignment.findMany({
          where: {
            assignedToUserId: { in: eligibleUsers.map(u => u.id) },
            assignedAt: {
              gte: startOfToday,
              lte: endOfToday
            }
          }
        });

        const userCounts = {};
        eligibleUsers.forEach(u => { userCounts[u.id] = 0; });
        dailyAssignments.forEach(la => {
          if (userCounts[la.assignedToUserId] !== undefined) {
            userCounts[la.assignedToUserId]++;
          }
        });

        eligibleUsers.sort((a, b) => {
          const diff = userCounts[a.id] - userCounts[b.id];
          if (diff !== 0) return diff;
          return a.id - b.id; // stable secondary sort
        });
      } else if (algorithm === "PRIORITY_BASED") {
        // Sort by Role rank descending
        const getRank = (u) => {
          const primary = u.userRoles.find(ur => ur.isPrimary);
          if (primary) return primary.role.rank;
          return Math.max(...u.userRoles.map(ur => ur.role.rank), 0);
        };
        eligibleUsers.sort((a, b) => {
          const diff = getRank(b) - getRank(a);
          if (diff !== 0) return diff;
          return a.id - b.id; // stable secondary sort
        });
      }

      // 4. Find first user under daily limit
      for (const user of eligibleUsers) {
        const todayCount = await tx.leadAssignment.count({
          where: {
            assignedToUserId: user.id,
            assignedAt: {
              gte: startOfToday,
              lte: endOfToday
            }
          }
        });

        if (todayCount < maxLimit) {
          selectedCandidate = { type: "USER", id: user.id, user };
          break;
        }
      }
    }
  } else {
    // RESOLUTION LEVEL IS TEAM
    const rawTeams = await tx.team.findMany({
      where: {
        branchId: lead.branchId,
        status: "ACTIVE",
        isDeleted: false
      },
      include: {
        bde: {
          include: {
            userRoles: {
              include: { role: true }
            }
          }
        },
        members: {
          where: { removedAt: null }
        }
      }
    });

    const teams = rawTeams;

    if (teams.length === 0) {
      return await handleAllFullOrNoCandidates(lead, tx);
    }

    if (algorithm === "ROUND_ROBIN") {
      teams.sort((a, b) => a.id - b.id);

      const lastAssignment = await tx.leadAssignment.findFirst({
        where: {
          branchId: lead.branchId,
          assignmentType: "AUTOMATIC",
          assignedToTeamId: { not: null }
        },
        orderBy: { id: "desc" }
      });
      const lastTeamId = lastAssignment?.assignedToTeamId;

      let startIndex = 0;
      if (lastTeamId) {
        const lastIndex = teams.findIndex(t => t.id === lastTeamId);
        if (lastIndex !== -1) {
          startIndex = (lastIndex + 1) % teams.length;
        }
      }

      for (let i = 0; i < teams.length; i++) {
        const index = (startIndex + i) % teams.length;
        const team = teams[index];
        const todayCount = await tx.leadAssignment.count({
          where: {
            assignedToTeamId: team.id,
            assignedAt: {
              gte: startOfToday,
              lte: endOfToday
            }
          }
        });

        if (todayCount < maxLimit) {
          selectedCandidate = { type: "TEAM", id: team.id, team };
          break;
        }
      }
    } else {
      if (algorithm === "LEAST_WORKLOAD") {
        // Sum assignments of all members of the team made today
        const teamMembers = await tx.teamMember.findMany({
          where: {
            teamId: { in: teams.map(t => t.id) },
            removedAt: null
          }
        });

        const memberIds = teamMembers.map(tm => tm.userId);
        const dailyAssignments = await tx.leadAssignment.findMany({
          where: {
            OR: [
              { assignedToUserId: { in: memberIds } },
              { assignedToTeamId: { in: teams.map(t => t.id) } }
            ],
            assignedAt: {
              gte: startOfToday,
              lte: endOfToday
            }
          }
        });

        const userCounts = {};
        memberIds.forEach(id => { userCounts[id] = 0; });
        dailyAssignments.forEach(la => {
          if (la.assignedToUserId && userCounts[la.assignedToUserId] !== undefined) {
            userCounts[la.assignedToUserId]++;
          }
        });

        const teamCounts = {};
        teams.forEach(t => { teamCounts[t.id] = 0; });
        
        // Add member workloads
        teamMembers.forEach(tm => {
          teamCounts[tm.teamId] += userCounts[tm.userId] || 0;
        });

        // Also add direct team-level assignments workload
        dailyAssignments.forEach(la => {
          if (la.assignedToTeamId && teamCounts[la.assignedToTeamId] !== undefined) {
            teamCounts[la.assignedToTeamId]++;
          }
        });

        teams.sort((a, b) => {
          const diff = teamCounts[a.id] - teamCounts[b.id];
          if (diff !== 0) return diff;
          return a.id - b.id; // stable secondary sort
        });
      } else if (algorithm === "PRIORITY_BASED") {
        // Sort teams by owning BDE's Role.rank descending
        const getRank = (t) => {
          if (!t.bde) return 0;
          const primary = t.bde.userRoles.find(ur => ur.isPrimary);
          if (primary) return primary.role.rank;
          return Math.max(...t.bde.userRoles.map(ur => ur.role.rank), 0);
        };
        teams.sort((a, b) => {
          const diff = getRank(b) - getRank(a);
          if (diff !== 0) return diff;
          return a.id - b.id; // stable secondary sort
        });
      }

      // 4. Find first team under limit
      for (const team of teams) {
        const todayCount = await tx.leadAssignment.count({
          where: {
            assignedToTeamId: team.id,
            assignedAt: {
              gte: startOfToday,
              lte: endOfToday
            }
          }
        });

        if (todayCount < maxLimit) {
          selectedCandidate = { type: "TEAM", id: team.id, team };
          break;
        }
      }
    }
  }

  // 5. Perform Assignment
  if (selectedCandidate) {
    let assignedToId = null;
    let teamId = null;

    if (selectedCandidate.type === "USER") {
      assignedToId = selectedCandidate.id;
      teamId = null;
    } else {
      teamId = selectedCandidate.id;
      assignedToId = null;
    }

    await tx.lead.update({
      where: { id: leadId },
      data: {
        assignedToId,
        teamId,
        updatedById: lead.createdById
      }
    });

    await tx.leadAssignment.create({
      data: {
        leadId,
        companyId: lead.companyId,
        branchId: lead.branchId,
        assignmentType: "AUTOMATIC",
        assignedToUserId: assignedToId,
        assignedToTeamId: teamId,
        assignedById: lead.createdById
      }
    });

    await recordAuditLog({
      tx,
      companyId: lead.companyId,
      moduleName: "LEAD",
      actionType: "UPDATE",
      entityType: "LEAD",
      entityId: leadId,
      action: "AUTO_ASSIGNED",
      oldValue: { assignedToId: null, teamId: null },
      newValue: { assignedToId, teamId },
      performedById: lead.createdById
    });

    // Real-time notification to auto-assigned sales rep
    if (assignedToId) {
      dispatchNotification({
        eventType: "LEAD_ASSIGNED",
        companyId: lead.companyId,
        branchId: lead.branchId,
        recipientIds: [assignedToId],
        leadId,
        title: "New Lead Assigned",
        message: `Lead "${lead.name}" has been auto-assigned to you.`,
        // Deep-link: opens the Lead drawer (overview/comments is the right
        // starting point for a freshly assigned lead).
        actionUrl: `/leads?leadId=${leadId}`,
      });
    }
  } else {
    // All candidates are full
    await handleAllFullOrNoCandidates(lead, tx);
  }
};

/**
 * Handle notification creation when all reps are full or no candidates exist.
 */
const handleAllFullOrNoCandidates = async (lead, tx = prisma) => {
  // Find Branch Managers (System role or Custom Roles with rank 60-79) to notify
  const managers = await tx.user.findMany({
    where: {
      branchId: lead.branchId,
      status: "ACTIVE",
      userRoles: {
        some: {
          role: {
            OR: [
              { name: "BRANCH_MANAGER" },
              { rank: { gte: 60, lte: 79 } }
            ]
          }
        }
      }
    }
  });

  if (managers && managers.length > 0) {
    dispatchNotification({
      eventType: "LEAD_ASSIGNED",
      companyId: lead.companyId,
      branchId: lead.branchId,
      recipientIds: managers.map(m => m.id),
      leadId: lead.id,
      title: "Unassigned Lead Alert",
      message: `Lead "${lead.name}" remains unassigned because all eligible candidates in the branch have hit their daily limit.`,
      // Deep-link: manager can open the lead and manually assign from there.
      actionUrl: `/leads?leadId=${lead.id}`,
    });
  }
};

