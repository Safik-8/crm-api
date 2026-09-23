import prisma from '../../config/db.js';
import * as opportunityRepository from './opportunity.repository.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../../utils/AppError.js';
import { ROLE_RANKS } from '../../config/roleConstants.js';
import { recordAuditLog } from '../auditLog/auditLog.service.js';
import { getCompanyCriteriaService, getCompanySettingsService } from '../qualification/qualification-settings.service.js';

// Delegate buildTxAuditData to central recordAuditLog service
const buildTxAuditData = (data) => recordAuditLog(data);
import { dispatchNotification } from '../notification/notification.dispatcher.js';

/**
 * Resolves the ownerId for a newly created opportunity based on actor role.
 *
 * - Non-ISE roles (BDE, BM, Admin, SuperAdmin): always own it themselves
 * - ISE (rank 20): must be in a team → tries team BDE fallback chain
 *
 * @param {object} lead - The lead being converted
 * @param {object} actor - The logged-in user (req.user)
 * @returns {number} ownerId
 */
export const resolveAutoOwner = async (lead, actor) => {
  // Non-ISE: BDE, BM, Admin, SuperAdmin always own it themselves
  if (actor.primaryRoleRank !== ROLE_RANKS.ISE) {
    return actor.id;
  }

  // ISE path: must be in a team, fallback to BDE via chain
  // P1: lead's assigned team → that team's active BDE
  if (lead.teamId) {
    const team = await prisma.team.findFirst({
      where: { id: lead.teamId, isDeleted: false, status: 'ACTIVE' },
      include: { bde: { select: { id: true, status: true } } }
    });
    if (team?.bde?.status === 'ACTIVE') return team.bde.id;
  }

  // P2: ISE's own active TeamMember record → that team's active BDE
  const membership = await prisma.teamMember.findFirst({
    where: {
      userId: actor.id,
      removedAt: null,
      team: { isDeleted: false, status: 'ACTIVE' }
    },
    include: { team: { include: { bde: { select: { id: true, status: true } } } } }
  });
  if (membership?.team?.bde?.status === 'ACTIVE') return membership.team.bde.id;

  // P3: Active Branch Manager of lead's branch
  if (lead.branchId) {
    const bm = await prisma.user.findFirst({
      where: {
        branchId: lead.branchId,
        status: 'ACTIVE',
        userRoles: { some: { role: { name: 'BRANCH_MANAGER' }, isPrimary: true } }
      },
      select: { id: true }
    });
    if (bm) return bm.id;
  }

  // P4: Safety net — ISE themselves (admin should reassign via UI)
  return actor.id;
};

/**
 * Creates a new Opportunity after applying HRBAC and active opportunity checks
 */
export const createOpportunity = async (actor, payload, req = null) => {
  const isSuperAdmin = (actor.primaryRoleRank && actor.primaryRoleRank >= 100) || actor.primaryRole === 'SUPER_ADMIN';

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
  const ownerId = await resolveAutoOwner(lead, actor);

  const targetCompanyId = actor.companyId || lead.companyId || 1;
  const targetBranchId = actor.branchId || lead.branchId;

  const createdOpp = await opportunityRepository.createOpportunityTx(
    targetCompanyId,
    targetBranchId,
    payload,
    ownerId,
    actor.id,
    req
  );

  dispatchNotification({
    eventType: "OPPORTUNITY_CREATED",
    companyId: targetCompanyId,
    branchId: targetBranchId,
    senderId: actor.id,
    recipientIds: [ownerId && ownerId !== actor.id ? ownerId : null].filter(Boolean),
    opportunityId: createdOpp.id,
    leadId: payload.leadId,
    title: "New Opportunity Created",
    message: `Opportunity "${createdOpp.opportunityName}" has been created.`,
    actionUrl: `/opportunities/${createdOpp.id}`,
  });

  return createdOpp;
};

/**
 * Called when a lead is dragged to the CLOSURE stage on the Kanban board.
 * Atomically:
 *   - Creates an opportunity at the default (Qualification) stage
 *   - Marks the lead as CONVERTED + CLOSED
 *   - Resolves owner by role (ISE → team BDE, others → self)
 *   - Sends in-app notification to BDE if actor is ISE
 */
