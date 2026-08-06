import prisma from '../../config/db.js';
import * as opportunityRepository from './opportunity.repository.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../../utils/AppError.js';
import { ROLE_RANKS } from '../../config/roleConstants.js';

/**
 * Creates a new Opportunity after applying HRBAC and qualification checks
 */
export const createOpportunity = async (actor, payload) => {
  const isSuperAdmin = (actor.primaryRoleRank && actor.primaryRoleRank >= 100) || actor.role === 'SUPER_ADMIN';

  // 1. Fetch Lead & verify tenant scope
  const leadWhere = {
    id: payload.leadId,
    isDeleted: false,
  };
  if (!isSuperAdmin && actor.companyId) {
    leadWhere.companyId = actor.companyId;
  }

  const lead = await prisma.lead.findFirst({
    where: leadWhere,
  });

  if (!lead) {
    throw new NotFoundError('Lead');
  }

  // 2. Business Rule 2.4: Lead qualification check (queries LeadQualification table with parallel dev toggle support)
  const isDevBypass = process.env.SKIP_QUALIFICATION_CHECK !== 'false';
  if (!isDevBypass) {
    const qualification = await prisma.leadQualification.findFirst({
      where: { leadId: payload.leadId, status: 'QUALIFIED' },
    });
    if (!qualification) {
      throw new ValidationError('Opportunities can only be created for qualified leads. Please qualify the lead first.');
    }
  }

  // Business Rule 2.4b: Active Opportunity Check (Prevent duplicate OPEN opportunities for the same lead)
  const existingOpenOpp = await prisma.opportunity.findFirst({
    where: {
      leadId: payload.leadId,
      status: 'OPEN',
      isDeleted: false,
    },
    include: { stage: true },
  });

  if (existingOpenOpp) {
    throw new ValidationError(
      `An active open opportunity ("${existingOpenOpp.opportunityName}") already exists for this lead.`
    );
  }

  // 3. Resolve ownerId:
  // For Sales Reps (BDE, Rank <= 40), the opportunity is automatically owned by the BDE creating it (actor.id).
  // For Managers/Admins (Rank >= 60), default to requested ownerId, lead's assigned BDE, or actor.id.
  let ownerId;
  if (actor.primaryRoleRank <= ROLE_RANKS.BDE) {
    ownerId = actor.id;
  } else {
    ownerId = payload.ownerId || lead.assignedToId || actor.id;
  }

  if (ownerId !== actor.id) {
    const ownerUserWhere = { id: ownerId };
    if (!isSuperAdmin && actor.companyId) {
      ownerUserWhere.companyId = actor.companyId;
    }

    const ownerUser = await prisma.user.findFirst({
      where: ownerUserWhere,
      include: { userRoles: { include: { role: true } } },
    });

    if (!ownerUser) {
      throw new NotFoundError('Owner user');
    }

    // HRBAC Rank Guard: Branch Managers (60) can only assign within branch, BDEs (40) can only self-assign
    if (actor.primaryRoleRank === ROLE_RANKS.BRANCH_MANAGER && ownerUser.branchId !== actor.branchId) {
      throw new ForbiddenError('Branch Managers can only assign opportunities to users within their branch.');
    }
    if (actor.primaryRoleRank <= ROLE_RANKS.BDE && ownerId !== actor.id) {
      throw new ForbiddenError('Sales representatives can only assign opportunities to themselves.');
    }
  }

  const targetCompanyId = actor.companyId || lead.companyId || 1;
  const targetBranchId = actor.branchId || lead.branchId;

  return opportunityRepository.createOpportunityTx(
    targetCompanyId,
    targetBranchId,
    payload,
    ownerId,
    actor.id
  );
};

/**
 * Updates an existing Opportunity with HRBAC rank guards
 */
export const updateOpportunity = async (actor, id, payload) => {
  const opportunity = await opportunityRepository.findOpportunityById(id, actor.companyId);
  if (!opportunity) {
    throw new NotFoundError('Opportunity');
  }

  // If moving a closed (WON/LOST) opportunity to an active pipeline stage, automatically re-open it
  if ((opportunity.status === 'WON' || opportunity.status === 'LOST') && payload.stageId) {
    payload.status = 'OPEN';
  } else if (opportunity.status === 'WON' || opportunity.status === 'LOST') {
    throw new ValidationError(`Closed opportunities (${opportunity.status}) are locked. Move to an active stage to re-open.`);
  }

  // HRBAC Access Guard
  if (actor.primaryRoleRank <= ROLE_RANKS.BDE && opportunity.ownerId !== actor.id) {
    throw new ForbiddenError('You can only edit opportunities assigned to you.');
  }
  if (actor.primaryRoleRank === ROLE_RANKS.BRANCH_MANAGER && opportunity.branchId !== actor.branchId) {
    throw new ForbiddenError('You can only edit opportunities within your branch.');
  }

  return opportunityRepository.updateOpportunityTx(id, actor.companyId, payload, actor.id);
};

/**
 * Closes an Opportunity (WON, LOST, CANCELLED)
 */
