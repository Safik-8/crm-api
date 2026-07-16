// src/modules/lead/lead.services.js

import * as XLSX from "xlsx";
import prisma from "../../config/db.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  DuplicateLeadWarningError
} from "../../utils/AppError.js";
import { parsePagination, parseSorting, buildSearchFilter } from "../../utils/queryHelpers.js";
import {
  findBranchUsers,
  findLeadFormData,
  checkLeadDuplicate,
  findDuplicateLead,
  findDefaultLeadStatus,
  findLeadById,
  findLeadByIdWithDetail,
  findPipelineById,
  findProspectStageForPipeline,
  findPipelineStageMapping,
  createLead,
  updateLead,
  findLeads,
  countLeads,
  createLeadComment,
  findLeadComments,
  createAuditLog,
  findExistingMobiles,
  createLeadNote,
  findLeadNotes,
  findLeadNoteById,
  updateLeadNote
} from "./lead.repository.js";

// ──────────────────────────────────────────────────────────────────────────────
// SCOPE GUARDS & HIERARCHY RESOLVERS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Recursively fetch all subordinate user IDs for a reporting manager.
 */
export const getSubordinateIds = async (managerId, companyId) => {
  if (!companyId) return [];
  const users = await prisma.user.findMany({
    where: { companyId, status: "ACTIVE" },
    select: { id: true, reportingManagerId: true }
  });

  const managerToSubordinates = {};
  users.forEach(u => {
    if (u.reportingManagerId) {
      if (!managerToSubordinates[u.reportingManagerId]) {
        managerToSubordinates[u.reportingManagerId] = [];
      }
      managerToSubordinates[u.reportingManagerId].push(u.id);
    }
  });

  const ids = [];
  const visited = new Set([managerId]);
  const queue = [managerId];
  while (queue.length > 0) {
    const current = queue.shift();
    const subs = managerToSubordinates[current];
    if (subs) {
      for (const subId of subs) {
        if (!visited.has(subId)) {
          visited.add(subId);
          ids.push(subId);
          queue.push(subId);
        }
      }
    }
  }
  return ids;
};

/**
 * Build Prisma where clause scoped to actor's company + branch.
 */
const actorScope = (actor) => {
  const scope = {};
  if (actor.companyId) scope.companyId = actor.companyId;
  if (actor.branchId)  scope.branchId  = actor.branchId;
  return scope;
};

/**
 * Assert that an existing lead belongs to the actor's tenant and hierarchy.
 * Supports both new-style (direct companyId/branchId) and legacy (pipeline-scoped) leads.
 */
const assertLeadScope = async (actor, lead) => {
  // New-style: direct tenant columns
  if (lead.companyId && actor.companyId && lead.companyId !== actor.companyId) {
    throw new ForbiddenError("Lead does not belong to your company");
  }
  if (lead.branchId && actor.branchId && lead.branchId !== actor.branchId) {
    throw new ForbiddenError("Lead does not belong to your branch");
  }

  // Legacy fallback: scope check via pipeline relation
  if (!lead.companyId && lead.pipeline) {
    if (actor.companyId && lead.pipeline.companyId !== actor.companyId) {
      throw new ForbiddenError("Lead does not belong to your company");
    }
    if (actor.branchId && lead.pipeline.branchId !== actor.branchId) {
      throw new ForbiddenError("Lead does not belong to your branch");
    }
  }

  // HRABAC Check: If user rank is BDE/ISE (< 60), restrict to self + subordinates
  if (actor.primaryRoleRank < 60) {
    const subordinates = await getSubordinateIds(actor.id, actor.companyId);
    const allowedUserIds = new Set([actor.id, ...subordinates]);

    const assignedToId = lead.assignedToId;
    const createdById  = lead.createdById;

    const hasAccess = allowedUserIds.has(assignedToId) || allowedUserIds.has(createdById);
    if (!hasAccess) {
      throw new ForbiddenError("You do not have permission to access this lead");
    }
  }
};


// ──────────────────────────────────────────────────────────────────────────────
// GET BRANCH USERS
// ──────────────────────────────────────────────────────────────────────────────

export const getBranchUsersForLeadService = async (actor) => {
  if (!actor.branchId) throw new BadRequestError("No branch associated with your account");
  return findBranchUsers(actor.branchId);
};

// ──────────────────────────────────────────────────────────────────────────────
// GET FORM DROPDOWN DATA
// ──────────────────────────────────────────────────────────────────────────────

export const getLeadFormDataService = async (actor, query = {}) => {
  const companyId = actor.companyId ?? (query.companyId ? Number(query.companyId) : null);
  const branchId  = actor.branchId  ?? (query.branchId ? Number(query.branchId) : null);
  return findLeadFormData(companyId, branchId);
};

// ──────────────────────────────────────────────────────────────────────────────
// CREATE LEAD
// ──────────────────────────────────────────────────────────────────────────────

