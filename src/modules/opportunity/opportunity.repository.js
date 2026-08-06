import prisma from '../../config/db.js';

/**
 * Creates an Opportunity record atomically inside a Prisma Transaction
 * Writes to Opportunity, LeadActivity, and AuditLog tables
 */
export const createOpportunityTx = async (companyId, branchId, data, ownerId, createdById) => {
  return prisma.$transaction(async (tx) => {
    // 0. Resolve target OpportunityStage and default probability
    let stageId = data.stageId ? Number(data.stageId) : null;
    let targetStage = null;
    if (stageId) {
      targetStage = await tx.opportunityStage.findFirst({
        where: { id: stageId, companyId },
      });
    }
    if (!targetStage) {
      targetStage = await tx.opportunityStage.findFirst({
        where: { companyId, status: 'ACTIVE' },
        orderBy: { displayOrder: 'asc' },
      });
    }
    if (!targetStage) {
      targetStage = await tx.opportunityStage.findFirst({
        where: { status: 'ACTIVE' },
        orderBy: { displayOrder: 'asc' },
      });
    }

    stageId = targetStage ? targetStage.id : 1;

    let probability = data.probabilityPercentage;
    if (probability === undefined || probability === null || probability === '') {
      probability = targetStage?.defaultProbabilityPct || 10;
    }

    // 2. Create Opportunity
    const opportunity = await tx.opportunity.create({
      data: {
        companyId,
        branchId: branchId || null,
        opportunityName: data.opportunityName,
        leadId: data.leadId,
        productId: data.productId || null,
        teamId: data.teamId || null,
        stageId: stageId,
        ownerId: ownerId,
        expectedRevenue: data.expectedRevenue,
        probabilityPercentage: probability,
        closingDate: new Date(data.closingDate),
        notes: data.notes || null,
        createdById: createdById,
        status: 'OPEN',
      },
      include: {
        stage: true,
        product: true,
        owner: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, name: true, mobile: true, email: true } },
      },
    });

    // 2b. Record initial stage history entry
    await tx.opportunityStageHistory.create({
      data: {
        opportunityId: opportunity.id,
        companyId,
        branchId: branchId || null,
        previousStageId: null,
        newStageId: stageId,
        changedById: createdById,
      },
    });

    // 2c. Update Lead status to CONVERTED
    if (data.leadId) {
      await tx.lead.update({
        where: { id: Number(data.leadId) },
        data: { status: 'CONVERTED' },
      });
    }

    // 3. Create Activity Log on the Lead
    await tx.leadActivity.create({
      data: {
        leadId: data.leadId,
        companyId,
        activityType: 'OPPORTUNITY_CREATED',
        description: `Opportunity "${data.opportunityName}" created with revenue ₹${data.expectedRevenue}`,
        relatedEntityType: 'OPPORTUNITY',
        relatedEntityId: opportunity.id,
        performedById: createdById,
      },
    });

    // 4. Central Audit Log
    await tx.auditLog.create({
      data: {
        companyId,
        entityType: 'OPPORTUNITY',
        entityId: opportunity.id,
        action: 'OPPORTUNITY_CREATED',
        newValue: { opportunityName: data.opportunityName, expectedRevenue: data.expectedRevenue },
        performedById: createdById,
      },
    });

    return opportunity;
  }, { maxWait: 10000, timeout: 20000 });
};

/**
 * Updates an Opportunity record with audit logging
 */