export const closeOpportunity = async (actor, id, payload) => {
  const opportunity = await opportunityRepository.findOpportunityById(id, actor.companyId);
  if (!opportunity) {
    throw new NotFoundError('Opportunity');
  }

  if (opportunity.status === 'WON' || opportunity.status === 'LOST') {
    throw new ValidationError(`Opportunity is already closed as ${opportunity.status}.`);
  }

  // HRBAC Guard
  if (actor.primaryRoleRank <= ROLE_RANKS.BDE && opportunity.ownerId !== actor.id) {
    throw new ForbiddenError('You can only close opportunities assigned to you.');
  }
  if (actor.primaryRoleRank === ROLE_RANKS.BRANCH_MANAGER && opportunity.branchId !== actor.branchId) {
    throw new ForbiddenError('You can only close opportunities within your branch.');
  }

  return opportunityRepository.closeOpportunityTx(id, actor.companyId, payload.outcome, actor.id);
};

/**
 * Fetches a single Opportunity detail by ID
 */
export const getOpportunityById = async (actor, id) => {
  const opportunity = await opportunityRepository.findOpportunityById(id, actor.companyId);
  if (!opportunity) {
    throw new NotFoundError('Opportunity');
  }

  // HRBAC Guard
  if (actor.primaryRoleRank <= ROLE_RANKS.BDE && opportunity.ownerId !== actor.id) {
    throw new ForbiddenError('You can only view opportunities assigned to you.');
  }
  if (actor.primaryRoleRank === ROLE_RANKS.BRANCH_MANAGER && opportunity.branchId !== actor.branchId) {
    throw new ForbiddenError('You can only view opportunities within your branch.');
  }

  return opportunity;
};

/**
 * Lists paginated opportunities with HRBAC scoping filters
 */
export const getOpportunitiesList = async (actor, queryParams) => {
  const page = parseInt(queryParams.page) || 1;
  const limit = parseInt(queryParams.limit) || 10;
  const skip = (page - 1) * limit;

  const isSuperAdmin = (actor.primaryRoleRank && actor.primaryRoleRank >= 100) || actor.role === 'SUPER_ADMIN';

  // Build HRBAC Scoped Where Object
  const where = {
    isDeleted: false,
  };

  // Restrict by companyId only for non-Super Admin users
  if (!isSuperAdmin && actor.companyId) {
    where.companyId = actor.companyId;
  }

  // Super Admin can filter by specific company
  if (isSuperAdmin && queryParams.companyId) {
    where.companyId = parseInt(queryParams.companyId);
  }

  const isCompanyAdmin = actor.primaryRoleRank >= ROLE_RANKS.COMPANY_ADMIN && !isSuperAdmin;

  // Branch Scoping for Managers
  if (actor.primaryRoleRank === ROLE_RANKS.BRANCH_MANAGER && actor.branchId) {
    where.branchId = actor.branchId;
  }
  // User Scoping for BDE / ISE — only see opportunities they own
  if (actor.primaryRoleRank <= ROLE_RANKS.BDE) {
    where.ownerId = actor.id;
  }

  // SA and Company Admin can filter by branch
  if ((isSuperAdmin || isCompanyAdmin) && queryParams.branchId) {
    where.branchId = parseInt(queryParams.branchId);
  }

  // Search filter
  if (queryParams.search) {
    where.OR = [
      { opportunityName: { contains: queryParams.search, mode: 'insensitive' } },
      { lead: { name: { contains: queryParams.search, mode: 'insensitive' } } },
    ];
  }

  // Status & Stage filters
  if (queryParams.status) {
    where.status = queryParams.status;
  }
  if (queryParams.stageId) {
    where.stageId = parseInt(queryParams.stageId);
  }
  if (queryParams.ownerId && actor.primaryRoleRank >= ROLE_RANKS.BRANCH_MANAGER) {
    where.ownerId = parseInt(queryParams.ownerId);
  }

  const { total, opportunities } = await opportunityRepository.findOpportunitiesList({
    where,
    skip,
    take: limit,
  });

  return {
    items: opportunities,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Fetches dynamic Opportunity stages for actor's company with auto-seed fallback
 */
export const getOpportunityStagesService = async (actor) => {
  const companyId = actor.companyId || 1;
  let stages = await prisma.opportunityStage.findMany({
    where: {
      companyId,
      status: 'ACTIVE',
    },
    orderBy: { displayOrder: 'asc' },
  });

  if (!stages || stages.length === 0) {
    const defaultStages = [
      { companyId, name: 'Qualification', code: 'QUALIFICATION', displayOrder: 1, colorCode: '#6366f1', defaultProbabilityPct: 10 },
      { companyId, name: 'Needs Analysis', code: 'NEEDS_ANALYSIS', displayOrder: 2, colorCode: '#3b82f6', defaultProbabilityPct: 25 },
      { companyId, name: 'Proposal', code: 'PROPOSAL', displayOrder: 3, colorCode: '#8b5cf6', defaultProbabilityPct: 50 },
      { companyId, name: 'Negotiation', code: 'NEGOTIATION', displayOrder: 4, colorCode: '#f59e0b', defaultProbabilityPct: 75 },
      { companyId, name: 'Final Review', code: 'FINAL_REVIEW', displayOrder: 5, colorCode: '#10b981', defaultProbabilityPct: 90 },
    ];
    for (const st of defaultStages) {
      await prisma.opportunityStage.upsert({
        where: { companyId_code: { companyId: st.companyId, code: st.code } },
        update: {},
        create: st,
      });
    }
    stages = await prisma.opportunityStage.findMany({
      where: { companyId, status: 'ACTIVE' },
      orderBy: { displayOrder: 'asc' },
    });
  }

  return stages;
};