export const createLeadService = async (data, actor, txClient = prisma) => {
  const companyId = actor.companyId ?? (data.companyId ? Number(data.companyId) : null);
  const branchId  = actor.branchId  ?? (data.branchId ? Number(data.branchId) : null);

  // 1. Duplicate check across mobile, email, alternate mobile within company scope
  let duplicate = null;
  if (companyId) {
    duplicate = await findDuplicateLead({
      mobile: data.mobile,
      email: data.email,
      alternateMobile: data.alternateMobile,
      companyId
    });

    if (duplicate) {
      if (data.overrideDuplicate === true) {
        if (actor.primaryRoleRank < 60) {
          throw new ForbiddenError("You do not have permission to override duplicate validation");
        }
      } else {
        // Find which field matched
        const matchedField = duplicate.mobile === data.mobile || duplicate.alternateMobile === data.mobile
          ? "mobile"
          : duplicate.email === data.email
          ? "email"
          : "alternateMobile";

        throw new DuplicateLeadWarningError("A lead with this contact information already exists", {
          existingLead: {
            name: duplicate.name,
            owner: duplicate.assignedTo?.name || "Unassigned",
            status: duplicate.status?.name || "None",
            mobile: duplicate.mobile,
            email: duplicate.email,
            alternateMobile: duplicate.alternateMobile
          },
          duplicateField: matchedField
        });
      }
    }
  }

  // 2. Routing Assignment Guards
  if (data.assignedToId && Number(data.assignedToId) !== actor.id) {
    const subordinates = await getSubordinateIds(actor.id, companyId);
    if (!subordinates.includes(Number(data.assignedToId))) {
      // Check if user has LEAD_ASSIGNMENT:canCreate permission
      const hasAssignmentPerm = actor.permissions?.LEAD_ASSIGNMENT?.canCreate;
      if (!hasAssignmentPerm) {
        throw new ForbiddenError("You do not have permission to assign leads to other users");
      }
    }
  }

  // 3. Pipeline resolution (optional — Kanban create passes pipelineId)
  let resolvedPipelineId = null;
  let resolvedStageId    = null;

  if (data.pipelineId) {
    const pipeline = await findPipelineById(data.pipelineId);
    if (!pipeline || pipeline.isDeleted) throw new NotFoundError("Pipeline");

    if (companyId && pipeline.companyId !== companyId) throw new ForbiddenError("Invalid pipeline scope");
    if (branchId  && pipeline.branchId  !== branchId)  throw new ForbiddenError("Invalid pipeline scope");

    const stageId = await findProspectStageForPipeline(data.pipelineId);
    if (stageId) {
      resolvedPipelineId = data.pipelineId;
      resolvedStageId    = stageId;
    }
  }

  // 4. Status — use provided, auto-assign default, or duplicate status if overridden
  let resolvedStatusId = data.statusId;
  let isDuplicateFlag = false;
  let duplicateOfId = null;

  if (companyId && duplicate && data.overrideDuplicate === true) {
    isDuplicateFlag = true;
    duplicateOfId = duplicate.id;
    const dupStatus = await prisma.leadStatus.findFirst({
      where: { companyId: null, code: "DUPLICATE" }
    });
    if (dupStatus) {
      resolvedStatusId = dupStatus.id;
    }
  }

  // 3.5 Course — use provided or resolve "Other" default course for company
  let resolvedCourseId = data.courseId ?? null;
  let resolvedInterestedFor = data.interestedFor ?? data.interested_for ?? null;

  if (!resolvedCourseId && companyId) {
    const activeCourses = await prisma.course.findMany({
      where: { companyId: Number(companyId), status: "ACTIVE", isDeleted: false }
    });
    let otherCourse = activeCourses.find(c => c.name.toLowerCase().trim() === "other");
    if (!otherCourse) {
      const company = await prisma.company.findUnique({
        where: { id: Number(companyId) },
        select: { name: true, code: true }
      });
      const prefix = company ? (company.code || company.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4)) : "CRS";
      const otherCode = `${prefix}-OTHER`.toUpperCase();

      const existingCodeCourse = await prisma.course.findFirst({
        where: { companyId: Number(companyId), code: otherCode }
      });

      if (existingCodeCourse) {
        otherCourse = await prisma.course.update({
          where: { id: existingCodeCourse.id },
          data: { name: "Other", status: "ACTIVE", isDeleted: false }
        });
      } else {
        otherCourse = await prisma.course.create({
          data: {
            companyId: Number(companyId),
            name: "Other",
            code: otherCode,
            category: "General",
            price: 0,
            createdById: actor.id
          }
        });
      }
    }
    resolvedCourseId = otherCourse.id;
    if (!resolvedInterestedFor) {
      resolvedInterestedFor = "Other";
    }
  } else if (resolvedCourseId) {
    if (!resolvedInterestedFor) {
      const dbCourse = await prisma.course.findUnique({
        where: { id: Number(resolvedCourseId) },
        select: { name: true }
      });
      if (dbCourse) {
        resolvedInterestedFor = dbCourse.name;
      }
    }
  }

  if (!resolvedStatusId) {
    resolvedStatusId = await findDefaultLeadStatus(companyId);
  }

  // 5. Build create payload
  const now = new Date();
  const payload = {
    companyId,
    branchId,
    pipelineId:       resolvedPipelineId,
    stageId:          resolvedStageId,
    previousStageId:  null,
    stageChangedById: resolvedStageId ? actor.id : null,
    stageChangedAt:   resolvedStageId ? now : null,
    name:             data.name,
    mobile:           data.mobile,
    email:            data.email   || null,
    alternateMobile:  data.alternateMobile || null,
    sourceId:         data.sourceId,
    courseId:         resolvedCourseId,
    statusId:         resolvedStatusId,
    priority:         data.priority  ?? "MEDIUM",
    budget:           data.budget != null ? data.budget : null,
    city:             data.city    || null,
    state:            data.state   || null,
    country:          data.country || null,
    notes:            data.notes   || null,
    interestedFor:    resolvedInterestedFor,
    assignedToId:     data.assignedToId  ?? null,
    isDeleted:        false,
    isDuplicate:      isDuplicateFlag,
    duplicateOfId:    duplicateOfId,
    createdById:      actor.id,
    updatedById:      actor.id
  };

  // 6. Create lead + audit log in a transaction
  const executeQueries = async (tx) => {
    const lead = await createLead(payload, tx);

    await createAuditLog({
      companyId:     lead.companyId,
      entityId:      lead.id,
      action:        "CREATE",
      newValue:      JSON.stringify({ name: lead.name, mobile: lead.mobile, sourceId: lead.sourceId }),
      performedById: actor.id
    }, tx);

    return lead;
  };

  if (typeof txClient.$transaction === "function") {
    return txClient.$transaction(async (tx) => executeQueries(tx), {
      maxWait: 15000,
      timeout: 30000
    });
  } else {
    return executeQueries(txClient);
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// GET LEADS LIST
// ──────────────────────────────────────────────────────────────────────────────

export const getLeadsService = async (query, actor) => {
  const { page, limit, skip } = parsePagination(query);

  const allowedSortFields = ["name", "mobile", "priority", "createdAt", "updatedAt"];
  const orderBy = parseSorting(query, allowedSortFields, { createdAt: "desc" });

  // Build where clause — always scoped to actor's tenant
  const where = { isDeleted: false, ...actorScope(actor) };

  // Apply HRABAC Filters for roles with Rank < 60 (BDE/ISE)
  if (actor.primaryRoleRank < 60) {
    const subordinates = await getSubordinateIds(actor.id, actor.companyId);
    where.OR = [
      { assignedToId: actor.id },
      { createdById: actor.id },
      { assignedToId: { in: subordinates } },
      { createdById: { in: subordinates } }
    ];

    // If explicit filter is passed, narrow down or restrict
    if (query?.assignedToId) {
      const filterAssignee = Number(query.assignedToId);
      if (filterAssignee === actor.id || subordinates.includes(filterAssignee)) {
        where.assignedToId = filterAssignee;
      } else {
        where.assignedToId = -1; // Not allowed: force empty results
      }
    }
  } else {
    if (query?.assignedToId) {
      where.assignedToId = Number(query.assignedToId);
    }
  }

  // Kanban filters
  if (query?.pipelineId) where.pipelineId = Number(query.pipelineId);
  if (query?.stageId)    where.stageId    = Number(query.stageId);

  // Lead management filters
  if (query?.sourceId)     where.sourceId     = Number(query.sourceId);
  if (query?.courseId)     where.courseId     = Number(query.courseId);
  if (query?.statusId)     where.statusId     = Number(query.statusId);
  if (query?.priority)     where.priority     = query.priority;
  if (query?.isDuplicate !== undefined) where.isDuplicate = query.isDuplicate === "true";

  // Date range
  if (query?.dateFrom || query?.dateTo) {
    where.createdAt = {};
    if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
    if (query.dateTo)   where.createdAt.lte = new Date(query.dateTo + "T23:59:59.999Z");
  }

  // Search
  const searchFilter = buildSearchFilter(query?.search, ["name", "mobile", "email"]);
  if (searchFilter) Object.assign(where, searchFilter);

  const [leads, total] = await Promise.all([
    findLeads({ where, orderBy, skip, take: limit }),
    countLeads(where)
  ]);

  return {
    leads,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

// ──────────────────────────────────────────────────────────────────────────────
// GET SINGLE LEAD
// ──────────────────────────────────────────────────────────────────────────────

export const getLeadByIdService = async (leadId, actor) => {
  const id = Number(leadId);
  if (!Number.isInteger(id) || id < 1) throw new BadRequestError("Invalid lead id");

  const lead = await findLeadByIdWithDetail(id);
  if (!lead || lead.isDeleted) throw new NotFoundError("Lead");

  await assertLeadScope(actor, lead);
  return lead;
};

// ──────────────────────────────────────────────────────────────────────────────
// UPDATE LEAD
// ──────────────────────────────────────────────────────────────────────────────

export const updateLeadService = async (leadId, data, actor) => {
  const id = Number(leadId);
  if (!Number.isInteger(id) || id < 1) throw new BadRequestError("Invalid lead id");

  const lead = await findLeadById(id);
  if (!lead || lead.isDeleted) throw new NotFoundError("Lead");

  await assertLeadScope(actor, lead);

  // Build update payload — only include fields that are present in data
  const updateData = { updatedById: actor.id };

  if (data.name          !== undefined) updateData.name           = data.name;
  if (data.mobile        !== undefined) updateData.mobile         = data.mobile;
  if (data.email         !== undefined) updateData.email          = data.email          || null;
  if (data.alternateMobile !== undefined) updateData.alternateMobile = data.alternateMobile || null;
  if (data.sourceId      !== undefined) updateData.sourceId       = data.sourceId       ?? null;
  if (data.courseId      !== undefined) updateData.courseId       = data.courseId       ?? null;
  if (data.statusId      !== undefined) updateData.statusId       = data.statusId       ?? null;
  if (data.priority      !== undefined) updateData.priority       = data.priority;
  if (data.budget        !== undefined) updateData.budget         = data.budget         ?? null;
  if (data.city          !== undefined) updateData.city           = data.city           || null;
  if (data.state         !== undefined) updateData.state          = data.state          || null;
  if (data.notes         !== undefined) updateData.notes          = data.notes          || null;
  if (data.assignedToId  !== undefined) updateData.assignedToId   = data.assignedToId   ?? null;

  // Duplicate check — only if contact details are being changed
  if (data.mobile || data.email || data.alternateMobile) {
    const duplicate = await findDuplicateLead({
      mobile: data.mobile !== undefined ? data.mobile : lead.mobile,
      email: data.email !== undefined ? data.email : lead.email,
      alternateMobile: data.alternateMobile !== undefined ? data.alternateMobile : lead.alternateMobile,
      companyId: lead.companyId,
      excludeLeadId: id
    });

    if (duplicate) {
      if (data.overrideDuplicate === true) {
        if (actor.primaryRoleRank < 60) {
          throw new ForbiddenError("You do not have permission to override duplicate validation");
        }
        updateData.isDuplicate = true;
        updateData.duplicateOfId = duplicate.id;
        const dupStatus = await prisma.leadStatus.findFirst({
          where: { companyId: null, code: "DUPLICATE" }
        });
        if (dupStatus) {
          updateData.statusId = dupStatus.id;
        }
      } else {
        const matchedField = duplicate.mobile === data.mobile || duplicate.alternateMobile === data.mobile
          ? "mobile"
          : duplicate.email === data.email
          ? "email"
          : "alternateMobile";

        throw new DuplicateLeadWarningError("A lead with this contact information already exists", {
          existingLead: {
            name: duplicate.name,
            owner: duplicate.assignedTo?.name || "Unassigned",
            status: duplicate.status?.name || "None",
            mobile: duplicate.mobile,
            email: duplicate.email,
            alternateMobile: duplicate.alternateMobile
          },
          duplicateField: matchedField
        });
      }
    }
  }

  // Routing Assignment Guards
  if (data.assignedToId && Number(data.assignedToId) !== actor.id) {
    const subordinates = await getSubordinateIds(actor.id, lead.companyId);
    if (!subordinates.includes(Number(data.assignedToId))) {
      // Check if user has LEAD_ASSIGNMENT:canEdit permission
      const hasAssignmentPerm = actor.permissions?.LEAD_ASSIGNMENT?.canEdit;
      if (!hasAssignmentPerm) {
        throw new ForbiddenError("You do not have permission to assign leads to other users");
      }
    }
  }

  // Status transitions closure notes check
  if (data.statusId) {
    const targetStatus = await prisma.leadStatus.findUnique({
      where: { id: data.statusId }
    });
    if (targetStatus && targetStatus.code === "CLOSED") {
      const notesValue = data.notes !== undefined ? data.notes : lead.notes;
      if (!notesValue || !notesValue.trim()) {
        throw new ValidationError("Validation failed", [
          { field: "notes", message: "A proper closure reason must be provided in notes when closing a lead" }
        ]);
      }
    }
  }

  // Tenant / Branch Re-assignment
  if (data.companyId !== undefined && actor.companyId === null) {
    updateData.companyId = data.companyId ? Number(data.companyId) : null;
  }
  if (data.branchId !== undefined && actor.branchId === null) {
    updateData.branchId = data.branchId ? Number(data.branchId) : null;
  }

  // Backward compat — Kanban edit form uses interestedFor
  if (data.interestedFor !== undefined || data.interested_for !== undefined) {
    const raw = data.interestedFor ?? data.interested_for;
    updateData.interestedFor = raw || null;
  }

  // Update lead + audit log in transaction
  return prisma.$transaction(async (tx) => {
    const currentLead = await findLeadByIdWithDetail(id, tx);
    const updated = await updateLead(id, updateData, tx);

    await createAuditLog({
      companyId:     lead.companyId,
      entityId:      id,
      action:        "UPDATE",
      oldValue:      JSON.stringify(currentLead),
      newValue:      JSON.stringify(updated),
      performedById: actor.id
    }, tx);

    return updated;
  }, {
    maxWait: 15000,
    timeout: 30000
  });
};

// ──────────────────────────────────────────────────────────────────────────────
// DELETE LEAD (soft delete)
// ──────────────────────────────────────────────────────────────────────────────

export const deleteLeadService = async (leadId, actor) => {
  const id = Number(leadId);
  if (!Number.isInteger(id) || id < 1) throw new BadRequestError("Invalid lead id");

  const lead = await findLeadById(id);
  if (!lead || lead.isDeleted) throw new NotFoundError("Lead");

  await assertLeadScope(actor, lead);

  return prisma.$transaction(async (tx) => {
    const deleted = await updateLead(id, {
      isDeleted:   true,
      deletedById: actor.id,
      deletedAt:   new Date(),
      updatedById: actor.id
    }, tx);

    await createAuditLog({
      companyId:     lead.companyId,
      entityId:      id,
      action:        "DELETE",
      oldValue:      JSON.stringify({ isDeleted: false }),
      newValue:      JSON.stringify({ isDeleted: true }),
      performedById: actor.id
    }, tx);

    return deleted;
  }, {
    maxWait: 15000,
    timeout: 30000
  });
};

export const tempDeleteAllLeadsService = async (actor) => {
  const where = { isDeleted: false };
  if (actor.companyId) {
    where.companyId = Number(actor.companyId);
  }
  if (actor.branchId) {
    where.branchId = Number(actor.branchId);
  }

  return prisma.lead.updateMany({
    where,
    data: {
      isDeleted: true,
      deletedById: actor.id,
      deletedAt: new Date(),
      updatedById: actor.id
    }
  });
};

// ──────────────────────────────────────────────────────────────────────────────
// UPDATE LEAD STAGE (Kanban board drag-drop)
// ──────────────────────────────────────────────────────────────────────────────

export const updateLeadStageService = async (leadId, data, actor) => {
  const id      = Number(leadId);
  const stageId = data.stageId; // Already validated/coerced by Zod

  if (!Number.isInteger(id) || id < 1) throw new BadRequestError("Invalid lead id");

  const lead = await findLeadById(id);
  if (!lead || lead.isDeleted) throw new NotFoundError("Lead");

  await assertLeadScope(actor, lead);

  // Closure lock
  if (lead.stage?.name === "Closure") {
    throw new ForbiddenError("This lead is closed. A closed lead cannot be moved to another stage.");
  }

  if (!lead.pipelineId) throw new BadRequestError("Lead is not assigned to a pipeline");

  const mapping = await findPipelineStageMapping(lead.pipelineId, stageId);
  if (!mapping) throw new BadRequestError("Stage is not assigned to this pipeline");

  if (lead.stageId === stageId) {
    return findLeadByIdWithDetail(id);
  }

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const updated = await updateLead(id, {
      previousStageId:  lead.stageId,
      stageId,
      stageChangedById: actor.id,
      stageChangedAt:   now,
      updatedById:      actor.id
    }, tx);

    await createAuditLog({
      companyId:     lead.companyId,
      entityId:      id,
      action:        "STAGE_CHANGE",
      oldValue:      JSON.stringify({ stageId: lead.stageId }),
      newValue:      JSON.stringify({ stageId }),
      performedById: actor.id
    }, tx);

    return updated;
  }, {
    maxWait: 15000,
    timeout: 30000
  });
};

// ──────────────────────────────────────────────────────────────────────────────
// LEAD COMMENTS
// ──────────────────────────────────────────────────────────────────────────────

export const addLeadCommentService = async (leadId, data, actor) => {
  const id = Number(leadId);
  if (!Number.isInteger(id) || id < 1) throw new BadRequestError("Invalid lead id");

  const lead = await findLeadById(id);
  if (!lead || lead.isDeleted) throw new NotFoundError("Lead");

  await assertLeadScope(actor, lead);

  return createLeadComment({
    leadId:      id,
    userId:      actor.id,
    comment:     data.comment,
    isDeleted:   false,
    createdById: actor.id
  });
};

export const getLeadCommentsService = async (leadId, actor) => {
  const id = Number(leadId);
  if (!Number.isInteger(id) || id < 1) throw new BadRequestError("Invalid lead id");

  const lead = await findLeadById(id);
  if (!lead || lead.isDeleted) throw new NotFoundError("Lead");

  await assertLeadScope(actor, lead);

  return findLeadComments(id);
};


// ──────────────────────────────────────────────────────────────────────────────
// BULK IMPORT LEADS FROM EXCEL — All or Nothing (Two-Pass)
//
// PASS 1: Validate ALL rows — collect every error, insert nothing if any fail.
// PASS 2: Only runs when every row passes — inserts all via createLeadService.
// ──────────────────────────────────────────────────────────────────────────────

// Helper function to find the closest matching string (for suggestions)
const findClosestMatch = (str, list) => {
  if (!str) return null;
  let closest = null;
  let minDistance = Infinity;
  const getLevenshteinDistance = (a, b) => {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
          );
        }
      }
    }
    return matrix[b.length][a.length];
  };
  for (const item of list) {
    const dist = getLevenshteinDistance(str.toLowerCase().trim(), item.toLowerCase().trim());
    if (dist < minDistance && dist < 4) { // Only suggest if edit distance is small
      minDistance = dist;
      closest = item;
    }
  }
  return closest;
};