export const updateOpportunityTx = async (id, companyId, data, updatedById) => {
  return prisma.$transaction(async (tx) => {
    const oppId = Number(id);
    const oldVal = await tx.opportunity.findUnique({ where: { id: oppId } });
    if (!oldVal) {
      throw new NotFoundError('Opportunity');
    }

    const targetCompanyId = companyId || oldVal.companyId || 1;

    // Resolve target stageId if supplied
    let stageId = data.stageId ? Number(data.stageId) : undefined;
    let targetStage = null;
    if (stageId) {
      targetStage = await tx.opportunityStage.findFirst({
        where: { id: stageId },
      });
      if (!targetStage) {
        targetStage = await tx.opportunityStage.findFirst({
          where: { companyId: targetCompanyId, status: 'ACTIVE' },
          orderBy: { displayOrder: 'asc' },
        });
      }
    }

    const updatePayload = { ...data };
    if (targetStage) {
      updatePayload.stageId = targetStage.id;
      // Automatically update probability % to the new stage default if not manually overridden
      if (data.probabilityPercentage === undefined || data.probabilityPercentage === null) {
        updatePayload.probabilityPercentage = targetStage.defaultProbabilityPct ?? 10;
      }
      // Record Stage History entry if stage changed
      if (targetStage.id !== oldVal.stageId) {
        await tx.opportunityStageHistory.create({
          data: {
            opportunityId: oppId,
            companyId: targetCompanyId,
            branchId: oldVal.branchId,
            previousStageId: oldVal.stageId,
            newStageId: targetStage.id,
            changedById: updatedById,
          },
        });
      }
    }
    if (data.closingDate) updatePayload.closingDate = new Date(data.closingDate);
    updatePayload.updatedById = updatedById;

    const opportunity = await tx.opportunity.update({
      where: { id: oppId },
      data: updatePayload,
      include: {
        stage: true,
        product: true,
        owner: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, name: true, mobile: true, email: true } },
        proposals: { orderBy: { createdAt: 'desc' } },
        stageHistory: {
          orderBy: { changedAt: 'desc' },
          include: {
            previousStage: { select: { id: true, name: true } },
            newStage: { select: { id: true, name: true } },
            changedBy: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        companyId: targetCompanyId,
        entityType: 'OPPORTUNITY',
        entityId: oppId,
        action: 'OPPORTUNITY_UPDATED',
        oldValue: JSON.stringify(oldVal),
        newValue: JSON.stringify(opportunity),
        performedById: updatedById,
      },
    });

    return opportunity;
  }, { maxWait: 10000, timeout: 20000 });
};

/**
 * Updates an Opportunity status (Won / Lost / Cancelled) with audit logging
 */
export const closeOpportunityTx = async (id, companyId, status, updatedById) => {
  return prisma.$transaction(async (tx) => {
    const oldVal = await tx.opportunity.findUnique({ where: { id } });

    const opportunity = await tx.opportunity.update({
      where: { id },
      data: {
        status, // "WON" | "LOST" | "CANCELLED"
        updatedById,
      },
      include: {
        stage: true,
        product: true,
        owner: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, name: true, mobile: true, email: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        companyId,
        entityType: 'OPPORTUNITY',
        entityId: id,
        action: `OPPORTUNITY_CLOSED_${status}`,
        oldValue: oldVal,
        newValue: { status },
        performedById: updatedById,
      },
    });

    return opportunity;
  }, { maxWait: 10000, timeout: 20000 });
};

/**
 * Finds an Opportunity by ID with scoped multi-tenant check
 */
export const findOpportunityById = async (id, companyId) => {
  const where = {
    id: Number(id),
    isDeleted: false,
  };
  if (companyId) {
    where.companyId = companyId;
  }

  return prisma.opportunity.findFirst({
    where,
    include: {
      stage: true,
      product: { select: { id: true, name: true, code: true } },
      owner: { select: { id: true, name: true, email: true } },
      lead: { select: { id: true, name: true, mobile: true, email: true } },
      proposals: { orderBy: { createdAt: 'desc' } },
      stageHistory: {
        orderBy: { changedAt: 'desc' },
        include: {
          previousStage: { select: { id: true, name: true } },
          newStage: { select: { id: true, name: true } },
          changedBy: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
};

/**
 * Finds paginated opportunities based on HRBAC filters
 */
export const findOpportunitiesList = async ({ where, skip = 0, take = 10, orderBy = { createdAt: 'desc' } }) => {
  const [total, opportunities] = await prisma.$transaction([
    prisma.opportunity.count({ where }),
    prisma.opportunity.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        stage: true,
        product: { select: { id: true, name: true, code: true } },
        owner: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, name: true, mobile: true, email: true } },
      },
    }),
  ]);

  return { total, opportunities };
};
