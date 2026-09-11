// src/modules/lead/lead.repository.js

import prisma from "../../config/db.js";

// ──────────────────────────────────────────────────────────────────────────────
// SHARED PRISMA INCLUDE OBJECTS
// ──────────────────────────────────────────────────────────────────────────────

/** Full detail include — used for single lead fetch, create, update, delete */
export const leadDetailInclude = {
  company: { select: { id: true, name: true } },
  branch: { select: { id: true, name: true } },
  pipeline: { select: { id: true, name: true } },
  stage: { select: { id: true, name: true, stageType: true, colorCode: true, code: true } },
  source: { select: { id: true, name: true } },
  course: { select: { id: true, name: true } },
  status: { select: { id: true, name: true, code: true, displayColor: true } },
  assignedTo: {
    select: {
      id: true,
      name: true,
      email: true,
      reportingManager: { select: { id: true, name: true } }
    }
  },
  team: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  updatedBy: { select: { id: true, name: true } },
  deletedBy: { select: { id: true, name: true } },
  qualification: {
    select: {
      id: true,
      status: true,
      score: true,
      budgetAvailable: true,
      interestLevel: true,
      purchaseTimeline: true,
      decisionMakerAvailable: true,
      productFit: true,
      notes: true,
      remarks: true,
      evaluatedAt: true,
      evaluatedBy: { select: { id: true, name: true } }
    }
  },
  opportunities: { select: { id: true, opportunityName: true, status: true, expectedRevenue: true }, where: { isDeleted: false } },
};

/** Kanban list include — kept for backward compat with Kanban board */
export const leadStageLogInclude = {
  stage: { select: { id: true, name: true, isDefault: true } },
  previousStage: { select: { id: true, name: true, isDefault: true } },
  stageChangedBy: { select: { id: true, name: true, email: true } },
};

// ──────────────────────────────────────────────────────────────────────────────
// BRANCH USERS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Fetches all active users in a branch for the "Assign To" dropdown.
 * @param {number} branchId
 * @param {object} tx - Prisma client or transaction
 */
export const findBranchUsers = async (branchId, tx = prisma) => {
  const users = await tx.user.findMany({
    where: { branchId, status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      email: true,
      userRoles: {
        where: { isPrimary: true },
        select: { role: { select: { name: true } } }
      }
    },
    orderBy: { name: "asc" }
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.userRoles[0]?.role?.name ?? null
  }));
};

export const getBranchUsersByBranchId = findBranchUsers;

// ──────────────────────────────────────────────────────────────────────────────
// FORM DROPDOWN DATA
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Fetches all data needed to render the lead create/edit form dropdowns.
 * @param {number|null} companyId
 * @param {number|null} branchId
 */
export const findLeadFormData = async (companyId, branchId) => {
  const [sources, courses, statuses, users] = await Promise.all([
    // Lead sources: global + company-specific
    prisma.leadSource.findMany({
      where: {
        isActive: true,
        OR: [
          { companyId: null },
          ...(companyId ? [{ companyId }] : [])
        ]
      },
      select: { id: true, name: true },
      orderBy: [{ companyId: "asc" }, { name: "asc" }]
    }),

    // Courses: company-scoped active courses
    prisma.course.findMany({
      where: {
        status: "ACTIVE",
        isDeleted: false,
        ...(companyId ? { companyId } : {})
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    }),

    // Lead statuses: global + company-specific (active only)
    prisma.leadStatus.findMany({
      where: {
        isActive: true,
        OR: [
          { companyId: null },
          ...(companyId ? [{ companyId }] : [])
        ]
      },
      select: { id: true, name: true, code: true, displayColor: true, sequenceOrder: true },
      orderBy: { sequenceOrder: "asc" }
    }),

    // Branch users for assignment dropdown
    branchId ? findBranchUsers(branchId) : Promise.resolve([])
  ]);

  return { sources, courses, statuses, users };
};

// ──────────────────────────────────────────────────────────────────────────────
// LEAD CRUD
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Checks for a duplicate mobile number within the same company scope.
 * @param {string} mobile
 * @param {number} companyId
 * @param {number|null} excludeLeadId - Exclude on update
 * @param {object} tx
 */
export const findDuplicateLead = async (params, tx = prisma) => {
  const { mobile, email, alternateMobile, companyId, excludeLeadId } = params;
  if (!companyId) return null;

  const conditions = [];
  if (mobile) {
    conditions.push({ mobile });
    conditions.push({ alternateMobile: mobile });
  }
  if (email && email.trim()) {
    conditions.push({ email: email.trim() });
  }
  if (alternateMobile && alternateMobile.trim()) {
    conditions.push({ alternateMobile: alternateMobile.trim() });
    conditions.push({ mobile: alternateMobile.trim() });
  }

  if (conditions.length === 0) return null;

  return tx.lead.findFirst({
    where: {
      companyId,
      isDeleted: false,
      ...(excludeLeadId ? { NOT: { id: excludeLeadId } } : {}),
      OR: conditions
    },
    include: {
      assignedTo: { select: { name: true } },
      status: { select: { name: true, code: true } }
    }
  });
};

export const checkLeadDuplicate = async (mobile, companyId, excludeLeadId = null, tx = prisma) => {
  return findDuplicateLead({ mobile, companyId, excludeLeadId }, tx);
};

export const createLeadNote = async (data, tx = prisma) => {
  return tx.leadNote.create({
    data,
    include: {
      createdBy: { select: { id: true, name: true } }
    }
  });
};

export const findLeadNotes = async (leadId, tx = prisma) => {
  return tx.leadNote.findMany({
    where: { leadId, isDeleted: false },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } }
    }
  });
};