export const importLeadsFromExcelService = async (
  fileBuffer,
  pipelineId,
  actor,
  commit = false,
  fileName = "import.xlsx",
  overrideCompanyId = null,
  overrideBranchId = null
) => {
  if (!fileBuffer) throw new BadRequestError("No file provided");

  let companyId = overrideCompanyId || actor.companyId;
  let branchId  = overrideBranchId || actor.branchId;

  // Backend validation of selected scopes:
  if (actor.primaryRole === "SUPER_ADMIN") {
    if (!companyId || !branchId) {
      throw new BadRequestError("Company and Branch scope must be selected.");
    }
    const resolvedBranch = await prisma.branch.findFirst({
      where: { id: Number(branchId), companyId: Number(companyId), status: "ACTIVE" }
    });
    if (!resolvedBranch) {
      throw new BadRequestError("Selected Branch does not belong to the selected Company or is inactive.");
    }
  } else if (actor.primaryRole === "COMPANY_ADMIN") {
    companyId = actor.companyId;
    if (!branchId) {
      throw new BadRequestError("Branch scope must be selected.");
    }
    const resolvedBranch = await prisma.branch.findFirst({
      where: { id: Number(branchId), companyId: Number(companyId), status: "ACTIVE" }
    });
    if (!resolvedBranch) {
      throw new BadRequestError("Selected Branch does not belong to your company or is inactive.");
    }
  } else {
    // BDE or Manager: force their own company and branch scope!
    companyId = actor.companyId;
    branchId = actor.branchId;
  }

  if (!branchId) {
    throw new BadRequestError("Your account is not associated with a branch, and no active branch could be resolved. Cannot import leads.");
  }

  // ── Parse Excel/CSV ───────────────────────────────────────────────────────
  let rows;
  try {
    const workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: true });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    rows           = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  } catch {
    throw new BadRequestError("Failed to parse file. Make sure it is a valid Excel (.xlsx) or CSV (.csv) file.");
  }

  if (!rows || rows.length === 0) throw new BadRequestError("File is empty or has no data rows");

  // 1. Limit row count to protect performance (e.g. max 1000 rows)
  if (rows.length > 1000) {
    throw new BadRequestError("File exceeds the limit of 1000 rows per import run.");
  }

  // ── Column headers mapping ────────────────────────────────────────────────
  const REQUIRED_HEADERS = [
    { key: "name",   aliases: ["lead name", "name"] },
    { key: "mobile", aliases: ["mobile number", "mobile", "phone number", "phone"] },
    { key: "source", aliases: ["lead source", "source"] },
    { key: "course", aliases: ["interested course/product", "interested course", "course", "product", "interested for"] }
  ];

  const OPTIONAL_HEADERS = [
    { key: "email",           aliases: ["email", "email address"] },
    { key: "alternateMobile", aliases: ["alternate contact", "alternate mobile", "alternate contact number", "secondary mobile"] },
    { key: "budget",          aliases: ["budget"] },
    { key: "city",            aliases: ["city"] },
    { key: "state",           aliases: ["state"] },
    { key: "country",         aliases: ["country"] },
    { key: "notes",           aliases: ["notes", "remark", "remarks"] },
    { key: "assignedTo",      aliases: ["assigned to", "assignedto", "owner", "assignee"] }
  ];

  const sheetKeys = Object.keys(rows[0]);
  const normalizeHeader = (h) => String(h).toLowerCase().trim().replace(/[\s\-_]/g, " ");
  
  const findColumnKey = (headerList) => {
    for (const h of headerList) {
      const found = sheetKeys.find((k) => h.aliases.includes(normalizeHeader(k)));
      if (found) return { fileKey: found, appKey: h.key };
    }
    return null;
  };

  // Verify required headers (role-aware)
  const columnMapping = {};
  const missingHeaders = [];
  for (const h of REQUIRED_HEADERS) {
    const matched = findColumnKey([h]);
    if (matched) {
      columnMapping[matched.appKey] = matched.fileKey;
    } else {
      missingHeaders.push(h.aliases[0]);
    }
  }

  if (missingHeaders.length > 0) {
    throw new BadRequestError(
      `File is missing required column(s): ${missingHeaders.map((m) => `"${m}"`).join(", ")}`
    );
  }

  // Map optional headers
  for (const h of OPTIONAL_HEADERS) {
    const matched = findColumnKey([h]);
    if (matched) {
      columnMapping[matched.appKey] = matched.fileKey;
    }
  }

  // Helper to extract values
  const getRowVal = (row, appKey) => {
    const fileKey = columnMapping[appKey];
    if (!fileKey) return "";
    return String(row[fileKey] ?? "").trim();
  };

  // ── Pre-fetch reference data to optimize performance ──────────────────────
  const [allCompanies, allBranches, allUsers, sources, courses, existingLeads] = await Promise.all([
    prisma.company.findMany({ where: { status: "ACTIVE" } }),
    prisma.branch.findMany({ where: { status: "ACTIVE" } }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      include: { userRoles: { include: { role: true } } }
    }),
    prisma.leadSource.findMany({
      where: {
        OR: [
          { companyId: null },
          { companyId: Number(companyId) }
        ],
        deletedAt: null
      }
    }),
    prisma.course.findMany({
      where: {
        companyId: Number(companyId),
        isDeleted: false
      }
    }),
    prisma.lead.findMany({
      where: { isDeleted: false },
      select: { id: true, mobile: true, email: true, alternateMobile: true, companyId: true }
    })
  ]);

  const sourceNames = sources.filter(s => s.isActive).map((s) => s.name);
  const courseNames = courses.filter(c => c.status === "ACTIVE").map((c) => c.name);

  // ── Row processing & validation ──────────────────────────────────────────
  const previewRows = [];
  const validPayloads = [];
  const errorReport = [];

  // Intra-file duplicate tracking sets (scoped per resolved company)
  const fileMobiles = {};
  const fileEmails = {};
  const fileAltMobiles = {};

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // header is row 1
    const rowErrors = [];
    const fieldsInError = [];
    const suggestions = {};

    const name = getRowVal(row, "name");
    const mobile = getRowVal(row, "mobile").replace(/[\s\-().+]/g, "");
    const sourceStr = getRowVal(row, "source");
    const courseStr = getRowVal(row, "course");
    const email = getRowVal(row, "email").toLowerCase();
    const alternateMobile = getRowVal(row, "alternateMobile").replace(/[\s\-().+]/g, "");
    const budgetStr = getRowVal(row, "budget");
    const city = getRowVal(row, "city");
    const state = getRowVal(row, "state");
    const country = getRowVal(row, "country");
    const notes = getRowVal(row, "notes");
    const assignedToVal = getRowVal(row, "assignedTo");

    // ── 1. Role-Based Company / Branch Scope Resolution ──
    const rowCompanyId = companyId;
    const rowBranchId  = branchId;

    // ── 2. Validate Lead Name ──
    if (!name) {
      rowErrors.push("Lead Name is required");
      fieldsInError.push("name");
    } else if (name.length > 100) {
      rowErrors.push("Lead Name must be 100 characters or less");
      fieldsInError.push("name");
    } else if (/\d/.test(name)) {
      rowErrors.push("Lead Name must not contain numbers");
      fieldsInError.push("name");
    }

    // ── 3. Validate Mobile Number ──
    if (!mobile) {
      rowErrors.push("Mobile Number is required");
      fieldsInError.push("mobile");
    } else if (!/^\d{10}$/.test(mobile)) {
      rowErrors.push("Mobile Number must be exactly 10 digits");
      fieldsInError.push("mobile");
    } else if (/^(\d)\1{9}$/.test(mobile)) {
      rowErrors.push("Mobile Number is not valid (all digits same)");
      fieldsInError.push("mobile");
    }

    // ── 4. Validate Source under resolved company scope ──
    let matchedSource = null;
    if (!sourceStr) {
      rowErrors.push("Lead Source is required");
      fieldsInError.push("source");
    } else if (rowCompanyId) {
      const normalizeCompare = (str) => String(str).toLowerCase().replace(/\s+/g, "");
      const normalizedSourceStr = normalizeCompare(sourceStr);
      matchedSource = sources.find(
        (s) => normalizeCompare(s.name) === normalizedSourceStr || String(s.id) === sourceStr
      );
      if (!matchedSource) {
        rowErrors.push("Lead Source was not recognized as a valid source for this company.");
        fieldsInError.push("source");
        const closest = findClosestMatch(sourceStr, sourceNames);
        if (closest) suggestions.source = closest;
      } else if (!matchedSource.isActive) {
        rowErrors.push("Lead Source exists but is currently inactive");
        fieldsInError.push("source");
      }
    }

    // ── 5. Validate Course under resolved company scope ──
    let matchedCourse = null;
    if (!courseStr) {
      rowErrors.push("Interested Course/Product is required");
      fieldsInError.push("course");
    } else if (rowCompanyId) {
      const normalizeCompare = (str) => String(str).toLowerCase().replace(/\s+/g, "");
      const normalizedCourseStr = normalizeCompare(courseStr);
      matchedCourse = courses.find(
        (c) => normalizeCompare(c.name) === normalizedCourseStr || String(c.id) === courseStr
      );
      if (!matchedCourse) {
        rowErrors.push("Course was not recognized as a valid course for this company.");
        fieldsInError.push("course");
        const closest = findClosestMatch(courseStr, courseNames);
        if (closest) suggestions.course = closest;
      } else if (matchedCourse.status !== "ACTIVE") {
        rowErrors.push("Course exists but is currently inactive");
        fieldsInError.push("course");
      }
    }

    // ── 6. Validate Email (optional, format check) ──
    if (email) {
      if (email.length > 255) {
        rowErrors.push("Email must be 255 characters or less");
        fieldsInError.push("email");
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        rowErrors.push("Email address is not in a valid format");
        fieldsInError.push("email");
      }
    }

    // ── 7. Validate Alternate Mobile (optional, format check) ──
    if (alternateMobile) {
      if (!/^\d{10}$/.test(alternateMobile)) {
        rowErrors.push("Alternate Contact must be exactly 10 digits");
        fieldsInError.push("alternateMobile");
      } else if (/^(\d)\1{9}$/.test(alternateMobile)) {
        rowErrors.push("Alternate Contact is not valid (all digits same)");
        fieldsInError.push("alternateMobile");
      } else if (alternateMobile === mobile) {
        rowErrors.push("Alternate Contact must not be identical to primary Mobile Number");
        fieldsInError.push("alternateMobile");
      }
    }

    // ── 8. Validate Budget (optional, decimal check) ──
    let budget = null;
    if (budgetStr) {
      const parsedBudget = parseFloat(budgetStr);
      if (Number.isNaN(parsedBudget) || parsedBudget < 0) {
        rowErrors.push("Budget must be a non-negative number");
        fieldsInError.push("budget");
      } else {
        budget = parsedBudget;
      }
    }

    // ── 9. Trim & check City/State/Country ──
    if (city && city.length > 100) {
      rowErrors.push("City must be 100 characters or less");
      fieldsInError.push("city");
    }
    if (state && state.length > 100) {
      rowErrors.push("State must be 100 characters or less");
      fieldsInError.push("state");
    }
    if (country && country.length > 100) {
      rowErrors.push("Country must be 100 characters or less");
      fieldsInError.push("country");
    }

    // ── 10. Notes check ──
    if (notes && notes.length > 1000) {
      rowErrors.push("Notes must be 1000 characters or less");
      fieldsInError.push("notes");
    }

    // ── 11. Optional "Assigned To" (lead owner) Validation ──
    let resolvedAssignedToId = null;
    if (assignedToVal && rowCompanyId) {
      const targetUser = allUsers.find(
        (u) =>
          u.email.toLowerCase().trim() === assignedToVal.toLowerCase().trim() ||
          (u.employeeId && u.employeeId.toLowerCase().trim() === assignedToVal.toLowerCase().trim())
      );

      if (!targetUser) {
        rowErrors.push(`Assigned user "${assignedToVal}" does not exist or is inactive`);
        fieldsInError.push("assignedTo");
      } else if (targetUser.companyId !== rowCompanyId) {
        rowErrors.push(`User "${assignedToVal}" does not belong to the resolved Company`);
        fieldsInError.push("assignedTo");
      } else if (rowBranchId && targetUser.branchId !== rowBranchId) {
        rowErrors.push(`User "${assignedToVal}" does not belong to the resolved Branch`);
        fieldsInError.push("assignedTo");
      } else {
        resolvedAssignedToId = targetUser.id;
      }
    }

    // ── 12. Duplicate Detection (scoped per resolved company) ──
    let isDuplicateRow = false;
    let duplicateReason = "";

    if (rowErrors.length === 0 && rowCompanyId) {
      // Initialize intra-file tracking sets for this company if not existing
      if (!fileMobiles[rowCompanyId]) fileMobiles[rowCompanyId] = new Set();
      if (!fileEmails[rowCompanyId]) fileEmails[rowCompanyId] = new Set();
      if (!fileAltMobiles[rowCompanyId]) fileAltMobiles[rowCompanyId] = new Set();

      // Check database duplicates within company scope
      const dbDupeMobile = existingLeads.some((l) => l.mobile === mobile && l.companyId === rowCompanyId);
      const dbDupeEmail = email && existingLeads.some((l) => l.email && l.email.toLowerCase().trim() === email.toLowerCase().trim() && l.companyId === rowCompanyId);
      const dbDupeAlt = alternateMobile && existingLeads.some((l) => l.alternateMobile === alternateMobile && l.companyId === rowCompanyId);

      if (mobile && dbDupeMobile) {
        isDuplicateRow = true;
        duplicateReason = `Mobile number "${mobile}" already exists in the system under this company`;
      } else if (email && dbDupeEmail) {
        isDuplicateRow = true;
        duplicateReason = `Email "${email}" already exists in the system under this company`;
      } else if (alternateMobile && dbDupeAlt) {
        isDuplicateRow = true;
        duplicateReason = `Alternate contact "${alternateMobile}" already exists in the system under this company`;
      }

      // Check intra-file duplicates
      if (!isDuplicateRow) {
        if (mobile && fileMobiles[rowCompanyId].has(mobile)) {
          isDuplicateRow = true;
          duplicateReason = `Duplicate mobile number "${mobile}" found in this file for this company`;
        } else if (email && fileEmails[rowCompanyId].has(email)) {
          isDuplicateRow = true;
          duplicateReason = `Duplicate email "${email}" found in this file for this company`;
        } else if (alternateMobile && fileAltMobiles[rowCompanyId].has(alternateMobile)) {
          isDuplicateRow = true;
          duplicateReason = `Duplicate alternate contact "${alternateMobile}" found in this file for this company`;
        }
      }

      // Track inside current file sets for next rows
      if (mobile) fileMobiles[rowCompanyId].add(mobile);
      if (email) fileEmails[rowCompanyId].add(email);
      if (alternateMobile) fileAltMobiles[rowCompanyId].add(alternateMobile);
    }

    const hasError = rowErrors.length > 0;
    const isSkipped = hasError || isDuplicateRow;

    if (isSkipped) {
      errorReport.push({
        row: rowNum,
        name,
        mobile: mobile || getRowVal(row, "mobile"),
        type: hasError ? "validation" : "duplicate",
        reason: hasError ? rowErrors.join(", ") : duplicateReason,
        fields: fieldsInError,
        suggestions: Object.keys(suggestions).length > 0 ? suggestions : undefined
      });
    } else {
      validPayloads.push({
        rowNum,
        payload: {
          companyId: rowCompanyId,
          branchId: rowBranchId,
          pipelineId: pipelineId ? Number(pipelineId) : null,
          name,
          mobile,
          email: email || null,
          alternateMobile: alternateMobile || null,
          sourceId: matchedSource.id,
          courseId: matchedCourse ? matchedCourse.id : null,
          interestedFor: matchedCourse ? matchedCourse.name : null,
          priority: "MEDIUM",
          budget,
          city: city || null,
          state: state || null,
          country: country || null,
          notes: notes || null,
          assignedToId: resolvedAssignedToId || null
        }
      });
    }

    // Keep first 10 rows for preview list
    if (i < 10) {
      previewRows.push({
        rowNum,
        name,
        mobile: mobile || getRowVal(row, "mobile"),
        source: sourceStr,
        course: courseStr,
        email,
        alternateMobile,
        budget: budgetStr,
        city,
        state,
        country,
        notes,
        assignedTo: assignedToVal,
        status: hasError ? "INVALID" : isDuplicateRow ? "DUPLICATE" : "VALID",
        errors: hasError ? rowErrors : isDuplicateRow ? [duplicateReason] : []
      });
    }
  }

  const successCount = validPayloads.length;
  const duplicateCount = errorReport.filter((e) => e.type === "duplicate").length;
  const failureCount = errorReport.filter((e) => e.type === "validation").length;

  // If preview mode, return preview stats and row samples
  if (!commit) {
    return {
      totalRows: rows.length,
      successCount,
      failureCount,
      duplicateCount,
      previewRows,
      errorReport: errorReport.slice(0, 100),
      message: `Preview generated. ${successCount} rows valid, ${duplicateCount} duplicate(s), ${failureCount} failure(s).`
    };
  }

  // ── Commit Phase: Atomic All-or-Nothing Check ──
  const createdLeads = [];
  
  if (errorReport.length > 0) {
    // Write entry to LeadImportLog table as FAILED
    const importLog = await prisma.leadImportLog.create({
      data: {
        companyId,
        branchId,
        pipelineId: pipelineId ? Number(pipelineId) : null,
        fileName,
        totalRows: rows.length,
        successCount: 0,
        failureCount: errorReport.length,
        duplicateCount: 0,
        status: "FAILED",
        errorReport: errorReport,
        createdById: actor.id
      }
    });

    return {
      id: importLog.id,
      fileName,
      totalRows: rows.length,
      successCount: 0,
      failureCount: errorReport.length,
      duplicateCount: 0,
      status: "FAILED",
      errorReport: errorReport,
      message: `Import rejected — ${errorReport.length} row(s) contain errors or duplicates. Fix all errors and re-upload. No data was saved.`
    };
  }

  // If 100% valid, proceed with creation in a single transaction
  if (successCount > 0) {
    await prisma.$transaction(async (tx) => {
      for (const { payload } of validPayloads) {
        const lead = await createLeadService(payload, actor, tx);
        createdLeads.push(lead.id);
      }
    }, {
      timeout: 30000 // 30 seconds timeout
    });
  }

  // Record operation to LeadImportLog table as COMPLETED
  const importLog = await prisma.leadImportLog.create({
    data: {
      companyId,
      branchId,
      pipelineId: pipelineId ? Number(pipelineId) : null,
      fileName,
      totalRows: rows.length,
      successCount,
      failureCount: 0,
      duplicateCount: 0,
      status: "COMPLETED",
      errorReport: [],
      createdById: actor.id
    }
  });

  return {
    id: importLog.id,
    fileName,
    totalRows: rows.length,
    successCount,
    failureCount: 0,
    duplicateCount: 0,
    status: "COMPLETED",
    message: `Import complete. ${successCount} lead(s) successfully created.`
  };
};

