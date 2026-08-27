import prisma from '../../config/db.js';
import * as proposalRepo from './proposal.repository.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../../utils/AppError.js';
import { recordAuditLog } from '../auditLog/auditLog.service.js';
import { ROLE_RANKS } from '../../config/roleConstants.js';

// Helper to check user authority scope
const validateScopeAndGetProposal = async (actor, id) => {
  const rank = actor.primaryRoleRank ?? 0;
  const proposal = await proposalRepo.findProposalById(id);

  if (!proposal || proposal.isDeleted) {
    throw new NotFoundError('Proposal');
  }

  // Tenant Isolation
  if (actor.primaryRole !== 'SUPER_ADMIN' && proposal.companyId !== actor.companyId) {
    throw new ForbiddenError('Access denied: different company scope');
  }

  // Branch Scope
  if (rank >= 60 && rank < 80 && actor.branchId && proposal.branchId !== actor.branchId) {
    throw new ForbiddenError('Access denied: different branch scope');
  }

  // BDE/ISE owner scope
  if (rank < 60 && proposal.createdById !== actor.id && proposal.opportunity?.ownerId !== actor.id) {
    throw new ForbiddenError('Access denied: own records only');
  }

  return proposal;
};

// Create Proposal
export const createProposal = async (actor, payload, req = null) => {
  const isSuperAdmin = actor.primaryRole === 'SUPER_ADMIN';
  const rank = actor.primaryRoleRank ?? 0;

  // 1. Fetch & Verify Opportunity
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: Number(payload.opportunityId) }
  });

  if (!opportunity || opportunity.isDeleted) {
    throw new NotFoundError('Opportunity');
  }

  // Tenant scope check
  if (!isSuperAdmin && actor.companyId && opportunity.companyId !== actor.companyId) {
    throw new ForbiddenError('Access denied: different company scope');
  }

  // Branch scope check for managers
  if (rank >= 60 && rank < 80 && actor.branchId && opportunity.branchId !== actor.branchId) {
    throw new ForbiddenError('Access denied: different branch scope');
  }

  // Sales rep assignment check
  if (rank < 60 && opportunity.ownerId !== actor.id) {
    throw new ForbiddenError('Access denied: can only create proposals for opportunities you own');
  }

  // Business Rule: Opportunity must be ACTIVE (not WON/LOST/CANCELLED)
  const inactiveStatuses = ['WON', 'LOST', 'CANCELLED'];
  if (inactiveStatuses.includes(opportunity.status.toUpperCase())) {
    throw new ValidationError(`Cannot create proposal for an inactive opportunity (Status: ${opportunity.status})`);
  }

  // 2. Validate Pricing Fields
  const basePrice = parseFloat(payload.basePrice);
  const discount = parseFloat(payload.discount || 0);

  if (isNaN(basePrice) || basePrice <= 0) {
    throw new ValidationError('Base price must be a positive number');
  }
  if (isNaN(discount) || discount < 0) {
    throw new ValidationError('Discount cannot be negative');
  }
  if (discount > basePrice) {
    throw new ValidationError('Discount cannot exceed base price');
  }

  const finalAmount = basePrice - discount;

  // 3. Resolve Company Code & Generate Proposal Number
  const company = await prisma.company.findUnique({
    where: { id: opportunity.companyId },
    select: { code: true }
  });
  const companyCode = company ? company.code.toUpperCase() : 'CO';
  const currentYear = new Date().getFullYear();

  const proposalCount = await proposalRepo.countProposalsInCompany(opportunity.companyId);
  const propSeq = (proposalCount + 1).toString().padStart(4, '0');
  const proposalNumber = `PROP-${companyCode}-${currentYear}-${propSeq}`;

  // 4. Create Proposal and Version 1 in a Transaction
  return prisma.$transaction(async (tx) => {
    const proposal = await tx.proposal.create({
      data: {
        companyId: opportunity.companyId,
        branchId: opportunity.branchId || null,
        proposalNumber,
        opportunityId: opportunity.id,
        productId: payload.productId ? Number(payload.productId) : null,
        basePrice,
        discount,
        finalAmount,
        validTill: new Date(payload.validTill),
        terms: payload.terms || null,
        status: 'DRAFT',
        currentVersion: 1,
        createdById: actor.id
      }
    });

    await tx.proposalVersion.create({
      data: {
        proposalId: proposal.id,
        companyId: opportunity.companyId,
        branchId: opportunity.branchId || null,
        versionNumber: 1,
        basePrice,
        discount,
        finalAmount,
        validTill: new Date(payload.validTill),
        terms: payload.terms || null,
        productId: payload.productId ? Number(payload.productId) : null,
        modifiedById: actor.id,
        versionNotes: 'Initial Draft'
      }
    });

    // Lead Activity & Audit log
    await tx.leadActivity.create({
      data: {
        leadId: opportunity.leadId,
        companyId: opportunity.companyId,
        activityType: 'PROPOSAL_CREATED',
        description: `Proposal ${proposalNumber} created for opportunity ${opportunity.opportunityName}`,
        relatedEntityType: 'PROPOSAL',
        relatedEntityId: proposal.id,
        performedById: actor.id
      }
    });

    await recordAuditLog({
      req,
      tx,
      companyId: opportunity.companyId,
      moduleName: 'PROPOSAL',
      actionType: 'CREATE',
      entityType: 'PROPOSAL',
      entityId: proposal.id,
      action: 'PROPOSAL_CREATED',
      newValue: { proposalNumber, finalAmount },
      performedById: actor.id
    });

    return proposal;
  });
};

