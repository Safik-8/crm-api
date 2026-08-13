import { saveQualificationTx, getQualificationHistory } from './qualification.repository.js';
import { getCompanyCriteriaService, getCompanySettingsService } from './qualification-settings.service.js';
import prisma from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';

export const evaluateLeadService = async (leadId, data, actor) => {
  // 1. Fetch Lead
  const lead = await prisma.lead.findUnique({
    where: { id: Number(leadId) },
    include: {
      assignedTo: {
        include: { userRoles: { include: { role: true } } },
      },
    },
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

  if (actorRank === 40) {
    // BDE
    if (lead.assignedToId !== actor.id) {
      throw new AppError('BDEs can only qualify their own assigned leads', 403);
    }
  } else if (actorRank === 60) {
    // Branch Manager
    if (lead.branchId !== actor.branchId) {
      throw new AppError('Branch Managers can only qualify leads in their branch', 403);
    }
  }

  // Guard against qualifying a lead owned by a higher-ranking user (except Superadmins rank >= 80)
  const assigneePrimaryRole = lead.assignedTo?.userRoles?.find((ur) => ur.isPrimary)?.role;
  const assigneeRank = assigneePrimaryRole?.rank || 0;

  if (actorRank < 80 && assigneeRank >= actorRank && lead.assignedToId !== actor.id) {
    throw new AppError('You cannot qualify a lead assigned to a user of equal or higher rank', 403);
  }

  // 3. Load Per-Company Dynamic Qualification Criteria & Settings
  const criteriaList = await getCompanyCriteriaService(lead.companyId);
  const companySettings = await getCompanySettingsService(lead.companyId);

  // Validate mandatory fields (Edge Case 3 & QA Edge Case 8: missing required criteria)
  for (const criterion of criteriaList) {
    if (criterion.isRequired) {
      const val = data[criterion.key];
      if (val === undefined || val === null || val === '') {
        throw new AppError(
          `Field "${criterion.label}" is required for qualification. Please complete all required criteria fields.`,
          400
        );
      }
    }
  }

  // Calculate score dynamically over active criteria
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

  // Normalize score between 0 and 100 (Edge Case 2)
  const computedScore = Math.min(100, Math.max(0, rawScore));

  // Determine outcome status
  let status = 'UNQUALIFIED';
  if (data.status === 'ON_HOLD' || data.status === 'UNQUALIFIED') {
    status = data.status;
  } else if (data.status === 'QUALIFIED' || data.status === 'NOT_QUALIFIED') {
    status = data.status;
  } else {
    // Auto-calculate against company pass threshold
    const passThreshold = companySettings?.passThreshold ?? 60;
    status = computedScore >= passThreshold ? 'QUALIFIED' : 'NOT_QUALIFIED';
  }

  // Mandatory business rule validations (QA Edge Case 11)
  if (status === 'NOT_QUALIFIED' && !data.remarks?.trim()) {
    throw new AppError('Remarks are required when marking a lead as Not Qualified.', 400);
  }
  if (status === 'ON_HOLD' && !data.notes?.trim()) {
    throw new AppError('Notes are required when placing a lead On Hold.', 400);
  }

  // 4. Save via Repository with criteriaSnapshot (Edge Case 1)
  const result = await saveQualificationTx(
    lead.id,
    lead.companyId,
    lead.branchId,
    data,
    computedScore,
    status,
    actor.id,
    criteriaList // criteriaSnapshot
  );

  return result;
};

export const getLeadHistoryService = async (leadId, actor) => {
  const lead = await prisma.lead.findUnique({
    where: { id: Number(leadId) },
    select: { companyId: true, branchId: true },
  });

  if (!lead) throw new AppError('Lead not found', 404);

  const isSystemAdmin = actor.primaryRoleRank >= 100 || actor.companyId === null;
  if (!isSystemAdmin && lead.companyId !== actor.companyId) throw new AppError('Unauthorized', 403);

  return getQualificationHistory(Number(leadId), lead.companyId);
};