export const getLeadImportLogsService = async (actor) => {
  const companyId = actor.companyId;
  const branchId  = actor.branchId;
  if (!branchId) throw new BadRequestError("No branch scope associated with your account");

  return prisma.leadImportLog.findMany({
    where: { companyId, branchId },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true } }
    }
  });
};

// ──────────────────────────────────────────────────────────────────────────────
// LEAD NOTES CRUD
// ──────────────────────────────────────────────────────────────────────────────

export const getLeadNotesService = async (leadId, actor) => {
  const id = Number(leadId);
  if (!Number.isInteger(id) || id < 1) throw new BadRequestError("Invalid lead id");

  const lead = await findLeadById(id);
  if (!lead || lead.isDeleted) throw new NotFoundError("Lead");

  await assertLeadScope(actor, lead);
  return findLeadNotes(id);
};

export const createLeadNoteService = async (leadId, data, actor) => {
  const id = Number(leadId);
  if (!Number.isInteger(id) || id < 1) throw new BadRequestError("Invalid lead id");

  const lead = await findLeadById(id);
  if (!lead || lead.isDeleted) throw new NotFoundError("Lead");

  await assertLeadScope(actor, lead);

  if (!data.note || !data.note.trim()) {
    throw new ValidationError("Validation failed", [{ field: "note", message: "Note text is required" }]);
  }

  return prisma.$transaction(async (tx) => {
    const note = await createLeadNote({
      leadId: id,
      note: data.note.trim(),
      createdById: actor.id
    }, tx);

    await createAuditLog({
      companyId: lead.companyId,
      entityId: id,
      action: "NOTE_ADD",
      newValue: JSON.stringify({ noteId: note.id, text: note.note }),
      performedById: actor.id
    }, tx);

    return note;
  }, {
    maxWait: 15000,
    timeout: 30000
  });
};