export const createOpportunityFromClosure = async (actor, payload, req = null) => {
  const isSuperAdmin =
    actor.primaryRoleRank >= ROLE_RANKS.SUPER_ADMIN ||
    actor.primaryRole === 'SUPER_ADMIN';

  // 1. Fetch lead with tenant scope guard
  const leadWhere = { id: Number(payload.leadId), isDeleted: false };
  if (!isSuperAdmin && actor.companyId) leadWhere.companyId = actor.companyId;

  const lead = await prisma.lead.findFirst({ where: leadWhere });
  if (!lead) throw new NotFoundError('Lead');

  // 2. Guard: lead not already converted
  if (lead.qualificationStatus === 'CONVERTED') {
    throw new ValidationError(
      'This lead has already been converted to an opportunity. It cannot be closed again.'
    );
  }

  // 3. Guard: no duplicate open opportunity
  const existingOpenOpp = await prisma.opportunity.findFirst({
    where: { leadId: Number(payload.leadId), status: 'OPEN', isDeleted: false }
  });
  if (existingOpenOpp) {
    throw new ValidationError(
      `An active opportunity already exists for this lead: "${existingOpenOpp.opportunityName}". ` +
      `Please close or cancel it before creating a new one.`
    );
  }

  // 4. Resolve owner by role
  const targetCompanyId = actor.companyId || lead.companyId;
  const targetBranchId  = actor.branchId  || lead.branchId;
  const ownerId = await resolveAutoOwner(lead, actor);
  const opportunityName = `${lead.name} - Opportunity`;

  // 5. Resolve closure stage for the lead's pipeline (from payload or pipeline lookup)
  let closureStageId = payload.stageId ? Number(payload.stageId) : null;
  if (!closureStageId && lead.pipelineId) {
    const pipelineClosure = await prisma.pipelineStage.findFirst({
      where: {
        pipelineId: lead.pipelineId,
        stage: { stageType: 'CLOSURE' },
      },
      select: { stageId: true },
    });
    if (pipelineClosure) {
      closureStageId = pipelineClosure.stageId;
    }
  }

  // 6. Atomic DB transaction: create opportunity + mark lead CONVERTED + move to CLOSURE stage
  const createdOpp = await opportunityRepository.createOpportunityTx(
    targetCompanyId,
    targetBranchId,
    {
      opportunityName,
      leadId:          Number(payload.leadId),
      leadStageId:     closureStageId,
      expectedRevenue: Number(payload.expectedRevenue),
      closingDate:     payload.closingDate,
      productId: payload.productId
        ? Number(payload.productId)
        : (lead.courseId || null),
    },
    ownerId,
    actor.id,
    req
  );

  // 6. Notify assigned owner if different from actor (ISE → BDE case)
  if (ownerId !== actor.id) {
    dispatchNotification({
      eventType:     'OPPORTUNITY_CREATED',
      companyId:     targetCompanyId,
      branchId:      targetBranchId,
      senderId:      actor.id,
      recipientIds:  [ownerId],
      opportunityId: createdOpp.id,
      leadId:        Number(payload.leadId),
      title:         'New Opportunity Assigned to You',
      message:       `Opportunity "${opportunityName}" has been created from pipeline closure and assigned to you.`,
      actionUrl:     `/opportunities/${createdOpp.id}`,
    });
  }

  return createdOpp;
};

/**
 * Updates an existing Opportunity with HRBAC rank guards
 */
export const updateOpportunity = async (actor, id, payload, req = null) => {
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
  if (actor.primaryRoleRank >= 41 && actor.primaryRoleRank <= ROLE_RANKS.BRANCH_MANAGER && opportunity.branchId !== actor.branchId) {
    throw new ForbiddenError('You can only edit opportunities within your branch.');
  }

  return opportunityRepository.updateOpportunityTx(id, actor.companyId, payload, actor.id, req);
};

/**
 * Closes an Opportunity (WON, LOST, CANCELLED)
 */
