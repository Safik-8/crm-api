import prisma from '../../config/db.js';

export const buildProposalWhere = (actor, q = {}) => {
  const isSA = actor.primaryRole === 'SUPER_ADMIN';
  const rank = actor.primaryRoleRank ?? 0;
  const where = { isDeleted: false };

  // Tenant Isolation
  if (!isSA && actor.companyId) {
    where.companyId = actor.companyId;
  } else if (isSA && q.companyId) {
    where.companyId = parseInt(q.companyId);
  }

  // Branch Scope
  if (rank >= 60 && rank < 80 && actor.branchId) {
    where.branchId = actor.branchId;
  } else if (rank >= 80 && q.branchId) {
    where.branchId = parseInt(q.branchId);
  }

  // Owner scope (Sales BDE/ISE can only see their own proposals or opportunities they own)
  if (rank < 60) {
    where.OR = [
      { createdById: actor.id },
      { opportunity: { ownerId: actor.id } }
    ];
  } else if (rank >= 60 && q.ownerId) {
    where.createdById = parseInt(q.ownerId);
  }

  // Filters
  if (q.status) {
    where.status = q.status;
  }

  if (q.opportunityId) {
    where.opportunityId = parseInt(q.opportunityId);
  }

  // Search
  if (q.search) {
    const s = q.search.trim();
    where.OR = [
      ...(where.OR || []),
      { proposalNumber: { contains: s, mode: 'insensitive' } },
      { opportunity: { opportunityName: { contains: s, mode: 'insensitive' } } }
    ];
  }

  // Expiration dynamic filter (optional helper)
  if (q.expired === 'true') {
    where.validTill = { lt: new Date() };
  } else if (q.expired === 'false') {
    where.validTill = { gte: new Date() };
  }

  return where;
};

const LIST_INCLUDE = {
  opportunity: {
    select: {
      id: true,
      opportunityName: true,
      status: true,
      leadId: true,
      lead: { select: { id: true, name: true } },
      owner: { select: { id: true, name: true } }
    }
  },
  createdBy: { select: { id: true, name: true } },
  product: { select: { id: true, name: true } }
};

const DETAIL_INCLUDE = {
  ...LIST_INCLUDE,
  versions: {
    orderBy: { versionNumber: 'desc' },
    include: {
      modifiedBy: { select: { id: true, name: true } },
      product: { select: { id: true, name: true } }
    }
  }
};

export const findProposalsList = async ({ where, skip = 0, take = 20, orderBy }) => {
  const [total, proposals] = await prisma.$transaction([
    prisma.proposal.count({ where }),
    prisma.proposal.findMany({ where, skip, take, orderBy, include: LIST_INCLUDE }),
  ]);
  return { total, proposals };
};

export const findProposalById = async (id, extraWhere = {}) => {
  return prisma.proposal.findFirst({
    where: { id: Number(id), isDeleted: false, ...extraWhere },
    include: DETAIL_INCLUDE
  });
};

export const countProposalsInCompany = async (companyId) => {
  return prisma.proposal.count({
    where: { companyId }
  });
};

export const findAcceptedProposalForOpportunity = async (opportunityId) => {
  return prisma.proposal.findFirst({
    where: {
      opportunityId: Number(opportunityId),
      status: 'ACCEPTED',
      isDeleted: false
    }
  });
};