export const updateLeadNoteService = async (leadId, noteId, data, actor) => {
  const lid = Number(leadId);
  const nid = Number(noteId);
  if (!Number.isInteger(lid) || lid < 1) throw new BadRequestError("Invalid lead id");
  if (!Number.isInteger(nid) || nid < 1) throw new BadRequestError("Invalid note id");

  const lead = await findLeadById(lid);
  if (!lead || lead.isDeleted) throw new NotFoundError("Lead");

  await assertLeadScope(actor, lead);

  const note = await findLeadNoteById(nid);
  if (!note || note.isDeleted || note.leadId !== lid) throw new NotFoundError("Note");

  // Only the creator of the note or a manager can edit it
  if (note.createdById !== actor.id && actor.primaryRoleRank < 60) {
    throw new ForbiddenError("You do not have permission to edit this note");
  }

  if (!data.note || !data.note.trim()) {
    throw new ValidationError("Validation failed", [{ field: "note", message: "Note text is required" }]);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await updateLeadNote(nid, {
      note: data.note.trim(),
      updatedById: actor.id
    }, tx);

    await createAuditLog({
      companyId: lead.companyId,
      entityId: lid,
      action: "NOTE_UPDATE",
      oldValue: JSON.stringify({ text: note.note }),
      newValue: JSON.stringify({ text: updated.note }),
      performedById: actor.id
    }, tx);

    return updated;
  }, {
    maxWait: 15000,
    timeout: 30000
  });
};