export const findLeadNoteById = async (noteId, tx = prisma) => {
  return tx.leadNote.findUnique({
    where: { id: noteId }
  });
};

export const updateLeadNote = async (noteId, data, tx = prisma) => {
  return tx.leadNote.update({
    where: { id: noteId },
    data,
    include: {
      createdBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } }
    }
  });
};


/**
 * Finds the default lead status for a company (falls back to global default).
 * @param {number|null} companyId
 * @param {object} tx
 */
export const findDefaultLeadStatus = async (companyId, tx = prisma) => {
  if (companyId) {
    // 1. Check SystemSettings configured defaultLeadStatusId
    try {
      const sysSettings = await tx.systemSettings.findUnique({
        where: { companyId: Number(companyId) },
        select: { defaultLeadStatusId: true }
      });
      if (sysSettings?.defaultLeadStatusId) {
        const configuredStatus = await tx.leadStatus.findFirst({
          where: { id: sysSettings.defaultLeadStatusId, isActive: true },
          select: { id: true }
        });
        if (configuredStatus) return configuredStatus.id;
      }
    } catch (_) {}

    // 2. Check company isDefault status
    const companyDefault = await tx.leadStatus.findFirst({
      where: { companyId: Number(companyId), isDefault: true, isActive: true },
      select: { id: true }
    });
    if (companyDefault) return companyDefault.id;
  }

  const globalDefault = await tx.leadStatus.findFirst({
    where: { companyId: null, isDefault: true, isActive: true },
    select: { id: true }
  });

  return globalDefault?.id ?? null;
};

/**
 * Finds a lead by ID (includes pipeline for scope check).
 * @param {number} id
 * @param {object} tx
 */
export const findLeadById = async (id, tx = prisma) => {
  return tx.lead.findUnique({
    where: { id },
    include: {
      pipeline: { select: { id: true, companyId: true, branchId: true } },
      stage: { select: { id: true, name: true, stageType: true, status: true } }
    }
  });
};

/**
 * Finds a lead by ID with all relations for the detail view.
 * @param {number} id
 * @param {object} tx
 */
export const findLeadByIdWithDetail = async (id, tx = prisma) => {
  return tx.lead.findUnique({
    where: { id },
    include: {
      ...leadDetailInclude,
      ...leadStageLogInclude,
      comments: {
        where: { isDeleted: false },
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true } } }
      },
      leadNotes: {
        where: { isDeleted: false },
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: { select: { id: true, name: true } },
          updatedBy: { select: { id: true, name: true } }
        }
      }
    }
  });
};

/**
 * Finds a pipeline by ID.
 * @param {number} pipelineId
 * @param {object} tx
 */
export const findPipelineById = async (pipelineId, tx = prisma) => {
  return tx.pipeline.findUnique({ where: { id: pipelineId } });
};

/**
 * Finds the Prospect stage and its pipeline mapping.
 * @param {number} pipelineId
 * @param {object} tx
 */
export const findProspectStageForPipeline = async (pipelineId, tx = prisma) => {
  // GAP-9 FIX: Use stageType-based lookup instead of name — rename-safe
  const prospectStage = await tx.stage.findFirst({
    where: { stageType: "PROSPECT", isDeleted: false },
    select: { id: true }
  });
  if (!prospectStage) return null;

  const mapping = await tx.pipelineStage.findUnique({
    where: { pipelineId_stageId: { pipelineId, stageId: prospectStage.id } },
    select: { id: true }
  });

  return mapping ? prospectStage.id : null;
};

/**
 * Creates a new lead record.
 * @param {object} data
 * @param {object} tx
 */
export const createLead = async (data, tx = prisma) => {
  return tx.lead.create({
    data,
    include: leadDetailInclude
  });
};

/**
 * Updates a lead record by ID.
 * @param {number} id
 * @param {object} data
 * @param {object} tx
 */
export const updateLead = async (id, data, tx = prisma) => {
  return tx.lead.update({
    where: { id },
    data,
    include: leadDetailInclude
  });
};

/**
 * Paginated list of leads matching the given where/orderBy/skip/take.
 * @param {object} params - { where, orderBy, skip, take }
 * @param {object} tx
 */
