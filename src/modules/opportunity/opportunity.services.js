import prisma from '../../config/db.js';
import * as opportunityRepository from './opportunity.repository.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../../utils/AppError.js';
import { ROLE_RANKS } from '../../config/roleConstants.js';
import { recordAuditLog } from '../auditLog/auditLog.service.js';

// Delegate buildTxAuditData to central recordAuditLog service
const buildTxAuditData = (data) => recordAuditLog(data);
import { dispatchNotification } from '../notification/notification.dispatcher.js';

/**
 * Creates a new Opportunity after applying HRBAC and qualification checks
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
  // For Managers/Admins (Rank >= 60), default to requested ownerId, lead's assigned BDE (if in same company), or actor.id.
  let ownerId;
  if (actor.primaryRoleRank <= ROLE_RANKS.BDE) {
    ownerId = actor.id;
  } else {
    const candidateOwnerId = payload.ownerId || lead.assignedToId;
    if (candidateOwnerId) {
      const ownerWhere = { id: candidateOwnerId };
      if (!isSuperAdmin && actor.companyId) {
        ownerWhere.companyId = actor.companyId;
      }
      const validOwner = await prisma.user.findFirst({ where: ownerWhere });
      if (validOwner) {
        ownerId = validOwner.id;
      }
    }
    if (!ownerId) {
      ownerId = actor.id;
    }
  }

  if (ownerId !== actor.id) {
    const ownerUser = await prisma.user.findFirst({
      where: { id: ownerId },
      include: { userRoles: { include: { role: true } } },
    });

    if (actor.primaryRoleRank === ROLE_RANKS.BRANCH_MANAGER && ownerUser && ownerUser.branchId !== actor.branchId) {
      throw new ForbiddenError('Branch Managers can only assign opportunities to users within their branch.');
    }
    if (actor.primaryRoleRank <= ROLE_RANKS.BDE && ownerId !== actor.id) {
      throw new ForbiddenError('Sales representatives can only assign opportunities to themselves.');
    }
  }

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
  if (actor.primaryRoleRank === ROLE_RANKS.BRANCH_MANAGER && opportunity.branchId !== actor.branchId) {
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
  if (actor.primaryRoleRank === ROLE_RANKS.BRANCH_MANAGER && opportunity.branchId !== actor.branchId) {
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

  const isSuperAdmin = (actor.primaryRoleRank && actor.primaryRoleRank >= 100) || actor.primaryRole === 'SUPER_ADMIN';

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

