import prisma from "../../config/db.js";
import { recordAuditLog } from "../auditLog/auditLog.service.js";
import { dispatchNotification } from "../notification/notification.dispatcher.js";
import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../utils/AppError.js";


/**
 * Calculate live achievement value for a given KPI target based on existing CRM data.
 */
export const calculateLiveAchievement = async (target) => {
  const { kpiType, employeeId, teamId, branchId, companyId, startDate, endDate } = target;

  const startObj = new Date(startDate);
  startObj.setUTCHours(0, 0, 0, 0);

  const endObj = new Date(endDate);
  endObj.setUTCHours(23, 59, 59, 999);

  const dateFilter = {
    gte: startObj,
    lte: endObj,
  };

  let teamMemberIds = [];
  if (teamId) {
    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId, removedAt: null },
      select: { userId: true },
    });
    teamMemberIds = teamMembers.map((m) => m.userId);
    const teamRecord = await prisma.team.findUnique({ where: { id: teamId } });
    if (teamRecord?.bdeId) teamMemberIds.push(teamRecord.bdeId);
  }

  const leadScope = employeeId
    ? { assignedToId: employeeId }
    : teamId
    ? { teamId }
    : branchId
    ? { branchId }
    : companyId
    ? { companyId }
    : {};

  const dealScope = employeeId
    ? { closedById: employeeId }
    : teamId
    ? { closedById: { in: teamMemberIds.length > 0 ? teamMemberIds : [-1] } }
    : branchId
    ? { branchId }
    : companyId
    ? { companyId }
    : {};

  const oppScope = employeeId
    ? { ownerId: employeeId }
    : teamId
    ? { ownerId: { in: teamMemberIds.length > 0 ? teamMemberIds : [-1] } }
    : branchId
    ? { branchId }
    : companyId
    ? { companyId }
    : {};

  try {
    switch (kpiType.toUpperCase()) {
      case "LEAD": {
        const count = await prisma.lead.count({
          where: {
            ...leadScope,
            createdAt: dateFilter,
          },
        });
        return count;
      }

      case "REVENUE":
      case "SALES": {
        const dealAggregate = await prisma.deal.aggregate({
          _sum: { finalAmount: true },
          where: {
            ...dealScope,
            outcome: "WON",
            createdAt: dateFilter,
          },
        });
        const dealRevenue = Number(dealAggregate._sum.finalAmount || 0);

        if (dealRevenue > 0) return dealRevenue;

        const oppAggregate = await prisma.opportunity.aggregate({
          _sum: { expectedRevenue: true },
          where: {
            ...oppScope,
            status: "WON",
            createdAt: dateFilter,
          },
        });
        return Number(oppAggregate._sum.expectedRevenue || 0);
      }

      case "OPPORTUNITY": {
        const count = await prisma.opportunity.count({
          where: {
            ...oppScope,
            createdAt: dateFilter,
          },
        });
        return count;
      }

      case "CUSTOMER": {
        const count = await prisma.customer.count({
          where: {
            ...(companyId ? { companyId } : {}),
            createdAt: dateFilter,
          },
        });
        return count;
      }

      case "CONVERSION": {
        const totalLeads = await prisma.lead.count({
          where: {
            ...leadScope,
            createdAt: dateFilter,
          },
        });
        if (totalLeads === 0) return 0;

        const wonDeals = await prisma.deal.count({
          where: {
            ...dealScope,
            outcome: "WON",
            createdAt: dateFilter,
          },
        });
        return Number(((wonDeals / totalLeads) * 100).toFixed(2));
      }

      default:
        return Number(target.achievedValue || 0);
    }
  } catch (error) {
    console.error(`Error calculating live achievement for target ${target.id}:`, error);
    return Number(target.achievedValue || 0);
  }
};

/**
 * Fetch KPI Dashboard data scoped automatically by user role.
 */