// Update / Revise Proposal
export const updateProposal = async (actor, id, payload) => {
  const proposal = await validateScopeAndGetProposal(actor, id);

  // Status checks: ACCEPTED/REJECTED are locked
  if (['ACCEPTED', 'REJECTED'].includes(proposal.status.toUpperCase())) {
    throw new ValidationError(`Cannot edit a proposal in ${proposal.status} status.`);
  }

  // 1. Validate Pricing
  const basePrice = parseFloat(payload.basePrice);
  const discount = parseFloat(payload.discount || 0);

  if (isNaN(basePrice) || basePrice <= 0) {
    throw new ValidationError('Base price must be a positive number');
  }
  if (isNaN(discount) || discount < 0) {
    throw new ValidationError('Discount cannot be negative');
  }
  if (discount > basePrice) {
    throw new ValidationError('Discount cannot exceed base price');
  }

  const finalAmount = basePrice - discount;
  const nextVersion = proposal.currentVersion + 1;

  return prisma.$transaction(async (tx) => {
    // Update proposal main entry
    const updatedProposal = await tx.proposal.update({
      where: { id: proposal.id },
      data: {
        productId: payload.productId ? Number(payload.productId) : null,
        basePrice,
        discount,
        finalAmount,
        validTill: new Date(payload.validTill),
        terms: payload.terms || null,
        currentVersion: nextVersion,
        updatedById: actor.id
      }
    });

    // Create a new version row
    await tx.proposalVersion.create({
      data: {
        proposalId: proposal.id,
        companyId: proposal.companyId,
        branchId: proposal.branchId || null,
        versionNumber: nextVersion,
        basePrice,
        discount,
        finalAmount,
        validTill: new Date(payload.validTill),
        terms: payload.terms || null,
        productId: payload.productId ? Number(payload.productId) : null,
        modifiedById: actor.id,
        versionNotes: payload.versionNotes || `Revision V${nextVersion}`
      }
    });

    // Log Activity
    await tx.leadActivity.create({
      data: {
        leadId: proposal.opportunity.leadId,
        companyId: proposal.companyId,
        activityType: 'PROPOSAL_REVISED',
        description: `Proposal ${proposal.proposalNumber} revised to version ${nextVersion}`,
        relatedEntityType: 'PROPOSAL',
        relatedEntityId: proposal.id,
        performedById: actor.id
      }
    });

    return updatedProposal;
  });
};