export const deleteLeadNoteService = async (leadId, noteId, actor) => {
  const lid = Number(leadId);
  const nid = Number(noteId);
  if (!Number.isInteger(lid) || lid < 1) throw new BadRequestError("Invalid lead id");
  if (!Number.isInteger(nid) || nid < 1) throw new BadRequestError("Invalid note id");

  const lead = await findLeadById(lid);
  if (!lead || lead.isDeleted) throw new NotFoundError("Lead");

  await assertLeadScope(actor, lead);

  const note = await findLeadNoteById(nid);
  if (!note || note.isDeleted || note.leadId !== lid) throw new NotFoundError("Note");

  // Only the creator or a manager can delete it
  if (note.createdById !== actor.id && actor.primaryRoleRank < 60) {
    throw new ForbiddenError("You do not have permission to delete this note");
  }

  return prisma.$transaction(async (tx) => {
    const deleted = await updateLeadNote(nid, {
      isDeleted: true,
      updatedById: actor.id
    }, tx);

    await createAuditLog({
      companyId: lead.companyId,
      entityId: lid,
      action: "NOTE_DELETE",
      oldValue: JSON.stringify({ noteId: nid }),
      performedById: actor.id
    }, tx);

    return deleted;
  }, {
    maxWait: 15000,
    timeout: 30000
  });
};

