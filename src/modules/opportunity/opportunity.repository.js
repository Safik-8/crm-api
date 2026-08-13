import prisma from '../../config/db.js';
import { Prisma } from '@prisma/client';
import { ValidationError, NotFoundError } from '../../utils/AppError.js';

/**
 * Idempotent helper: create Deal (one per opportunity), Customer and Revenue (only for WON)
 * Operates using the provided Prisma transaction client `tx`.
 * Returns the deal record (existing or newly created).
 */
export const createDealCustomerRevenueIfNeeded = async (tx, opportunity, status, performedById, reasonId = null, remarks = null) => {
  if (!opportunity || !opportunity.id) throw new ValidationError('Invalid opportunity');

  // Idempotency: check existing deal for this opportunity
  const existingDeal = await tx.deal.findUnique({ where: { opportunityId: opportunity.id } }).catch(() => null);
  if (existingDeal) return existingDeal;

  // Validations
  if (opportunity.expectedRevenue === null || opportunity.expectedRevenue === undefined) {
    throw new ValidationError('Expected revenue is required to create a deal.');
  }
  if (Number(opportunity.expectedRevenue) <= 0) {
    throw new ValidationError('Expected revenue must be greater than 0 to create a deal.');
  }

  // Ensure lead exists
  const lead = await tx.lead.findUnique({ where: { id: opportunity.leadId } });
  if (!lead) throw new ValidationError('Lead not found for opportunity');

  // If WON require lead contact details for customer creation
  if (status === 'WON') {
    if (!lead.name || !lead.email) {
      throw new ValidationError('Lead name and email are required to create a customer.');
    }
    if (!lead.mobile) {
      throw new ValidationError('Lead mobile number is required to create a customer.');
    }
  }

  // If LOST require valid reasonId or custom remarks if no active options exist
  if (status === 'LOST') {
    const activeReasonsCount = await tx.winLossReason.count({
      where: { companyId: opportunity.companyId, status: 'ACTIVE' }
    });

    if (activeReasonsCount > 0) {
      if (!reasonId) {
        throw new ValidationError('reasonId is required when outcome is LOST');
      }
      const reason = await tx.winLossReason.findFirst({
        where: { id: Number(reasonId), companyId: opportunity.companyId, status: 'ACTIVE' }
      });
      if (!reason) {
        throw new ValidationError('Provided reasonId is invalid for this company');
      }
    } else {
      if (!remarks || !remarks.trim()) {
        throw new ValidationError('A custom remarks reason is required when no reason options are configured.');
      }
    }
  }

  // Fetch company details to retrieve its code
  const company = await tx.company.findUnique({
    where: { id: opportunity.companyId },
    select: { code: true }
  });
  const companyCode = company ? company.code.toUpperCase() : 'CO';
  const currentYear = new Date().getFullYear();

  // Create Deal
  const dealCount = await tx.deal.count({ where: { companyId: opportunity.companyId } });
  const dealSeq = (dealCount + 1).toString().padStart(4, '0');
  const dealNumber = `DEAL-${companyCode}-${currentYear}-${dealSeq}`;
  let deal;
  try {
    deal = await tx.deal.create({
      data: {
        companyId: opportunity.companyId,
        branchId: opportunity.branchId || null,
        dealNumber,
        opportunityId: opportunity.id,
        leadId: opportunity.leadId,
        outcome: status,
        closingDate: new Date(),
        finalAmount: opportunity.expectedRevenue,
        reasonId: reasonId || null,
        remarks: remarks || null,
        closedById: performedById,
        createdById: performedById,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      deal = await tx.deal.findUnique({ where: { opportunityId: opportunity.id } });
      if (deal) {
        return deal;
      }
    }
    throw error;
  }

  // Deal history
  await tx.dealHistory.create({
    data: {
      dealId: deal.id,
      companyId: opportunity.companyId,
      branchId: opportunity.branchId || null,
      previousStatus: null,
      newStatus: status,
      remarks: null,
      createdById: performedById,
    },
  });

  // Log lead activity and audit
  await tx.leadActivity.create({
    data: {
      leadId: opportunity.leadId,
      companyId: opportunity.companyId,
      activityType: 'DEAL_CREATED',
      description: `Deal ${deal.dealNumber} created for opportunity ${opportunity.opportunityName}`,
      relatedEntityType: 'DEAL',
      relatedEntityId: deal.id,
      performedById: performedById,
    },
  });

  await tx.auditLog.create({
    data: {
      companyId: opportunity.companyId,
      entityType: 'DEAL',
      entityId: deal.id,
      action: 'DEAL_CREATED',
      newValue: { dealNumber: deal.dealNumber, finalAmount: deal.finalAmount },
      performedById: performedById,
    },
  });

  // For WON: create customer and revenue (idempotent)
  if (status === 'WON') {
    // Customer (unique by dealId)
    const existingCustomer = await tx.customer.findUnique({ where: { dealId: deal.id } }).catch(() => null);
    let customer = existingCustomer;
    if (!existingCustomer) {
      const customerCount = await tx.customer.count({ where: { companyId: opportunity.companyId } });
      const customerSeq = (customerCount + 1).toString().padStart(4, '0');
      const customerCode = `CUST-${companyCode}-${currentYear}-${customerSeq}`;
      customer = await tx.customer.create({
        data: {
          companyId: opportunity.companyId,
          branchId: opportunity.branchId || null,
          customerCode,
          customerName: lead.name,
          contactNumber: lead.mobile,
          email: lead.email || null,
          leadId: lead.id,
          opportunityId: opportunity.id,
          dealId: deal.id,
          purchasedProductId: opportunity.productId || null,
          purchaseDate: new Date(),
          totalRevenue: deal.finalAmount,
          ownerTeamId: opportunity.teamId || null,
          assignedOwnerId: opportunity.ownerId || performedById,
          status: 'ACTIVE',
          createdById: performedById,
        },
      });

      await tx.leadActivity.create({
        data: {
          leadId: lead.id,
          companyId: opportunity.companyId,
          activityType: 'CUSTOMER_CREATED',
          description: `Customer ${customer.customerName} created from opportunity ${opportunity.opportunityName}`,
          relatedEntityType: 'CUSTOMER',
          relatedEntityId: customer.id,
          performedById: performedById,
        },
      });

      await tx.auditLog.create({
        data: {
          companyId: opportunity.companyId,
          entityType: 'CUSTOMER',
          entityId: customer.id,
          action: 'CUSTOMER_CREATED',
          newValue: { customerName: customer.customerName, dealId: deal.id },
          performedById: performedById,
        },
      });
    }

    // Revenue (unique by dealId)
    const existingRevenue = await tx.revenueLog.findUnique({ where: { dealId: deal.id } }).catch(() => null);
    if (!existingRevenue) {
      let revenue;
      try {
        revenue = await tx.revenueLog.create({
          data: {
            companyId: opportunity.companyId,
            branchId: opportunity.branchId || null,
            dealId: deal.id,
            customerId: customer.id,
            productId: opportunity.productId || null,
            revenueAmount: deal.finalAmount,
            revenueDate: new Date(),
            paymentStatus: 'COMPLETED',
            notes: `Auto-generated revenue for deal ${deal.dealNumber}`,
            createdById: performedById,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          revenue = await tx.revenueLog.findUnique({ where: { dealId: deal.id } });
        } else {
          throw error;
        }
      }

      if (revenue) {
        await tx.leadActivity.create({
          data: {
            leadId: opportunity.leadId,
            companyId: opportunity.companyId,
            activityType: 'REVENUE_CREATED',
            description: `Revenue ₹${revenue.revenueAmount} logged for deal ${deal.dealNumber}`,
            relatedEntityType: 'REVENUE',
            relatedEntityId: revenue.id,
            performedById: performedById,
          },
        });

        await tx.auditLog.create({
          data: {
            companyId: opportunity.companyId,
            entityType: 'REVENUE',
            entityId: revenue.id,
            action: 'REVENUE_CREATED',
            newValue: { dealId: deal.id, amount: revenue.revenueAmount },
            performedById: performedById,
          },
        });
      }
    }
  }

  return deal;
};

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

    // 2c. Update Lead qualificationStatus to CONVERTED
    if (data.leadId) {
      // Find the CLOSED or CONVERTED status ID
      const closedStatus = await tx.leadStatus.findFirst({
        where: {
          companyId,
          code: 'CLOSED',
        },
      }) || await tx.leadStatus.findFirst({
        where: {
          companyId: null,
          code: 'CLOSED',
        },
      });

          await tx.lead.update({
        where: { id: Number(data.leadId) },
        data: {
          qualificationStatus: 'CONVERTED',
          ...(closedStatus ? { statusId: closedStatus.id } : {}),
        },
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
        proposals: {
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: { select: { id: true, name: true } },
            product: { select: { id: true, name: true } },
            versions: {
              orderBy: { versionNumber: 'desc' },
              include: {
                modifiedBy: { select: { id: true, name: true } }
              }
            }
          }
        },
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
export const closeOpportunityTx = async (id, companyId, status, updatedById, remarks = null, reasonId = null) => {
  return prisma.$transaction(async (tx) => {
    const oldVal = await tx.opportunity.findUnique({ where: { id } });

    // 1. Resolve matching terminal stage for the company (with fallbacks)
    const queryCompanyId = oldVal ? oldVal.companyId : companyId;
    let targetStage = await tx.opportunityStage.findFirst({
      where: {
        companyId: queryCompanyId,
        stageType: status, // "WON" | "LOST" | "CANCELLED"
        status: 'ACTIVE',
      },
    });

    if (!targetStage) {
      targetStage = await tx.opportunityStage.findFirst({
        where: {
          companyId: queryCompanyId,
          code: status,
          status: 'ACTIVE',
        },
      });
    }

    if (!targetStage) {
      targetStage = await tx.opportunityStage.findFirst({
        where: {
          companyId: queryCompanyId,
          name: { equals: status, mode: 'insensitive' },
          status: 'ACTIVE',
        },
      });
    }

    const opportunity = await tx.opportunity.update({
      where: { id },
      data: {
        status, // "WON" | "LOST" | "CANCELLED"
        stageId: targetStage ? targetStage.id : oldVal.stageId,
        probabilityPercentage: status === 'WON' ? 100 : 0,
        updatedById,
      },
      include: {
        stage: true,
        product: true,
        owner: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, name: true, mobile: true, email: true } },
      },
    });

    // 2. Log in opportunity_stage_histories
    if (targetStage) {
      await tx.opportunityStageHistory.create({
        data: {
          opportunityId: id,
          companyId,
          branchId: opportunity.branchId,
          previousStageId: oldVal.stageId,
          newStageId: targetStage.id,
          changedById: updatedById,
          remarks,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        companyId,
        entityType: 'OPPORTUNITY',
        entityId: id,
        action: `OPPORTUNITY_CLOSED_${status}`,
        oldValue: oldVal,
        newValue: { status, stageId: targetStage ? targetStage.id : oldVal.stageId },
        performedById: updatedById,
      },
    });

    // Create deal/customer/revenue idempotently as part of the same transaction
    await createDealCustomerRevenueIfNeeded(tx, opportunity, status, updatedById, reasonId, remarks);

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
      proposals: {
        where: { isDeleted: false },
        orderBy: { createdAt: 'desc' },
        include: {
          createdBy: { select: { id: true, name: true } },
          product: { select: { id: true, name: true } },
          versions: {
            orderBy: { versionNumber: 'desc' },
            include: {
              modifiedBy: { select: { id: true, name: true } }
            }
          }
        }
      },
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
