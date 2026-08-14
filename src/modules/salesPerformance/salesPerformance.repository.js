// crm-api/src/modules/salesPerformance/salesPerformance.repository.js

import prisma from "../../config/db.js";
import { ROLE_NAMES } from "../../config/roleConstants.js";

/**
 * Fetch BDE Performance Metrics
 */
export async function findBDEPerformanceMetrics({ companyId, branchId, teamId, employeeId, startDate, endDate }) {
  const userWhere = {
    ...(companyId && { companyId }),
    status: 'ACTIVE',
    ...(branchId && { branchId }),
    ...(employeeId && { id: employeeId }),
    userRoles: {
      some: {
        role: {
          name: { in: [ROLE_NAMES.BDE, ROLE_NAMES.BRANCH_MANAGER] }
        }
      }
    }
  };

  if (teamId) {
    userWhere.teamMemberships = {
      some: {
        teamId,
        removedAt: null
      }
    };
  }

  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      name: true,
      email: true,
      employeeId: true,
      branchId: true,
      branch: { select: { id: true, name: true, code: true } }
    }
  });

  const dateFilter = {};
  if (startDate && endDate) {
    dateFilter.gte = new Date(startDate);
    dateFilter.lte = new Date(endDate);
  }

  const results = await Promise.all(
    users.map(async (u) => {
      const leadsAssignedCount = await prisma.lead.count({
        where: {
          ...(companyId && { companyId }),
          assignedToId: u.id,
          isDeleted: false,
          ...(startDate && endDate && { createdAt: dateFilter })
        }
      });

      const qualifiedLeadsCount = await prisma.lead.count({
        where: {
          ...(companyId && { companyId }),
          assignedToId: u.id,
          isQualified: true,
          isDeleted: false,
          ...(startDate && endDate && { createdAt: dateFilter })
        }
      });

      const opportunitiesCount = await prisma.opportunity.count({
        where: {
          ...(companyId && { companyId }),
          ownerId: u.id,
          isDeleted: false,
          ...(startDate && endDate && { createdAt: dateFilter })
        }
      });

      const dealsWonAgg = await prisma.deal.aggregate({
        where: {
          ...(companyId && { companyId }),
          closedById: u.id,
          outcome: 'WON',
          ...(startDate && endDate && { closingDate: dateFilter })
        },
        _sum: { finalAmount: true },
        _count: { id: true }
      });

      const dealsLostCount = await prisma.deal.count({
        where: {
          ...(companyId && { companyId }),
          closedById: u.id,
          outcome: 'LOST',
          ...(startDate && endDate && { closingDate: dateFilter })
        }
      });

      const dealsWon = dealsWonAgg._count.id || 0;
      const revenueWon = dealsWonAgg._sum.finalAmount ? Number(dealsWonAgg._sum.finalAmount) : 0;
      const conversionRate = leadsAssignedCount > 0 ? Number(((dealsWon / leadsAssignedCount) * 100).toFixed(2)) : 0;

      return {
        employeeId: u.id,
        employeeCode: u.employeeId || `EMP-${u.id}`,
        name: u.name,
        email: u.email,
        branchId: u.branchId,
        branchName: u.branch?.name || 'HQ-Branch',
        leadsAssigned: leadsAssignedCount,
        qualifiedLeads: qualifiedLeadsCount,
        opportunitiesCreated: opportunitiesCount,
        dealsWon,
        dealsLost: dealsLostCount,
        totalRevenue: revenueWon,
        conversionRate
      };
    })
  );

  return results;
}

/**
 * Fetch ISE Activity & Performance Metrics
 */
export async function findISEPerformanceMetrics({ companyId, branchId, teamId, employeeId, startDate, endDate }) {
  const userWhere = {
    ...(companyId && { companyId }),
    status: 'ACTIVE',
    ...(branchId && { branchId }),
    ...(employeeId && { id: employeeId }),
    userRoles: {
      some: {
        role: {
          name: { in: [ROLE_NAMES.ISE, ROLE_NAMES.BDE] }
        }
      }
    }
  };

  if (teamId) {
    userWhere.teamMemberships = {
      some: { teamId, removedAt: null }
    };
  }

  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      name: true,
      email: true,
      employeeId: true,
      branchId: true,
      branch: { select: { id: true, name: true, code: true } }
    }
  });

  const dateFilter = {};
  if (startDate && endDate) {
    dateFilter.gte = new Date(startDate);
    dateFilter.lte = new Date(endDate);
  }

  const results = await Promise.all(
    users.map(async (u) => {
      const callsCompleted = await prisma.communicationLog.count({
        where: {
          ...(companyId && { companyId }),
          createdById: u.id,
          communicationType: 'CALL',
          isDeleted: false,
          ...(startDate && endDate && { interactionDate: dateFilter })
        }
      });

      const followupsCompleted = await prisma.followup.count({
        where: {
          ...(companyId && { companyId }),
          completedById: u.id,
          status: 'COMPLETED',
          ...(startDate && endDate && { completedAt: dateFilter })
        }
      });

      const meetingsScheduled = await prisma.followup.count({
        where: {
          ...(companyId && { companyId }),
          assignedToId: u.id,
          followupType: 'MEETING',
          ...(startDate && endDate && { scheduledAt: dateFilter })
        }
      });

      const assignedLeadsCount = await prisma.lead.count({
        where: {
          ...(companyId && { companyId }),
          assignedToId: u.id,
          isDeleted: false,
          ...(startDate && endDate && { createdAt: dateFilter })
        }
      });

      const qualifiedLeadsCount = await prisma.leadQualification.count({
        where: {
          ...(companyId && { companyId }),
          evaluatedById: u.id,
          status: 'QUALIFIED',
          ...(startDate && endDate && { createdAt: dateFilter })
        }
      });

      const totalActivities = callsCompleted + followupsCompleted;
      const conversionRate = assignedLeadsCount > 0 ? Number(((qualifiedLeadsCount / assignedLeadsCount) * 100).toFixed(2)) : 0;

      return {
        employeeId: u.id,
        employeeCode: u.employeeId || `EMP-${u.id}`,
        name: u.name,
        email: u.email,
        branchId: u.branchId,
        branchName: u.branch?.name || 'HQ-Branch',
        callsCompleted,
        followupsCompleted,
        meetingsScheduled,
        assignedLeads: assignedLeadsCount,
        qualifiedLeads: qualifiedLeadsCount,
        totalActivities,
        conversionRate
      };
    })
  );

  return results;
}

