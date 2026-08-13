import prisma from '../../config/db.js';

export const saveQualificationTx = async (
  leadId,
  companyId,
  branchId,
  data,
  computedScore,
  status,
  actorId,
  criteriaSnapshot = null
) => {
  return prisma.$transaction(async (tx) => {
    // 1. Upsert LeadQualification record with criteriaValues JSON
    const qualification = await tx.leadQualification.upsert({
      where: { leadId },
      update: {
        budgetAvailable: Boolean(data.budgetAvailable),
        interestLevel: data.interestLevel || 'MEDIUM',
        purchaseTimeline: data.purchaseTimeline || null,
        decisionMakerAvailable: Boolean(data.decisionMakerAvailable),
        productFit: Boolean(data.productFit),
        criteriaValues: data,
        notes: data.notes || null,
        remarks: data.remarks || null,
        score: computedScore,
        status: status,
        evaluatedById: actorId,
        evaluatedAt: new Date(),
      },
      create: {
        leadId,
        companyId,
        branchId,
        budgetAvailable: Boolean(data.budgetAvailable),
        interestLevel: data.interestLevel || 'MEDIUM',
        purchaseTimeline: data.purchaseTimeline || null,
        decisionMakerAvailable: Boolean(data.decisionMakerAvailable),
        productFit: Boolean(data.productFit),
        criteriaValues: data,
        notes: data.notes || null,
        remarks: data.remarks || null,
        score: computedScore,
        status: status,
        evaluatedById: actorId,
      },
    });

    // 2. Fetch current status to record previousStatus in history
    const currentLead = await tx.lead.findUnique({
      where: { id: leadId },
      select: { qualificationStatus: true },
    });

    // 3. Create LeadQualificationHistory log with criteriaSnapshot JSON (Edge Case 1)
    await tx.leadQualificationHistory.create({
      data: {
        leadId,
        companyId,
        branchId,
        previousStatus: currentLead?.qualificationStatus || 'UNQUALIFIED',
        newStatus: status,
        score: computedScore,
        remarks: data.remarks || (status === 'QUALIFIED' ? 'Lead qualified successfully' : 'Qualification updated'),
        criteriaSnapshot: criteriaSnapshot ? criteriaSnapshot : undefined,
        changedById: actorId,
      },
    });

    // 4. Update the Lead table with denormalized fields
    const updatedLead = await tx.lead.update({
      where: { id: leadId },
      data: {
        qualificationStatus: status,
        qualificationScore: computedScore,
        isQualified: status === 'QUALIFIED',
      },
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
        select: { id: true, name: true, firstName: true, lastName: true },
      },
    },
  });
};