// ──────────────────────────────────────────────────────────────────────────────
// LEAD TIMELINE
// ──────────────────────────────────────────────────────────────────────────────

export const getLeadTimelineService = async (leadId, actor) => {
  const id = Number(leadId);
  if (!Number.isInteger(id) || id < 1) throw new BadRequestError("Invalid lead id");

  const lead = await findLeadById(id);
  if (!lead || lead.isDeleted) throw new NotFoundError("Lead");

  await assertLeadScope(actor, lead);

  return prisma.auditLog.findMany({
    where: {
      entityType: "LEAD",
      entityId: id
    },
    orderBy: { createdAt: "desc" },
    include: {
      performedBy: { select: { id: true, name: true } }
    }
  });
};
export const getImportErrorsCsvService = async (logId, actor) => {
  const id = Number(logId);
  if (!id) throw new BadRequestError("Invalid log ID");

  const log = await prisma.leadImportLog.findUnique({
    where: { id }
  });

  if (!log) throw new NotFoundError("Import Log");

  if (log.companyId !== actor.companyId || log.branchId !== actor.branchId) {
    throw new ForbiddenError("You do not have access to this import log");
  }

  const errors = Array.isArray(log.errorReport) ? log.errorReport : [];

  let csv = "Row Number,Lead Name,Mobile Number,Type,Reason,Suggested Correction\n";
  for (const err of errors) {
    const rowNum = err.row || "";
    const name = `"${(err.name || "").replace(/"/g, '""')}"`;
    const mobile = `"${(err.mobile || "").replace(/"/g, '""')}"`;
    const type = `"${(err.type || "").replace(/"/g, '""')}"`;
    const reason = `"${(err.reason || "").replace(/"/g, '""')}"`;

    let suggestion = "";
    if (err.suggestions) {
      suggestion = Object.entries(err.suggestions)
        .map(([k, v]) => `${k}: Use "${v}"`)
        .join("; ");
    }
    suggestion = `"${suggestion.replace(/"/g, '""')}"`;

    csv += `${rowNum},${name},${mobile},${type},${reason},${suggestion}\n`;
  }

  return csv;
};