/**
 * Fetch Team Performance & Revenue Aggregation Metrics
 */
export async function findTeamPerformanceMetrics({ companyId, branchId, teamId, startDate, endDate }) {
  const teamWhere = {
    ...(companyId && { companyId }),
    isDeleted: false,
    ...(branchId && { branchId }),
    ...(teamId && { id: teamId })
  };

  const teams = await prisma.team.findMany({
    where: teamWhere,
    include: {
      branch: { select: { id: true, name: true, code: true } },
      bde: { select: { id: true, name: true, email: true } },
      members: {
        where: { removedAt: null },
        include: { user: { select: { id: true, name: true } } }
      }
    }
  });

  const dateFilter = {};
  if (startDate && endDate) {
    dateFilter.gte = new Date(startDate);
    dateFilter.lte = new Date(endDate);
  }

  const results = await Promise.all(
    teams.map(async (t) => {
      const totalLeads = await prisma.lead.count({
        where: {
          ...(companyId && { companyId }),
          teamId: t.id,
          isDeleted: false,
          ...(startDate && endDate && { createdAt: dateFilter })
        }
      });

      const totalOpportunities = await prisma.opportunity.count({
        where: {
          ...(companyId && { companyId }),
          teamId: t.id,
          isDeleted: false,
          ...(startDate && endDate && { createdAt: dateFilter })
        }
      });

      const dealsWonAgg = await prisma.deal.aggregate({
        where: {
          ...(companyId && { companyId }),
          outcome: 'WON',
          ...(startDate && endDate && { closingDate: dateFilter }),
          opportunity: { teamId: t.id }
        },
        _sum: { finalAmount: true },
        _count: { id: true }
      });

      const dealsWon = dealsWonAgg._count.id || 0;
      const teamRevenue = dealsWonAgg._sum.finalAmount ? Number(dealsWonAgg._sum.finalAmount) : 0;
      const conversionRate = totalLeads > 0 ? Number(((dealsWon / totalLeads) * 100).toFixed(2)) : 0;

      return {
        teamId: t.id,
        teamName: t.name,
        teamCode: t.code,
        branchId: t.branchId,
        branchName: t.branch?.name || 'HQ-Branch',
        bdeName: t.bde?.name || 'Unassigned',
        memberCount: t.members.length,
        totalLeads,
        totalOpportunities,
        dealsWon,
        totalRevenue: teamRevenue,
        conversionRate
      };
    })
  );

  return results;
}

/**
 * Fetch Branch Performance Metrics
 */
export async function findBranchPerformanceMetrics({ companyId, branchId, startDate, endDate }) {
  const branchWhere = {
    ...(companyId && { companyId }),
    status: 'ACTIVE',
    ...(branchId && { id: branchId })
  };

  const branches = await prisma.branch.findMany({
    where: branchWhere,
    select: {
      id: true,
      name: true,
      code: true,
      location: true
    }
  });

  const dateFilter = {};
  if (startDate && endDate) {
    dateFilter.gte = new Date(startDate);
    dateFilter.lte = new Date(endDate);
  }

  const results = await Promise.all(
    branches.map(async (b) => {
      const totalLeads = await prisma.lead.count({
        where: {
          ...(companyId && { companyId }),
          branchId: b.id,
          isDeleted: false,
          ...(startDate && endDate && { createdAt: dateFilter })
        }
      });

      const qualifiedLeads = await prisma.lead.count({
        where: {
          ...(companyId && { companyId }),
          branchId: b.id,
          isQualified: true,
          isDeleted: false,
          ...(startDate && endDate && { createdAt: dateFilter })
        }
      });

      const opportunitiesCount = await prisma.opportunity.count({
        where: {
          ...(companyId && { companyId }),
          branchId: b.id,
          isDeleted: false,
          ...(startDate && endDate && { createdAt: dateFilter })
        }
      });

      const dealsWonAgg = await prisma.deal.aggregate({
        where: {
          ...(companyId && { companyId }),
          branchId: b.id,
          outcome: 'WON',
          ...(startDate && endDate && { closingDate: dateFilter })
        },
        _sum: { finalAmount: true },
        _count: { id: true }
      });

      const newCustomers = await prisma.customer.count({
        where: {
          ...(companyId && { companyId }),
          branchId: b.id,
          isDeleted: false,
          ...(startDate && endDate && { purchaseDate: dateFilter })
        }
      });

      const dealsWon = dealsWonAgg._count.id || 0;
      const totalRevenue = dealsWonAgg._sum.finalAmount ? Number(dealsWonAgg._sum.finalAmount) : 0;
      const conversionRate = totalLeads > 0 ? Number(((dealsWon / totalLeads) * 100).toFixed(2)) : 0;

      return {
        branchId: b.id,
        branchName: b.name,
        branchCode: b.code,
        location: b.location || 'N/A',
        totalLeads,
        qualifiedLeads,
        opportunitiesCount,
        dealsWon,
        newCustomers,
        totalRevenue,
        conversionRate
      };
    })
  );

  return results;
}