// Transition Proposal Status (FSM)
export const updateProposalStatus = async (actor, id, newStatus) => {
  const proposal = await validateScopeAndGetProposal(actor, id);
  const current = proposal.status.toUpperCase();
  const target = newStatus.toUpperCase();

  if (current === target) {
    return proposal;
  }

  // FSM Constraints
  if (current === 'DRAFT') {
    if (target !== 'SENT') {
      throw new ValidationError('DRAFT proposals can only transition to SENT status first.');
    }
  } else if (current === 'SENT') {
    if (target !== 'ACCEPTED' && target !== 'REJECTED') {
      throw new ValidationError('SENT proposals can only transition to ACCEPTED or REJECTED status.');
    }
  } else {
    // ACCEPTED or REJECTED
    throw new ValidationError(`Cannot change status of a proposal that is already ${current}.`);
  }

  // Expiration check for acceptance
  if (target === 'ACCEPTED') {
    const isExpired = new Date(proposal.validTill) < new Date();
    if (isExpired) {
      throw new ValidationError('Cannot accept an expired proposal. Please revise it to extend its validity date first.');
    }
    const existingAccepted = await proposalRepo.findAcceptedProposalForOpportunity(proposal.opportunityId);
    if (existingAccepted) {
      throw new ValidationError('An accepted proposal already exists for this opportunity. Only one accepted proposal is allowed.');
    }
  }

  return prisma.$transaction(async (tx) => {
    if (target === 'ACCEPTED') {
      // Double check inside the active transaction context to prevent race condition insertions
      const existingAcceptedTx = await tx.proposal.findFirst({
        where: {
          opportunityId: proposal.opportunityId,
          status: 'ACCEPTED',
          isDeleted: false
        }
      });
      if (existingAcceptedTx) {
        throw new ValidationError('An accepted proposal already exists for this opportunity. Only one accepted proposal is allowed.');
      }
    }

    const updated = await tx.proposal.update({
      where: { id: proposal.id },
      data: { status: target, updatedById: actor.id }
    });

    // Notify Users
    const recipients = new Set([proposal.createdById, proposal.opportunity.ownerId]);
    for (const rId of recipients) {
      try {
        await tx.notification.create({
          data: {
            userId: rId,
            leadId: proposal.opportunity.leadId,
            companyId: proposal.companyId,
            branchId: proposal.branchId,
            opportunityId: proposal.opportunityId,
            notificationType: 'PROPOSAL_ALERT',
            message: `Proposal ${proposal.proposalNumber} status updated to ${target}`,
            status: 'UNREAD'
          }
        });
      } catch (err) {
        console.error('Failed to send proposal notification:', err.message);
      }
    }

    // Lead Activity Log
    await tx.leadActivity.create({
      data: {
        leadId: proposal.opportunity.leadId,
        companyId: proposal.companyId,
        activityType: `PROPOSAL_${target}`,
        description: `Proposal ${proposal.proposalNumber} status changed to ${target}`,
        relatedEntityType: 'PROPOSAL',
        relatedEntityId: proposal.id,
        performedById: actor.id
      }
    });

    return updated;
  });
};

// List Proposals (Filtered + Paginated)
export const getProposalsList = async (actor, q) => {
  const page = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(100, parseInt(q.limit) || 20);
  const skip = (page - 1) * limit;

  const where = proposalRepo.buildProposalWhere(actor, q);
  const orderBy = { createdAt: 'desc' };

  const { total, proposals } = await proposalRepo.findProposalsList({ where, skip, take: limit, orderBy });

  // Add virtual expired flag dynamically
  const currentDate = new Date();
  const items = proposals.map(p => {
    const item = JSON.parse(JSON.stringify(p));
    item.isExpired = new Date(p.validTill) < currentDate;
    return item;
  });

  return {
    items,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
  };
};

// Fetch Proposal Details by ID
export const getProposalById = async (actor, id) => {
  const proposal = await validateScopeAndGetProposal(actor, id);
  
  // Dynamic expiration computation
  const isExpired = new Date(proposal.validTill) < new Date();

  const result = JSON.parse(JSON.stringify(proposal));
  result.isExpired = isExpired;

  return result;
};

// Delete Proposal (Soft-delete)
export const deleteProposal = async (actor, id) => {
  const proposal = await validateScopeAndGetProposal(actor, id);

  if (proposal.status === 'ACCEPTED') {
    throw new ValidationError('Cannot delete an accepted proposal.');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.proposal.update({
      where: { id: proposal.id },
      data: {
        isDeleted: true,
        deletedById: actor.id,
        deletedAt: new Date()
      }
    });

    await tx.leadActivity.create({
      data: {
        leadId: proposal.opportunity.leadId,
        companyId: proposal.companyId,
        activityType: 'PROPOSAL_DELETED',
        description: `Proposal ${proposal.proposalNumber} deleted`,
        relatedEntityType: 'PROPOSAL',
        relatedEntityId: proposal.id,
        performedById: actor.id
      }
    });

    return updated;
  });
};