// ──────────────────────────────────────────────────────────────────────────────
// RESTORE LEAD
// ──────────────────────────────────────────────────────────────────────────────

export const restoreLeadService = async (leadId, actor) => {
  const id = Number(leadId);
  if (!Number.isInteger(id) || id < 1) throw new BadRequestError("Invalid lead id");

  // Reopen deleted leads is restricted to Rank >= 60
  if (actor.primaryRoleRank < 60) {
    throw new ForbiddenError("You do not have permission to restore deleted leads");
  }

  const lead = await prisma.lead.findUnique({
    where: { id }
  });
  if (!lead) throw new NotFoundError("Lead");
  if (!lead.isDeleted) throw new BadRequestError("Lead is not deleted");

  // Scope check
  if (lead.companyId && actor.companyId && lead.companyId !== actor.companyId) {
    throw new ForbiddenError("Lead does not belong to your company");
  }

  return prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id },
      data: {
        isDeleted: false,
        deletedById: null,
        deletedAt: null,
        updatedById: actor.id
      }
    });

    await createAuditLog({
      companyId: lead.companyId,
      entityId: id,
      action: "RESTORE",
      oldValue: JSON.stringify({ isDeleted: true }),
      newValue: JSON.stringify({ isDeleted: false }),
      performedById: actor.id
    }, tx);

    return findLeadByIdWithDetail(id, tx);
  }, {
    maxWait: 15000,
    timeout: 30000
  });
};