export const findLeads = async (params, tx = prisma) => {
  return tx.lead.findMany({
    where: params.where,
    orderBy: params.orderBy,
    skip: params.skip,
    take: params.take,
    include: {
      source: { select: { id: true, name: true } },
      course: { select: { id: true, name: true } },
      status: { select: { id: true, name: true, code: true, displayColor: true } },
      assignedTo: {
        select: {
          id: true,
          name: true,
          userRoles: {
            where: { isPrimary: true },
            include: {
              role: { select: { name: true } }
            }
          }
        }
      },
      team: { select: { id: true, name: true } },
      pipeline: { select: { id: true, name: true } },
      stage: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      qualification: {
        select: {
          id: true,
          status: true,
          score: true,
          budgetAvailable: true,
          interestLevel: true,
          purchaseTimeline: true,
          decisionMakerAvailable: true,
          productFit: true,
          notes: true,
          remarks: true,
          evaluatedAt: true,
        }
      },
      opportunities: { select: { id: true, opportunityName: true, status: true }, where: { isDeleted: false } },
      ...leadStageLogInclude
    }
  });
};

/**
 * Counts leads matching the given where clause.
 * @param {object} where
 * @param {object} tx
 */
export const countLeads = async (where, tx = prisma) => {
  return tx.lead.count({ where });
};

/**
 * Finds a PipelineStage mapping.
 * @param {number} pipelineId
 * @param {number} stageId
 * @param {object} tx
 */
export const findPipelineStageMapping = async (pipelineId, stageId, tx = prisma) => {
  return tx.pipelineStage.findUnique({
    where: { pipelineId_stageId: { pipelineId, stageId } },
    select: { id: true }
  });
};

// ──────────────────────────────────────────────────────────────────────────────
// COMMENTS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Creates a lead comment.
 * @param {object} data
 * @param {object} tx
 */
export const createLeadComment = async (data, tx = prisma) => {
  return tx.leadComment.create({
    data,
    include: {
      user: { select: { id: true, name: true, email: true } }
    }
  });
};

/**
 * Fetches all non-deleted comments for a lead.
 * @param {number} leadId
 * @param {object} tx
 */
export const findLeadComments = async (leadId, tx = prisma) => {
  return tx.leadComment.findMany({
    where: { leadId, isDeleted: false },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true, email: true } }
    }
  });
};

// ──────────────────────────────────────────────────────────────────────────────
import { parseUserAgent, normalizeIpAddress } from "../../utils/userAgentParser.js";
import { sanitizeAuditPayload } from "../../utils/auditSanitizer.js";

// AUDIT LOG
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Creates an audit log entry for lead operations.
 * @param {object} data - { companyId, entityId, action, actionType, oldValue, newValue, performedById, req }
 * @param {object} tx
 * @param {object} [req=null]
 */
export const createAuditLog = async (data, tx = prisma, req = null) => {
  const reqObj = data?.req || req;
  const actionCode = data?.action || "RECORD_UPDATED";
  let actionType = data?.actionType;

  if (!actionType) {
    const actUpper = String(actionCode).toUpperCase();
    if (actUpper.includes("CREATE")) actionType = "CREATE";
    else if (actUpper.includes("DELETE")) actionType = "DELETE";
    else actionType = "UPDATE";
  }

  let ipAddress = "SYSTEM";
  let browserInfo = "SYSTEM";
  let deviceInfo = "SYSTEM";

  if (reqObj && (reqObj.headers || reqObj.ip || reqObj.socket)) {
    const parsed = parseUserAgent(reqObj);
    ipAddress = parsed.ipAddress ? normalizeIpAddress(parsed.ipAddress) : "Unknown";
    browserInfo = parsed.browser || "Unknown Browser";
    deviceInfo = parsed.deviceName || "Unknown Device";
  }

  return tx.auditLog.create({
    data: {
      companyId: data?.companyId ?? null,
      moduleName: "LEAD",
      actionType,
      entityType: data?.entityType || "LEAD",
      entityId: data?.entityId ? Number(data.entityId) : 0,
      action: actionCode,
      oldValue: sanitizeAuditPayload(data?.oldValue ?? null),
      newValue: sanitizeAuditPayload(data?.newValue ?? null),
      ipAddress,
      browserInfo,
      deviceInfo,
      performedById: data?.performedById ?? null,
    }
  });
};

// ──────────────────────────────────────────────────────────────────────────────
// EXCEL IMPORT HELPERS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Fetches all existing mobile numbers for a company (for duplicate detection during import).
 * @param {number|null} companyId
 * @param {object} tx
 */
export const findExistingMobiles = async (companyId, tx = prisma) => {
  const leads = await tx.lead.findMany({
    where: {
      isDeleted: false,
      ...(companyId ? { companyId } : {})
    },
    select: { mobile: true }
  });
  return new Set(leads.map((l) => l.mobile));
};