export const getKpiDashboardData = async (user, queryTab = "my", filters = {}) => {
  const primaryRole = user.primaryRole || "";
  const rank = user.primaryRoleRank ?? 0;

  const isSuperAdmin = primaryRole === "SUPER_ADMIN" || rank >= 100;
  const isCompanyAdmin = primaryRole === "COMPANY_ADMIN" || (rank >= 61 && rank < 100);
  const isBranchManager = primaryRole === "BRANCH_MANAGER" || (rank >= 41 && rank <= 60);

  // 1. Teams where user is assigned as BDE owner (Team.bdeId = user.id)
  const bdeLeaderTeams = await prisma.team.findMany({
    where: { bdeId: user.id },
    select: { id: true, name: true, code: true },
  });

  // 2. Teams where user has memberRole = LEADER | BDE_LEADER | TEAM_LEADER
  const memberLeaderRecords = await prisma.teamMember.findMany({
    where: {
      userId: user.id,
      removedAt: null,
      memberRole: { in: ["LEADER", "BDE_LEADER", "TEAM_LEADER"] },
    },
    include: { team: { select: { id: true, name: true, code: true } } },
  });

  const memberLeaderTeams = memberLeaderRecords.map((m) => m.team).filter(Boolean);

  // Combine unique teams user leads
  const teamsLeadedMap = new Map();
  [...bdeLeaderTeams, ...memberLeaderTeams].forEach((t) => teamsLeadedMap.set(t.id, t));
  const teamsLeaded = Array.from(teamsLeadedMap.values());
  const teamIdsLeaded = teamsLeaded.map((t) => t.id);

  const isTeamLeader = teamsLeaded.length > 0;

  let whereClause = {};

  // Apply AUTO-SCOPING based on requested tab and role permissions
  if (queryTab === "my" || (!isSuperAdmin && !isCompanyAdmin && !isBranchManager && !isTeamLeader)) {
    whereClause.employeeId = user.id;
  } else if (queryTab === "team") {
    // 403 API Guard: Block non-leader BDE / ISE from accessing team analytics
    if (!isTeamLeader && !isBranchManager && !isCompanyAdmin && !isSuperAdmin) {
      throw new ForbiddenError("You do not have permission to access team performance analytics.");
    }

    if (isTeamLeader && !isBranchManager && !isCompanyAdmin && !isSuperAdmin) {
      // Pure Team Leader: scope strictly to the teams they lead and their team members
      if (teamIdsLeaded.length > 0) {
        const members = await prisma.teamMember.findMany({
          where: { teamId: { in: teamIdsLeaded }, removedAt: null },
          select: { userId: true },
        });
        const memberUserIds = Array.from(new Set([...members.map((m) => m.userId), user.id]));

        whereClause.OR = [
          { teamId: { in: teamIdsLeaded } },
          { employeeId: { in: memberUserIds } },
        ];
      } else {
        whereClause.employeeId = user.id;
      }
    } else if (isBranchManager || isCompanyAdmin || isSuperAdmin) {
      // Branch Manager / Admin viewing Team Performance tab:
      // Scope specifically to Team targets within their branch/company
      whereClause.OR = [
        { scopeType: "TEAM" },
        { teamId: { not: null } },
      ];
      if (user.branchId && !isSuperAdmin && !isCompanyAdmin) {
        whereClause.AND = [
          {
            OR: [
              { branchId: user.branchId },
              { team: { branchId: user.branchId } },
            ],
          },
        ];
      }
    } else {
      whereClause.employeeId = user.id;
    }
  } else if (queryTab === "branch") {
    if (isBranchManager || isCompanyAdmin || isSuperAdmin) {
      if (user.branchId && !isSuperAdmin && !isCompanyAdmin) {
        whereClause.OR = [
          { branchId: user.branchId },
          { scopeType: "BRANCH" },
          { team: { branchId: user.branchId } },
          { employee: { branchId: user.branchId } },
        ];
      } else if (user.companyId && !isSuperAdmin) {
        whereClause.companyId = user.companyId;
      }
    } else {
      whereClause.employeeId = user.id;
    }
  } else if (queryTab === "company") {
    if (isCompanyAdmin || isSuperAdmin) {
      if (user.companyId && !isSuperAdmin) {
        whereClause.companyId = user.companyId;
      }
    } else {
      whereClause.employeeId = user.id;
    }
  }

  // Always filter out soft-deleted targets
  whereClause.deletedAt = null;

  // Always scope by user's company if available
  if (user.companyId && !isSuperAdmin) {
    whereClause.companyId = user.companyId;
  }

  // Merge API-level filter parameters safely
  if (filters.kpiType && filters.kpiType !== "ALL") {
    whereClause.kpiType = filters.kpiType.toUpperCase();
  }

  if (filters.teamId && filters.teamId !== "ALL" && (isBranchManager || isCompanyAdmin || isSuperAdmin || isTeamLeader)) {
    whereClause.teamId = Number(filters.teamId);
  }

  if (filters.branchId && filters.branchId !== "ALL" && (isCompanyAdmin || isSuperAdmin)) {
    whereClause.branchId = Number(filters.branchId);
  }

  if (filters.companyId && filters.companyId !== "ALL" && isSuperAdmin) {
    whereClause.companyId = Number(filters.companyId);
  }

  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim();
    whereClause.AND = whereClause.AND || [];
    whereClause.AND.push({
      OR: [
        { employee: { name: { contains: q, mode: "insensitive" } } },
        { team: { name: { contains: q, mode: "insensitive" } } },
        { kpiType: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const rawTargets = await prisma.kpiTarget.findMany({
    where: whereClause,
    include: {
      employee: {
        select: { id: true, name: true, email: true, employeeId: true },
      },
      team: {
        select: { id: true, name: true, code: true },
      },
      branch: {
        select: { id: true, name: true, code: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Compute live achievement and remaining target for each target
  let targets = await Promise.all(
    rawTargets.map(async (t) => {
      const liveAchieved = await calculateLiveAchievement(t);
      const targetVal = Number(t.targetValue);
      const achievedVal = Number(liveAchieved);
      const remainingVal = Math.max(0, targetVal - achievedVal);
      const achievementPct = targetVal > 0 ? Number(((achievedVal / targetVal) * 100).toFixed(1)) : 0;

      let statusColor = "RED"; // Below Target (<50%)
      if (achievementPct >= 100) statusColor = "GREEN"; // Completed (>=100%)
      else if (achievementPct >= 50) statusColor = "YELLOW"; // In Progress (50-99%)

      return {
        id: t.id,
        kpiType: t.kpiType,
        targetValue: targetVal,
        achievedValue: achievedVal,
        remainingValue: remainingVal,
        achievementPercentage: achievementPct,
        statusColor,
        duration: t.duration,
        startDate: t.startDate,
        endDate: t.endDate,
        employee: t.employee,
        team: t.team,
        branch: t.branch,
        createdAt: t.createdAt,
      };
    })
  );

  // Apply Status Color filter if requested
  if (filters.statusColor && filters.statusColor !== "ALL") {
    targets = targets.filter((t) => t.statusColor === filters.statusColor.toUpperCase());
  }

  // Compute Summary Metrics
  const totalTargetsCount = targets.length;
  const completedTargetsCount = targets.filter((t) => t.statusColor === "GREEN").length;
  const inProgressTargetsCount = targets.filter((t) => t.statusColor === "YELLOW").length;
  const belowTargetsCount = targets.filter((t) => t.statusColor === "RED").length;

  const totalTargetSum = targets.reduce((sum, t) => sum + t.targetValue, 0);
  const totalAchievedSum = targets.reduce((sum, t) => sum + t.achievedValue, 0);
  const overallAchievementPct = totalTargetSum > 0 ? Number(((totalAchievedSum / totalTargetSum) * 100).toFixed(1)) : 0;

  // Prepare chart datasets for shared CrmBarChart, CrmLineChart, CrmPieChart
  const barChartData = targets.map((t) => ({
    name: t.employee?.name || t.team?.name || t.kpiType,
    Target: t.targetValue,
    Achieved: t.achievedValue,
  }));

  const pieChartData = [
    { name: "Completed", value: completedTargetsCount, color: "#10b981" },
    { name: "In Progress", value: inProgressTargetsCount, color: "#f59e0b" },
    { name: "Below Target", value: belowTargetsCount, color: "#ef4444" },
  ];

  const lineChartData = targets.map((t, idx) => ({
    period: `T${idx + 1} (${t.kpiType})`,
    target: t.targetValue,
    achieved: t.achievedValue,
  }));

  // Build cascading filter dropdown options based on user role and organization scope
  let teamOptions = [];
  let branchOptions = [];
  let companyOptions = [];

  if (isBranchManager || isCompanyAdmin || isSuperAdmin || isTeamLeader) {
    const teamWhere = {};
    if (user.branchId && !isSuperAdmin && !isCompanyAdmin) teamWhere.branchId = user.branchId;
    if (user.companyId && !isSuperAdmin) teamWhere.companyId = user.companyId;

    teamOptions = await prisma.team.findMany({
      where: teamWhere,
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });
  }

  if (isCompanyAdmin || isSuperAdmin) {
    const branchWhere = {};
    if (user.companyId && !isSuperAdmin) branchWhere.companyId = user.companyId;

    branchOptions = await prisma.branch.findMany({
      where: branchWhere,
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });
  }

  if (isSuperAdmin) {
    companyOptions = await prisma.company.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });
  }

  return {
    summary: {
      totalTargetsCount,
      completedTargetsCount,
      inProgressTargetsCount,
      belowTargetsCount,
      totalTargetSum,
      totalAchievedSum,
      overallAchievementPct,
    },
    userRoleInfo: {
      isSuperAdmin,
      isCompanyAdmin,
      isBranchManager,
      isTeamLeader,
      teamIds: teamIdsLeaded,
      teamsLeaded,
      primaryRole,
    },
    filterOptions: {
      teamOptions,
      branchOptions,
      companyOptions,
    },
    targets,
    charts: {
      barChartData,
      pieChartData,
      lineChartData,
    },
  };
};

export const validateKpiDurationDates = (duration, startDateStr, endDateStr) => {
  if (!startDateStr || !endDateStr) {
    throw new BadRequestError("Start Date and End Date are required.");
  }

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new BadRequestError("Invalid Date format provided.");
  }

  if (start > end) {
    throw new BadRequestError("Start Date cannot be after End Date.");
  }

  const startYear = start.getUTCFullYear();
  const startMonth = start.getUTCMonth(); // 0-11
  const startDateNum = start.getUTCDate();

  const endYear = end.getUTCFullYear();
  const endMonth = end.getUTCMonth(); // 0-11
  const endDateNum = end.getUTCDate();

  const dur = (duration || "MONTHLY").toUpperCase();

  if (dur === "MONTHLY") {
    if (startDateNum !== 1) {
      throw new BadRequestError("For Monthly duration, Start Date must be the 1st day of the month.");
    }
    const lastDayOfMonth = new Date(Date.UTC(startYear, startMonth + 1, 0)).getUTCDate();
    if (startYear !== endYear || startMonth !== endMonth || endDateNum !== lastDayOfMonth) {
      throw new BadRequestError(`For Monthly duration, End Date must be the last day of the same month (${startYear}-${String(startMonth + 1).padStart(2, "0")}-${lastDayOfMonth}).`);
    }
  } else if (dur === "QUARTERLY") {
    const validQuarters = [
      { startM: 0, startD: 1, endM: 2, endD: 31 },
      { startM: 3, startD: 1, endM: 5, endD: 30 },
      { startM: 6, startD: 1, endM: 8, endD: 30 },
      { startM: 9, startD: 1, endM: 11, endD: 31 },
    ];

    const match = validQuarters.find(
      (q) =>
        startMonth === q.startM &&
        startDateNum === q.startD &&
        endMonth === q.endM &&
        endDateNum === q.endD &&
        startYear === endYear
    );

    if (!match) {
      throw new BadRequestError("For Quarterly duration, date range must be a full calendar quarter (Q1: Jan 1-Mar 31, Q2: Apr 1-Jun 30, Q3: Jul 1-Sep 30, Q4: Oct 1-Dec 31).");
    }
  } else if (dur === "YEARLY") {
    if (startMonth !== 0 || startDateNum !== 1 || endMonth !== 11 || endDateNum !== 31 || startYear !== endYear) {
      throw new BadRequestError(`For Yearly duration, Start Date must be Jan 1 and End Date must be Dec 31 of the same year.`);
    }
  } else if (dur === "CUSTOM_RANGE") {
    if (start > end) {
      throw new BadRequestError("For Custom Range, Start Date cannot be after End Date.");
    }
  }
};

/**
 * Helper to retrieve all team IDs led by a specific user.
 */
export const getUserLedTeamIds = async (userId) => {
  if (!userId) return [];
  const bdeLeaderTeams = await prisma.team.findMany({
    where: { bdeId: Number(userId), isDeleted: false },
    select: { id: true },
  });

  const memberLeaderRecords = await prisma.teamMember.findMany({
    where: {
      userId: Number(userId),
      removedAt: null,
      memberRole: { in: ["LEADER", "BDE_LEADER", "TEAM_LEADER"] },
      team: { isDeleted: false },
    },
    select: { teamId: true },
  });

  const teamIds = new Set([
    ...bdeLeaderTeams.map((t) => t.id),
    ...memberLeaderRecords.map((m) => m.teamId),
  ]);

  return Array.from(teamIds);
};

export const createKpiTarget = async (user, data) => {
  const { employeeId, teamId, assignmentType, scopeType, kpiType, targetValue, duration, startDate, endDate, calculationMeta } = data;

  // Req 5: KPI Type & Value Validation
  const targetVal = Number(targetValue);
  if (isNaN(targetVal) || targetVal <= 0) {
    throw new BadRequestError("Target Value must be a positive number greater than 0.");
  }

  if (kpiType.toUpperCase() === "CONVERSION" && (targetVal < 0 || targetVal > 100)) {
    throw new BadRequestError("Target Value for Conversion Rate KPI must be between 0% and 100%.");
  }

  // Req 4: Strict Duration Date Validation
  validateKpiDurationDates(duration, startDate, endDate);

  const resolvedScope = scopeType || assignmentType || (employeeId ? "INDIVIDUAL" : teamId ? "TEAM" : "COMPANY");
  const targetEmployeeId = employeeId ? Number(employeeId) : null;
  const targetTeamId = teamId ? Number(teamId) : null;

  const actorRole = user.primaryRole || "";
  const actorRank = Number(user.primaryRoleRank || 0);
  const isSuperAdmin = actorRole === "SUPER_ADMIN" || actorRank >= 100;
  const isCompanyAdmin = isSuperAdmin || actorRole === "COMPANY_ADMIN" || actorRank >= 61;
  const isBranchManager = isCompanyAdmin || actorRole === "BRANCH_MANAGER" || actorRank >= 41;

  // 1. Strict Scope Validation for Individual Employee Assignment
  if (targetEmployeeId && !isSuperAdmin) {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetEmployeeId },
      include: {
        userRoles: {
          where: { isPrimary: true },
          include: { role: { select: { name: true, rank: true } } },
        },
      },
    });

    if (!targetUser) {
      throw new NotFoundError("Selected employee");
    }

    const targetRoleName = targetUser.userRoles?.[0]?.role?.name || "";
    const targetRank = targetUser.userRoles?.[0]?.role?.rank ?? 0;

    // Multitenancy Company Boundary
    if (user.companyId && targetUser.companyId !== user.companyId) {
      throw new ForbiddenError("Unauthorized KPI assignment: Target employee is outside your company.");
    }

    if (!isCompanyAdmin) {
      if (isBranchManager) {
        // Branch Manager Scope
        if (user.branchId && targetUser.branchId !== user.branchId) {
          throw new ForbiddenError("Unauthorized KPI assignment: Target employee is outside your branch.");
        }
        if (targetRoleName === "SUPER_ADMIN" || targetRoleName === "COMPANY_ADMIN" || (actorRank > 0 && targetRank > actorRank)) {
          throw new ForbiddenError("Unauthorized KPI assignment: You cannot assign targets to a user with higher rank than yourself.");
        }
      } else {
        // Team Leader / BDE Scope: Must be a member of user's led teams or self
        const ledTeamIds = await getUserLedTeamIds(user.id);
        if (targetUser.id !== user.id) {
          const isMember = await prisma.teamMember.findFirst({
            where: {
              userId: targetUser.id,
              teamId: { in: ledTeamIds.length > 0 ? ledTeamIds : [-1] },
              removedAt: null,
            },
          });
          if (!isMember) {
            throw new ForbiddenError("Unauthorized KPI assignment: Target employee is not in any team under your leadership.");
          }
        }
      }
    }
  }

  // 2. Strict Scope Validation for Sales Team Assignment
  if (targetTeamId && !isSuperAdmin) {
    const targetTeam = await prisma.team.findUnique({
      where: { id: targetTeamId, isDeleted: false },
    });

    if (!targetTeam) {
      throw new NotFoundError("Selected sales team");
    }

    if (user.companyId && targetTeam.companyId !== user.companyId) {
      throw new ForbiddenError("Unauthorized KPI assignment: Target team is outside your company.");
    }

    if (!isCompanyAdmin) {
      if (isBranchManager) {
        if (user.branchId && targetTeam.branchId !== user.branchId) {
          throw new ForbiddenError("Unauthorized KPI assignment: Target team is outside your branch.");
        }
      } else {
        // Team Leader Scope: Must be a team led by user
        const ledTeamIds = await getUserLedTeamIds(user.id);
        if (!ledTeamIds.includes(targetTeam.id)) {
          throw new ForbiddenError("Unauthorized KPI assignment: You are not authorized to assign targets to this team.");
        }
      }
    }
  }
  const targetCompanyId = user.companyId || 1;
  let targetBranchId = user.branchId || null;
  if (!targetBranchId) {
    if (targetEmployeeId) {
      const emp = await prisma.user.findUnique({
        where: { id: targetEmployeeId },
        select: { branchId: true },
      });
      if (emp?.branchId) targetBranchId = emp.branchId;
    } else if (targetTeamId) {
      const t = await prisma.team.findUnique({
        where: { id: targetTeamId },
        select: { branchId: true },
      });
      if (t?.branchId) targetBranchId = t.branchId;
    }
  }
  const parsedStartDate = new Date(startDate);
  const parsedEndDate = new Date(endDate);

  // Req 3: Prevent duplicate target overlaps for same scope, type, and date range
  const existingOverlap = await prisma.kpiTarget.findFirst({
    where: {
      companyId: targetCompanyId,
      kpiType: kpiType.toUpperCase(),
      scopeType: resolvedScope,
      employeeId: targetEmployeeId,
      teamId: targetTeamId,
      deletedAt: null,
      AND: [
        { startDate: { lte: parsedEndDate } },
        { endDate: { gte: parsedStartDate } },
      ],
    },
  });

  if (existingOverlap) {
    throw new ConflictError(`An active ${kpiType.toUpperCase()} target already exists for this ${resolvedScope.toLowerCase()} within an overlapping date range.`);
  }

  const target = await prisma.kpiTarget.create({
    data: {
      companyId: targetCompanyId,
      branchId: targetBranchId,
      teamId: targetTeamId,
      employeeId: targetEmployeeId,
      scopeType: resolvedScope,
      kpiType: kpiType.toUpperCase(),
      targetValue: Number(targetValue),
      duration: duration || "MONTHLY",
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      status: "ACTIVE",
      calculationMeta: calculationMeta || null,
      createdById: user.id,
    },
  });

  const recipientIds = [targetEmployeeId, user.id].filter(Boolean);
  if (recipientIds.length > 0) {
    dispatchNotification({
      eventType: "TARGET_ACHIEVED",
      companyId: targetCompanyId,
      branchId: targetBranchId,
      senderId: user.id,
      recipientIds,
      title: "New KPI Target Assigned",
      message: `${kpiType} target of ${targetValue} assigned for ${duration.toLowerCase()} period.`,
      actionUrl: `/kpi/${target.id}`,
    });
  }

  return target;
};

/**
 * Get detailed breakdown for a specific KPI target.
 */
export const getKpiDetail = async (user, targetId) => {
  const id = Number(targetId);

  const primaryRole = user.primaryRole || "";
  const rank = user.primaryRoleRank ?? 0;

  const isSuperAdmin = primaryRole === "SUPER_ADMIN" || rank >= 100;
  const isCompanyAdmin = primaryRole === "COMPANY_ADMIN" || (rank >= 61 && rank < 100);
  const isBranchManager = primaryRole === "BRANCH_MANAGER" || (rank >= 41 && rank <= 60);

  // Req 9: ISE Role strictly blocked from detail drilldown
  if (primaryRole === "ISE") {
    throw new ForbiddenError("ISE users are restricted from viewing KPI target details.");
  }

  const target = await prisma.kpiTarget.findUnique({
    where: { id },
    include: {
      employee: {
        select: { id: true, name: true, email: true, employeeId: true },
      },
      team: {
        select: { id: true, name: true, code: true },
      },
      branch: {
        select: { id: true, name: true, code: true },
      },
      createdBy: {
        select: { id: true, name: true },
      },
    },
  });

  if (!target || target.deletedAt) {
    throw new NotFoundError("KPI Target");
  }

  // Req 9: Security Access Verification
  if (!isSuperAdmin) {
    if (user.companyId && target.companyId !== user.companyId) {
      throw new ForbiddenError("You do not have access to this organization's targets.");
    }

    if (isBranchManager && user.branchId && target.branchId && target.branchId !== user.branchId) {
      throw new ForbiddenError("You do not have access to targets outside your branch.");
    }

    if (!isCompanyAdmin && !isBranchManager) {
      const isAssignedToSelf = target.employeeId === user.id;

      let isTeamMemberTarget = false;
      if (target.teamId) {
        const userTeamLeaderOf = await prisma.team.findFirst({
          where: {
            id: target.teamId,
            OR: [
              { bdeId: user.id },
              { members: { some: { userId: user.id, memberRole: "LEADER", removedAt: null } } },
            ],
          },
        });
        isTeamMemberTarget = Boolean(userTeamLeaderOf);
      }

      if (!isAssignedToSelf && !isTeamMemberTarget) {
        throw new ForbiddenError("You can only inspect your own performance targets or team targets under your leadership.");
      }
    }
  }

  const liveAchieved = await calculateLiveAchievement(target);
  const targetVal = Number(target.targetValue);
  const achievedVal = Number(liveAchieved);
  const remainingVal = Math.max(0, targetVal - achievedVal);
  const achievementPct = targetVal > 0 ? Number(((achievedVal / targetVal) * 100).toFixed(1)) : 0;

  let statusColor = "RED";
  if (achievementPct >= 100) statusColor = "GREEN";
  else if (achievementPct >= 50) statusColor = "YELLOW";

  return {
    ...target,
    targetValue: targetVal,
    achievedValue: achievedVal,
    remainingValue: remainingVal,
    achievementPercentage: achievementPct,
    statusColor,
  };
};

/**
 * Update an existing KPI Target.
 */
export const updateKpiTarget = async (user, targetId, data, req = null) => {
  const id = Number(targetId);

  const updated = await prisma.kpiTarget.update({
    where: { id },
    data: {
      targetValue: data.targetValue ? Number(data.targetValue) : undefined,
      duration: data.duration,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      updatedById: user.id,
    },
  });

  // Log Audit Entry
  await recordAuditLog({
    req,
    companyId: user.companyId || 1,
    moduleName: "KPI",
    actionType: "UPDATE",
    entityType: "KPI_TARGET",
    entityId: id,
    action: "KPI_TARGET_UPDATED",
    newValue: { targetValue: data.targetValue, duration: data.duration },
    performedById: user.id
  });

  return updated;
};

/**
 * Soft delete a KPI Target.
 */
export const deleteKpiTarget = async (user, targetId, req = null) => {
  const id = Number(targetId);

  const deleted = await prisma.kpiTarget.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      status: "CANCELLED",
      updatedById: user.id,
    },
  });

  // Log Audit Entry
  await recordAuditLog({
    req,
    companyId: user.companyId || 1,
    moduleName: "KPI",
    actionType: "DELETE",
    entityType: "KPI_TARGET",
    entityId: id,
    action: "KPI_TARGET_DELETED",
    performedById: user.id
  });

  return deleted;
};

/**
 * Export KPI Performance data (Excel, CSV, PDF support)
 */
export const exportKpiData = async (user, format = "csv", queryTab = "my") => {
  const dashboard = await getKpiDashboardData(user, queryTab);
  const targets = dashboard.targets || [];

  const exportType = (format || "csv").toUpperCase();
  const fileName = `KPI_Performance_Report_${queryTab}_${new Date().toISOString().split("T")[0]}.${format.toLowerCase()}`;

  // Record Export Log
  try {
    await prisma.exportLog.create({
      data: {
        companyId: user.companyId || 1,
        branchId: user.branchId || null,
        reportName: "KPI Performance Report",
        exportType,
        fileName,
        filtersUsed: { queryTab },
        exportedById: user.id,
      },
    });
  } catch (e) {
    // Ignore export log failure
  }

  return {
    fileName,
    format: exportType,
    totalRecords: targets.length,
    targets,
  };
};