export const closeOpportunity = async (actor, id, payload, req = null) => {
  const opportunity = await opportunityRepository.findOpportunityById(id, actor.companyId);
  if (!opportunity) {
    throw new NotFoundError('Opportunity');
  }

  if (opportunity.status === 'WON' || opportunity.status === 'LOST' || opportunity.status === 'CANCELLED') {
    throw new ValidationError(`Opportunity is already closed as ${opportunity.status}.`);
  }

  // HRBAC Guard
  if (actor.primaryRoleRank <= ROLE_RANKS.BDE && opportunity.ownerId !== actor.id) {
    throw new ForbiddenError('You can only close opportunities assigned to you.');
  }
  if (actor.primaryRoleRank >= 41 && actor.primaryRoleRank <= ROLE_RANKS.BRANCH_MANAGER && opportunity.branchId !== actor.branchId) {
    throw new ForbiddenError('You can only close opportunities within your branch.');
  }

  return opportunityRepository.closeOpportunityTx(id, actor.companyId, payload.outcome, actor.id, payload.remarks, payload.reasonId, req);
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
  if (actor.primaryRoleRank <= ROLE_RANKS.BDE && opportunity.ownerId !== actor.id && opportunity.createdById !== actor.id) {
    throw new ForbiddenError('You can only view opportunities assigned to you or created by you.');
  }
  if (actor.primaryRoleRank >= 41 && actor.primaryRoleRank <= ROLE_RANKS.BRANCH_MANAGER && opportunity.branchId !== actor.branchId) {
    throw new ForbiddenError('You can only view opportunities within your branch.');
  }

  return opportunity;
};

/**
 * Lists Opportunities with Dynamic Scoping
 */
