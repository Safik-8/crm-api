import prisma from '../../config/db.js';

export const saveQualificationTx = async (leadId, companyId, branchId, data, computedScore, status, actorId) => {
  return prisma.$transaction(async (tx) => {
    // 1. Upsert LeadQualification record
    const qualification = await tx.leadQualification.upsert({
      where: { leadId },
      update: {
        budgetAvailable: data.budgetAvailable,
        interestLevel: data.interestLevel,
        purchaseTimeline: data.purchaseTimeline,
        decisionMakerAvailable: data.decisionMakerAvailable,
        productFit: data.productFit,
        notes: data.notes,
        remarks: data.remarks,
        score: computedScore,
        status: status,
        evaluatedById: actorId,
        evaluatedAt: new Date(),
      },
      create: {
        leadId,
        companyId,
        branchId,
        budgetAvailable: data.budgetAvailable,
        interestLevel: data.interestLevel,
        purchaseTimeline: data.purchaseTimeline,
        decisionMakerAvailable: data.decisionMakerAvailable,
        productFit: data.productFit,
        notes: data.notes,
        remarks: data.remarks,
        score: computedScore,
        status: status,
        evaluatedById: actorId,
      }
    });

    // 2. Fetch current status to record previousStatus in history
    const currentLead = await tx.lead.findUnique({
      where: { id: leadId },
      select: { qualificationStatus: true }
    });

    // 3. Create LeadQualificationHistory log
    await tx.leadQualificationHistory.create({
      data: {
        leadId,
        companyId,
        branchId,
        previousStatus: currentLead?.qualificationStatus || 'UNQUALIFIED',
        newStatus: status,
        score: computedScore,
        remarks: data.remarks || 'Qualification updated',
        changedById: actorId,
      }
    });

    // 4. Update the Lead table with denormalized fields
    const updatedLead = await tx.lead.update({
      where: { id: leadId },
      data: {
        qualificationStatus: status,
        qualificationScore: computedScore,
        isQualified: status === 'QUALIFIED',
      }
    });

    return { qualification, updatedLead };
  });
};

export const getQualificationHistory = async (leadId, companyId) => {
  return prisma.leadQualificationHistory.findMany({
    where: { leadId, companyId },
    orderBy: { changedAt: 'desc' },
    include: {
      changedBy: {
        select: { id: true, name: true, firstName: true, lastName: true }
      }
    }
  });
};
