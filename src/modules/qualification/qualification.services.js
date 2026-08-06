import { saveQualificationTx, getQualificationHistory } from './qualification.repository.js';
import prisma from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';

export const evaluateLeadService = async (leadId, data, actor) => {
  // 1. Fetch Lead
  const lead = await prisma.lead.findUnique({
    where: { id: Number(leadId) },
    include: {
      assignedTo: {
        include: { userRoles: { include: { role: true } } }
      }
    }
  });

  if (!lead) {
    throw new AppError('Lead not found', 404);
  }

  // 2. HRBAC (Multi-Tenant & Rank Scoping)
  const isSystemAdmin = actor.primaryRoleRank >= 100 || actor.companyId === null;
  if (!isSystemAdmin && lead.companyId !== actor.companyId) {
    throw new AppError("Unauthorized access to this company's lead", 403);
  }

  const actorRank = actor.primaryRoleRank || 0;
  
  if (actorRank === 40) { // BDE
    if (lead.assignedToId !== actor.id) {
      throw new AppError('BDEs can only qualify their own assigned leads', 403);
    }
  } else if (actorRank === 60) { // Branch Manager
    if (lead.branchId !== actor.branchId) {
      throw new AppError('Branch Managers can only qualify leads in their branch', 403);
    }
  }
  
  // Guard against qualifying a lead owned by a higher-ranking user (except Superadmins rank >= 80)
  const assigneePrimaryRole = lead.assignedTo?.userRoles?.find(ur => ur.isPrimary)?.role;
  const assigneeRank = assigneePrimaryRole?.rank || 0;
  
  if (actorRank < 80 && assigneeRank >= actorRank && lead.assignedToId !== actor.id) {
    throw new AppError('You cannot qualify a lead assigned to a user of equal or higher rank', 403);
  }

  // 3. Compute Score
  let score = 0;
  if (data.budgetAvailable) score += 25;
  if (data.decisionMakerAvailable) score += 15;
  if (data.productFit) score += 15;

  if (data.interestLevel === 'HIGH') score += 25;
  else if (data.interestLevel === 'MEDIUM') score += 15;
  else if (data.interestLevel === 'LOW') score += 5;

  if (data.purchaseTimeline === 'IMMEDIATE') score += 20;
  else if (data.purchaseTimeline === '1_MONTH') score += 15;
  else if (data.purchaseTimeline === '3_MONTHS') score += 10;
  else if (data.purchaseTimeline === 'EXPLORATORY') score += 5;

  // Determine status: Enforce score threshold (score >= 60 -> QUALIFIED, else NOT_QUALIFIED) unless explicit manual override (ON_HOLD / UNQUALIFIED) is provided
  let status = data.status;
  if (!status || status === 'QUALIFIED' || status === 'NOT_QUALIFIED') {
    status = score >= 60 ? 'QUALIFIED' : 'NOT_QUALIFIED';
  }

  // 4. Save via Repository
  const result = await saveQualificationTx(
    lead.id,
    lead.companyId,
    lead.branchId,
    data,
    score,
    status,
    actor.id
  );

  return result;
};

export const getLeadHistoryService = async (leadId, actor) => {
  const lead = await prisma.lead.findUnique({
    where: { id: Number(leadId) },
    select: { companyId: true, branchId: true }
  });

  if (!lead) throw new AppError('Lead not found', 404);
  
  const isSystemAdmin = actor.primaryRoleRank >= 100 || actor.companyId === null;
  if (!isSystemAdmin && lead.companyId !== actor.companyId) throw new AppError('Unauthorized', 403);

  return getQualificationHistory(Number(leadId), lead.companyId);
};