export const getOpportunitiesList = async (actor, queryParams = {}) => {
  const page  = Math.max(1, parseInt(queryParams.page)  || 1);
  const limit = Math.min(100, parseInt(queryParams.limit) || 20);
  const skip  = (page - 1) * limit;

  const where = {};
  const isSuperAdmin = (actor.primaryRoleRank && actor.primaryRoleRank >= 100) || actor.primaryRole === 'SUPER_ADMIN';

  // Company Scoping
  if (actor.companyId && !isSuperAdmin) {
    where.companyId = actor.companyId;
  }

  // Super Admin can filter by specific company
  if (isSuperAdmin && queryParams.companyId) {
    where.companyId = parseInt(queryParams.companyId);
  }

  const isCompanyAdmin = actor.primaryRoleRank >= 61 && !isSuperAdmin;

  // Branch Scoping for Managers (Branch Manager + Level 2 custom roles 41..60)
  if (actor.primaryRoleRank >= 41 && actor.primaryRoleRank <= ROLE_RANKS.BRANCH_MANAGER && actor.branchId) {
    where.branchId = actor.branchId;
  }

  // Scope filter: "mine" vs "all"
  const isMineScope = queryParams.scope === 'mine' || queryParams.mine === 'true' || queryParams.mine === true;

  if (isMineScope) {
    // When "mine" is selected, reps and managers see only what is assigned to them (ISE also sees what they created)
    if (actor.primaryRoleRank <= ROLE_RANKS.ISE) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { ownerId: actor.id },
          { createdById: actor.id }
        ]
      });
    } else {
      where.ownerId = actor.id;
    }
  } else {
    // "all" scope:
    // BDE (rank 40) / ISE (rank 20): see opportunities owned or created by them (and their team)
    if (actor.primaryRoleRank <= ROLE_RANKS.BDE) {
      where.AND = where.AND || [];
      where.AND.push({
        OR: [
          { ownerId: actor.id },
          { createdById: actor.id }
        ]
      });
    }
    // BM (rank 60): sees all in branch (via where.branchId above)
    // Company Admin (rank 80): sees all in company (via where.companyId above)
  }

  // SA and Company Admin can filter by branch
  if ((isSuperAdmin || isCompanyAdmin) && queryParams.branchId) {
    where.branchId = parseInt(queryParams.branchId);
  }

  // Search filter
  if (queryParams.search) {
    const term = queryParams.search.trim();
    where.AND = where.AND || [];
    where.AND.push({
      OR: [
        { opportunityName: { contains: term, mode: 'insensitive' } },
        { lead: { name: { contains: term, mode: 'insensitive' } } },
        { lead: { mobile: { contains: term, mode: 'insensitive' } } },
        { lead: { email: { contains: term, mode: 'insensitive' } } },
      ]
    });
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

export const getOpportunities = getOpportunitiesList;

/**
 * Fetches dynamic Opportunity stages for actor's company with auto-seed fallback
 */
/**
 * Fetches dynamic Opportunity stages for actor's company with auto-seed fallback
 */
export const getOpportunityStagesService = async (actor, includeInactive = false, queryCompanyId = null) => {
  const isSuperAdmin = actor.primaryRole === 'SUPER_ADMIN';
  const companyId = isSuperAdmin && queryCompanyId ? Number(queryCompanyId) : (actor.companyId || 1);
  const where = { companyId };
  if (!includeInactive) {
    where.status = 'ACTIVE';
  }

  let stages = await prisma.opportunityStage.findMany({
    where,
    orderBy: { displayOrder: 'asc' },
  });

  if (!stages || stages.length === 0) {
    const defaultStages = [
      { companyId, name: 'Qualification', code: 'QUALIFICATION', displayOrder: 1, colorCode: '#6366f1', defaultProbabilityPct: 10, stageType: 'QUALIFICATION', isSystem: true },
      { companyId, name: 'Needs Analysis', code: 'NEEDS_ANALYSIS', displayOrder: 2, colorCode: '#3b82f6', defaultProbabilityPct: 25, stageType: 'REGULAR', isSystem: false },
      { companyId, name: 'Proposal', code: 'PROPOSAL', displayOrder: 3, colorCode: '#8b5cf6', defaultProbabilityPct: 50, stageType: 'REGULAR', isSystem: false },
      { companyId, name: 'Negotiation', code: 'NEGOTIATION', displayOrder: 4, colorCode: '#f59e0b', defaultProbabilityPct: 75, stageType: 'REGULAR', isSystem: false },
      { companyId, name: 'Final Review', code: 'FINAL_REVIEW', displayOrder: 5, colorCode: '#10b981', defaultProbabilityPct: 90, stageType: 'REGULAR', isSystem: false },
      { companyId, name: 'Won', code: 'WON', displayOrder: 6, colorCode: '#10b981', defaultProbabilityPct: 100, stageType: 'WON', isSystem: true },
      { companyId, name: 'Lost', code: 'LOST', displayOrder: 7, colorCode: '#ef4444', defaultProbabilityPct: 0, stageType: 'LOST', isSystem: true },
      { companyId, name: 'Cancelled', code: 'CANCELLED', displayOrder: 8, colorCode: '#6b7280', defaultProbabilityPct: 0, stageType: 'CANCELLED', isSystem: true },
    ];
    for (const st of defaultStages) {
      await prisma.opportunityStage.upsert({
        where: { companyId_code: { companyId: st.companyId, code: st.code } },
        update: {},
        create: st,
      });
    }
    stages = await prisma.opportunityStage.findMany({
      where,
      orderBy: { displayOrder: 'asc' },
    });
  }

  return stages;
};

/**
 * Fetch active Win/Loss reasons for a company
 */
export const getWinLossReasonsService = async (actor, queryCompanyId = null) => {
  const isSuperAdmin = actor.primaryRole === 'SUPER_ADMIN';
  const companyId = isSuperAdmin && queryCompanyId ? Number(queryCompanyId) : (actor.companyId || 1);
  const where = { companyId, status: 'ACTIVE' };
  const reasons = await prisma.winLossReason.findMany({
    where,
    orderBy: { id: 'asc' },
  });
  return reasons;
};

/**
 * Creates a new Opportunity Stage
 */
export const createOpportunityStage = async (actor, payload) => {
  const companyId = actor.companyId || payload.companyId || 1;
  const name = payload.name.trim();

  // Code derivation if not provided
  const code = payload.code
    ? payload.code.trim().toUpperCase()
    : name.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').slice(0, 50);

  // Check unique constraint (companyId + code)
  const existingCode = await prisma.opportunityStage.findFirst({
    where: { companyId, code },
  });
  if (existingCode) {
    throw new ValidationError('A stage with this code already exists for this company.');
  }

  return prisma.opportunityStage.create({
    data: {
      companyId,
      name,
      code,
      stageType: payload.stageType || 'REGULAR',
      displayOrder: payload.displayOrder ?? 0,
      colorCode: payload.colorCode || '#6366f1',
      defaultProbabilityPct: payload.defaultProbabilityPct ?? 10,
      isSystem: false,
      status: 'ACTIVE',
      createdById: actor.id,
    },
  });
};

/**
 * Updates an Opportunity Stage
 */
export const updateOpportunityStage = async (actor, id, payload) => {
  const companyId = actor.companyId || payload.companyId || 1;
  const stage = await prisma.opportunityStage.findFirst({
    where: { id: Number(id), companyId },
  });

  if (!stage) {
    throw new NotFoundError('Opportunity Stage');
  }

  // System stage restrictions
  if (stage.isSystem) {
    if (payload.name && payload.name.trim() !== stage.name) {
      throw new ValidationError('System stages cannot be renamed.');
    }
    if (payload.stageType && payload.stageType !== stage.stageType) {
      throw new ValidationError('System stage types cannot be altered.');
    }
  }

  const updateData = {
    updatedById: actor.id,
  };

  if (payload.name) updateData.name = payload.name.trim();
  if (payload.displayOrder !== undefined) updateData.displayOrder = payload.displayOrder;
  if (payload.colorCode) updateData.colorCode = payload.colorCode;
  if (payload.defaultProbabilityPct !== undefined) {
    updateData.defaultProbabilityPct = payload.defaultProbabilityPct;
  }
  if (!stage.isSystem && payload.stageType) {
    updateData.stageType = payload.stageType;
  }

  return prisma.opportunityStage.update({
    where: { id: stage.id },
    data: updateData,
  });
};

/**
 * Toggles an Opportunity Stage status (ACTIVE/INACTIVE)
 */
export const toggleOpportunityStage = async (actor, id, status, payloadCompanyId) => {
  const companyId = actor.companyId || payloadCompanyId || 1;
  const stage = await prisma.opportunityStage.findFirst({
    where: { id: Number(id), companyId },
  });

  if (!stage) {
    throw new NotFoundError('Opportunity Stage');
  }

  if (stage.isSystem && status === 'INACTIVE') {
    throw new ValidationError('System stages cannot be deactivated.');
  }

  return prisma.opportunityStage.update({
    where: { id: stage.id },
    data: {
      status: status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE',
      updatedById: actor.id,
    },
  });
};

/**
 * Deletes an Opportunity Stage (soft delete via status INACTIVE and removing from list)
 * We check if used in opportunities first.
 */
export const deleteOpportunityStage = async (actor, id, payloadCompanyId) => {
  const companyId = actor.companyId || payloadCompanyId || 1;
  const stage = await prisma.opportunityStage.findFirst({
    where: { id: Number(id), companyId },
  });

  if (!stage) {
    throw new NotFoundError('Opportunity Stage');
  }

  if (stage.isSystem) {
    throw new ValidationError('System stages cannot be deleted.');
  }

  // Check if used in any active/deleted opportunities
  const count = await prisma.opportunity.count({
    where: { stageId: stage.id },
  });
  if (count > 0) {
    throw new ValidationError('Cannot delete stage as it is currently linked to existing opportunities.');
  }

  // Delete stage record completely since it has no dependency
  return prisma.opportunityStage.delete({
    where: { id: stage.id },
  });
};

/**
 * Bulk updates Opportunity Stages (display order and status)
 */
export const bulkUpdateOpportunityStagesService = async (actor, payload) => {
  const isSuperAdmin = actor.primaryRole === 'SUPER_ADMIN';
  const companyId = isSuperAdmin && payload.companyId ? Number(payload.companyId) : (actor.companyId || 1);
  const { stageOrders } = payload;

  // 1. Fetch current stages state to get names
  const stageIds = stageOrders.map((item) => Number(item.id));
  const existingStages = await prisma.opportunityStage.findMany({
    where: { id: { in: stageIds }, companyId },
  });
  const stagesMap = new Map(existingStages.map((s) => [s.id, s]));

  // 2. Validate deactivation requests
  for (const item of stageOrders) {
    const stageId = Number(item.id);
    const existingStage = stagesMap.get(stageId);
    if (!existingStage) continue;

    if (item.status === 'INACTIVE' && existingStage.status === 'ACTIVE') {
      const activeCount = await prisma.opportunity.count({
        where: {
          stageId,
          companyId,
          status: 'OPEN',
          isDeleted: false,
        },
      });
      if (activeCount > 0) {
        throw new ValidationError(
          `Cannot deactivate stage "${existingStage.name}" as it currently has ${activeCount} active opportunities. Please move them first.`
        );
      }
    }
  }

  const isStartStage = (s) =>
    s.stageType === 'QUALIFICATION' ||
    s.code === 'QUALIFICATION' ||
    s.name?.toLowerCase() === 'qualification' ||
    s.stageType === 'PROSPECT' ||
    s.code === 'PROSPECT' ||
    s.name?.toLowerCase() === 'prospect';

  const isTerminalStage = (s) => {
    const type = (s.stageType || s.code || '').toUpperCase();
    const name = (s.name || '').toLowerCase();
    return ['WON', 'LOST', 'CANCELLED'].includes(type) || ['won', 'lost', 'cancelled'].includes(name);
  };

  // 3. Re-assign order bounds to prevent dragging/reordering outside start & end stages
  const activeIncomingStages = stageOrders
    .filter((item) => {
      const existing = stagesMap.get(Number(item.id));
      return existing && item.status !== 'INACTIVE';
    })
    .map((item) => {
      const existing = stagesMap.get(Number(item.id));
      return {
        ...item,
        stageType: existing.stageType,
        code: existing.code,
        name: existing.name
      };
    });

  const firstStage = activeIncomingStages.find((s) => isStartStage(s));
  const terminalStages = activeIncomingStages.filter((s) => isTerminalStage(s));
  const middleStages = activeIncomingStages.filter((s) => !isStartStage(s) && !isTerminalStage(s));

  // Sort middle stages by displayOrder
  middleStages.sort((a, b) => Number(a.displayOrder) - Number(b.displayOrder));

  // Sort terminal stages by fixed terminal sequence order
  const terminalOrder = ['WON', 'LOST', 'CANCELLED'];
  const getTerminalWeight = (s) => {
    const type = (s.stageType || s.code || '').toUpperCase();
    const idx = terminalOrder.indexOf(type);
    if (idx !== -1) return idx;
    const name = (s.name || '').toLowerCase();
    return terminalOrder.indexOf(name.toUpperCase());
  };
  terminalStages.sort((a, b) => getTerminalWeight(a) - getTerminalWeight(b));

  const finalOrderedUpdates = [];
  let currentOrder = 1;

  if (firstStage) {
    finalOrderedUpdates.push({ id: firstStage.id, displayOrder: currentOrder++ });
  }
  for (const ms of middleStages) {
    finalOrderedUpdates.push({ id: ms.id, displayOrder: currentOrder++ });
  }
  for (const ts of terminalStages) {
    finalOrderedUpdates.push({ id: ts.id, displayOrder: currentOrder++ });
  }

  const orderMap = new Map(finalOrderedUpdates.map((u) => [u.id, u.displayOrder]));

  // 4. Apply updates
  const updates = stageOrders.map((item) => {
    const stageId = Number(item.id);
    const resolvedOrder = orderMap.get(stageId) ?? 999;
    return prisma.opportunityStage.update({
      where: { id: stageId, companyId },
      data: {
        displayOrder: resolvedOrder,
        status: item.status,
        updatedById: actor.id,
      },
    });
  });

  await prisma.$transaction(updates);
  return { success: true };
};

/**
 * Move Opportunity Stage & Update status / probability
 */
export const moveOpportunityStage = async (actor, id, payload, req = null) => {
  const isSuperAdmin = (actor.primaryRoleRank && actor.primaryRoleRank >= 100) || actor.primaryRole === 'SUPER_ADMIN';
  const opportunityWhere = { id: Number(id), isDeleted: false };
  if (!isSuperAdmin && actor.companyId) {
    opportunityWhere.companyId = actor.companyId;
  }

  const opportunity = await prisma.opportunity.findFirst({
    where: opportunityWhere,
    include: { stage: true },
  });

  if (!opportunity) {
    throw new NotFoundError('Opportunity');
  }

  const companyId = opportunity.companyId;

  // RBAC Permission Guard
  const rank = actor.primaryRoleRank || 0;
  if (rank <= ROLE_RANKS.BDE && opportunity.ownerId !== actor.id) {
    throw new ForbiddenError('BDEs can only move their own opportunities.');
  }
  if (rank === ROLE_RANKS.BRANCH_MANAGER && opportunity.branchId !== actor.branchId) {
    throw new ForbiddenError('Branch Managers can only move opportunities within their branch.');
  }

  // 1. Opportunity must be OPEN
  if (opportunity.status !== 'OPEN') {
    throw new ValidationError('Closed opportunities (WON, LOST, CANCELLED) cannot be moved.');
  }

  // 2. Fetch target stage
  const newStage = await prisma.opportunityStage.findFirst({
    where: { id: payload.newStageId, companyId, status: 'ACTIVE' },
  });

  if (!newStage) {
    throw new ValidationError('Target stage not found or is inactive.');
  }

  // Determine closure status based on stageType
  let targetStatus = 'OPEN';
  if (newStage.stageType === 'WON') {
    targetStatus = 'WON';
  } else if (newStage.stageType === 'LOST') {
    targetStatus = 'LOST';
    if (!payload.reasonId) {
      throw new ValidationError('A reason ID is required when marking an opportunity as LOST.');
    }
  } else if (newStage.stageType === 'CANCELLED') {
    targetStatus = 'CANCELLED';
  }

  return prisma.$transaction(async (tx) => {
    // 1. Create stage history record
    await tx.opportunityStageHistory.create({
      data: {
        opportunityId: opportunity.id,
        companyId,
        branchId: opportunity.branchId,
        previousStageId: opportunity.stageId,
        newStageId: newStage.id,
        changedById: actor.id,
        remarks: payload.remarks || null,
      },
    });

    // 2. Update Opportunity
    const updatedOpp = await tx.opportunity.update({
      where: { id: opportunity.id },
      data: {
        stageId: newStage.id,
        probabilityPercentage: newStage.defaultProbabilityPct ?? opportunity.probabilityPercentage,
        status: targetStatus,
        updatedById: actor.id,
      },
      include: { stage: true },
    });

    // 3. Log Lead Activity
    await tx.leadActivity.create({
      data: {
        leadId: opportunity.leadId,
        companyId,
        activityType: 'OPPORTUNITY_STAGE_CHANGED',
        description: `Moved opportunity "${opportunity.opportunityName}" from "${opportunity.stage.name}" to "${newStage.name}" (Status: ${targetStatus})`,
        relatedEntityType: 'OPPORTUNITY',
        relatedEntityId: opportunity.id,
        performedById: actor.id,
      },
    });

    // 4. Log Audit Trail
    await recordAuditLog({
      req,
      tx,
      companyId,
      moduleName: 'OPPORTUNITY',
      actionType: 'UPDATE',
      entityType: 'OPPORTUNITY',
      entityId: opportunity.id,
      action: 'OPPORTUNITY_STAGE_CHANGED',
      oldValue: { stageId: opportunity.stageId, status: opportunity.status },
      newValue: { stageId: newStage.id, status: targetStatus },
      performedById: actor.id,
    });

    // If moved to a terminal stage, create deal/customer/revenue idempotently
    if (['WON', 'LOST', 'CANCELLED'].includes(targetStatus)) {
      await opportunityRepository.createDealCustomerRevenueIfNeeded(tx, updatedOpp, targetStatus, actor.id, payload.reasonId, null, req);
    }

    return updatedOpp;
  });
};

/**
 * Qualifies an Opportunity by computing a score from company criteria.
 * Stores the score on the Opportunity record itself — does NOT touch Lead qualification tables.
 *
 * @param {number} opportunityId
 * @param {Object} data - criteria values keyed by criterion.key
 * @param {Object} actor - req.user
 * @param {Object} [req] - Express request object for audit telemetry
 * @returns {Promise<Object>} updated opportunity with qualificationScore and qualificationData
 */
export const qualifyOpportunityService = async (opportunityId, data, actor, req = null) => {
  const isSuperAdmin =
    (actor.primaryRoleRank && actor.primaryRoleRank >= 100) ||
    actor.primaryRole === 'SUPER_ADMIN';

  // 1. Fetch opportunity with HRBAC tenant scope
  const oppWhere = { id: Number(opportunityId), isDeleted: false };
  if (!isSuperAdmin && actor.companyId) {
    oppWhere.companyId = actor.companyId;
  }

  const opportunity = await prisma.opportunity.findFirst({
    where: oppWhere,
    include: { stage: true },
  });

  if (!opportunity) {
    throw new NotFoundError('Opportunity');
  }

  // 2. HRBAC rank guards (mirrors updateOpportunity)
  const rank = actor.primaryRoleRank || 0;
  if (rank <= ROLE_RANKS.BDE && opportunity.ownerId !== actor.id) {
    throw new ForbiddenError('You can only qualify opportunities assigned to you.');
  }
  if (
    rank >= 41 &&
    rank <= ROLE_RANKS.BRANCH_MANAGER &&
    opportunity.branchId !== actor.branchId
  ) {
    throw new ForbiddenError('You can only qualify opportunities within your branch.');
  }

  // 3. Load company qualification criteria & settings
  const companyId = opportunity.companyId;
  const [criteriaList, companySettings] = await Promise.all([
    getCompanyCriteriaService(companyId),
    getCompanySettingsService(companyId),
  ]);

  // 4. Validate required criteria fields
  for (const criterion of criteriaList) {
    if (criterion.isRequired) {
      const val = data[criterion.key];
      if (val === undefined || val === null || val === '') {
        throw new ValidationError(
          `Field "${criterion.label}" is required for qualification. Please complete all required criteria fields.`
        );
      }
    }
  }

  // 5. Compute score using the same algorithm as evaluateLeadService
  let rawScore = 0;
  for (const c of criteriaList) {
    const val = data[c.key];
    if (c.fieldType === 'boolean' && Boolean(val)) {
      rawScore += Number(c.maxPoints) || 0;
    } else if (c.fieldType === 'select') {
      if (Array.isArray(c.options)) {
        const matchedOpt = c.options.find((opt) => opt.value === val);
        if (matchedOpt) {
          rawScore += Number(matchedOpt.points) || 0;
        }
      }
    } else if (c.fieldType === 'number') {
      if (val !== undefined && val !== null && !isNaN(val)) {
        const numVal = Number(val);
        rawScore += Math.min(Number(c.maxPoints) || 0, Math.max(0, numVal));
      }
    }
  }

  // Normalize 0–100
  const computedScore = Math.min(100, Math.max(0, rawScore));
  const passThreshold = companySettings?.passThreshold ?? 60;
  const actorName =
    actor.name ||
    [actor.firstName, actor.lastName].filter(Boolean).join(' ') ||
    actor.email ||
    'User';

  const qualPayload = {
    score: computedScore,
    passThreshold,
    passed: computedScore >= passThreshold,
    answers: data,
    criteriaSnapshot: criteriaList,
    evaluatedById: actor.id,
    evaluatedByName: actorName,
    evaluatedAt: new Date().toISOString(),
  };

  // 6. Atomic Transaction: Persist score + qualificationData snapshot, log LeadActivity & AuditLog
  const updatedOpportunity = await prisma.$transaction(async (tx) => {
    const updated = await tx.opportunity.update({
      where: { id: opportunity.id },
      data: {
        qualificationScore: computedScore,
        qualifiedAt: new Date(),
        qualificationData: qualPayload,
        updatedById: actor.id,
      },
      include: {
        stage: true,
        lead: { select: { id: true, name: true, mobile: true, email: true, qualificationScore: true } },
        owner: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
      },
    });

    // 7. Log Lead Activity for audit visibility on the linked lead
    if (opportunity.leadId) {
      await tx.leadActivity.create({
        data: {
          leadId: opportunity.leadId,
          companyId: opportunity.companyId,
          activityType: 'OPPORTUNITY_QUALIFIED',
          description: `Opportunity "${opportunity.opportunityName}" was qualified with score ${computedScore}% by ${actorName}`,
          relatedEntityType: 'OPPORTUNITY',
          relatedEntityId: opportunity.id,
          performedById: actor.id,
        },
      });
    }

    // 8. Record audit log
    await recordAuditLog({
      req,
      tx,
      companyId: opportunity.companyId,
      branchId: opportunity.branchId,
      moduleName: 'OPPORTUNITY',
      actionType: 'UPDATE',
      entityType: 'OPPORTUNITY',
      entityId: opportunity.id,
      action: 'OPPORTUNITY_QUALIFIED',
      oldValue: {
        score: opportunity.qualificationScore,
      },
      newValue: {
        score: computedScore,
        qualificationData: qualPayload,
        evaluatedById: actor.id,
        evaluatedByName: actorName,
      },
      performedById: actor.id,
    });

    return updated;
  });

  return {
    opportunity: updatedOpportunity,
    score: computedScore,
    passThreshold,
    qualificationData: qualPayload,
  };
};
