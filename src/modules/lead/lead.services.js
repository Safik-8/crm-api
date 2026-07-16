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

export const createLeadService = async (data, actor) => {
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
    courseId:         data.courseId  ?? null,
    statusId:         resolvedStatusId,
    priority:         data.priority  ?? "MEDIUM",
    budget:           data.budget != null ? data.budget : null,
    city:             data.city    || null,
    state:            data.state   || null,
    country:          data.country || null,
    notes:            data.notes   || null,
    interestedFor:    data.interestedFor ?? data.interested_for ?? null,
    assignedToId:     data.assignedToId  ?? null,
    isDeleted:        false,
    isDuplicate:      isDuplicateFlag,
    duplicateOfId:    duplicateOfId,
    createdById:      actor.id,
    updatedById:      actor.id
  };

  // 6. Create lead + audit log in a transaction
  return prisma.$transaction(async (tx) => {
    const lead = await createLead(payload, tx);

    await createAuditLog({
      companyId:     lead.companyId,
      entityId:      lead.id,
      action:        "CREATE",
      newValue:      JSON.stringify({ name: lead.name, mobile: lead.mobile, sourceId: lead.sourceId }),
      performedById: actor.id
    }, tx);

    return lead;
  }, {
    maxWait: 15000,
    timeout: 30000
  });
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

export const importLeadsFromExcelService = async (fileBuffer, pipelineId, actor) => {
  if (!fileBuffer) throw new BadRequestError("No file provided");

  const pid = Number(pipelineId);
  if (!Number.isInteger(pid) || pid < 1) throw new BadRequestError("pipelineId is required");

  // ── Parse Excel ───────────────────────────────────────────────────────────
  let rows;
  try {
    const workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: true });
    const sheet    = workbook.Sheets[workbook.SheetNames[0]];
    rows           = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  } catch {
    throw new BadRequestError("Failed to parse Excel file. Make sure it is a valid .xlsx / .xls file.");
  }

  if (!rows || rows.length === 0) throw new BadRequestError("Excel file is empty or has no data rows");

  // ── Column definitions ────────────────────────────────────────────────────
  const ALLOWED_COLUMNS = [
    { key: "name",         aliases: ["name"],                                                                            required: true  },
    { key: "mobile",       aliases: ["phone number", "phonenumber", "phone", "mobile"],                                  required: true  },
    { key: "date",         aliases: ["date"],                                                                            required: true  },
    { key: "interestedFor",aliases: ["interested at", "interestedat", "interested_at", "interested for", "interested in", "interestedin"], required: false },
    { key: "assignTo",     aliases: ["assign to", "assignto", "assigned to", "assignedto"],                              required: false }
  ];

  const ALL_KNOWN_ALIASES = new Set(ALLOWED_COLUMNS.flatMap((c) => c.aliases));

  const findCol = (rowKeys, aliases) => {
    const lower = rowKeys.map((k) => ({ orig: k, low: String(k).toLowerCase().trim() }));
    for (const alias of aliases) {
      const found = lower.find((k) => k.low === alias);
      if (found) return found.orig;
    }
    return null;
  };

  const sheetKeys     = Object.keys(rows[0]);
  const meaningfulKeys = sheetKeys.filter((k) => !String(k).startsWith("__EMPTY") && String(k).trim() !== "");

  const unknownCols = meaningfulKeys.filter((k) => !ALL_KNOWN_ALIASES.has(String(k).toLowerCase().trim()));
  if (unknownCols.length > 0) {
    throw new BadRequestError(
      `Excel contains unknown column(s): "${unknownCols.join('", "')}". ` +
      `Allowed columns are: Name, Phone Number, Date, Interested At, Assign To.`
    );
  }

  const colName       = findCol(meaningfulKeys, ALLOWED_COLUMNS[0].aliases);
  const colMobile     = findCol(meaningfulKeys, ALLOWED_COLUMNS[1].aliases);
  const colDate       = findCol(meaningfulKeys, ALLOWED_COLUMNS[2].aliases);
  const colInterested = findCol(meaningfulKeys, ALLOWED_COLUMNS[3].aliases);
  const colAssignTo   = findCol(meaningfulKeys, ALLOWED_COLUMNS[4].aliases);

  if (!colName)   throw new BadRequestError('Excel is missing required column "Name"');
  if (!colMobile) throw new BadRequestError('Excel is missing required column "Phone Number"');
  if (!colDate)   throw new BadRequestError('Excel is missing required column "Date"');

  if (!actor.branchId) {
    throw new BadRequestError("Your account is not associated with a branch. Cannot import leads.");
  }

  const branchUsers = await findBranchUsers(actor.branchId);
  const findUserByName = (rawName) => {
    if (!rawName) return null;
    const needle = String(rawName).toLowerCase().trim();
    return branchUsers.find((u) => u.name.toLowerCase().trim() === needle) ?? null;
  };

  const parseExcelDate = (raw) => {
    if (raw instanceof Date) {
      if (Number.isNaN(raw.getTime())) return null;
      const y  = raw.getFullYear();
      const m  = String(raw.getMonth() + 1).padStart(2, "0");
      const d  = String(raw.getDate()).padStart(2, "0");
      return new Date(`${y}-${m}-${d}T00:00:00.000Z`);
    }

    const str = String(raw).trim();
    if (!str) return null;

    let m1 = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (m1) {
      const d = new Date(`${m1[1]}-${m1[2].padStart(2,"0")}-${m1[3].padStart(2,"0")}T00:00:00.000Z`);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    let m2 = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (m2) {
      const d = new Date(`${m2[3]}-${m2[2].padStart(2,"0")}-${m2[1].padStart(2,"0")}T00:00:00.000Z`);
      return Number.isNaN(d.getTime()) ? null : d;
    }

    let m3 = str.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{4})$/);
    if (m3) {
      const d = new Date(`${m3[1]} ${m3[2]} ${m3[3]}`);
      if (!Number.isNaN(d.getTime())) {
        const y  = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, "0");
        const dy = String(d.getDate()).padStart(2, "0");
        return new Date(`${y}-${mo}-${dy}T00:00:00.000Z`);
      }
    }

    return null;
  };

  const existingMobiles = await findExistingMobiles(actor.companyId);

  // ── PASS 1 — Validate ALL rows ────────────────────────────────────────────
  const normalize        = (v) => String(v || "").trim();
  const validatedRows    = [];
  const validationErrors = [];
  const seenInFile       = new Set();

  for (let i = 0; i < rows.length; i++) {
    const row      = rows[i];
    const rowNum   = i + 2;
    const rowErrors = [];

    const rawName      = normalize(row[colName]);
    const rawDate      = row[colDate];
    const rawInterested = colInterested ? normalize(row[colInterested]) : "";
    const rawAssignTo   = colAssignTo   ? normalize(row[colAssignTo])   : "";

    if (!rawName) rowErrors.push("Name is required");
    else if (rawName.length > 100) rowErrors.push("Name must be 100 characters or less");
    else if (/\d/.test(rawName)) rowErrors.push("Name must not contain numbers");

    const rawMobileStr = (() => {
      const v = row[colMobile];
      if (v === "" || v === null || v === undefined) return "";
      if (typeof v === "number") return Math.round(v).toString();
      return String(v).trim();
    })();

    const mobileClean = rawMobileStr.replace(/[\s\-().+]/g, "");

    if (!mobileClean) rowErrors.push("Phone Number is required");
    else if (!/^\d+$/.test(mobileClean)) rowErrors.push(`Phone Number must contain digits only — got "${rawMobileStr}"`);
    else if (mobileClean.length !== 10) rowErrors.push(`Phone Number must be exactly 10 digits — got ${mobileClean.length} digit(s)`);
    else if (/^(\d)\1{9}$/.test(mobileClean)) rowErrors.push(`Phone Number "${mobileClean}" is not valid — all digits are the same`);
    else if (existingMobiles.has(mobileClean)) rowErrors.push(`Phone Number "${mobileClean}" is already registered in the system`);
    else if (seenInFile.has(mobileClean)) rowErrors.push(`Phone Number "${mobileClean}" appears more than once in this Excel file`);
    else seenInFile.add(mobileClean);

    let parsedDate = null;
    if (!rawDate && rawDate !== 0) rowErrors.push("Date is required");
    else {
      parsedDate = parseExcelDate(rawDate);
      if (!parsedDate) rowErrors.push(`Date "${rawDate}" is not a valid date. Use formats: YYYY-MM-DD, DD-MM-YYYY, or DD/MM/YYYY.`);
    }

    if (rawInterested && rawInterested.length > 200) rowErrors.push("Interested At must be 200 characters or less");

    let assignedToId = null;
    if (rawAssignTo) {
      const matchedUser = findUserByName(rawAssignTo);
      if (!matchedUser) rowErrors.push(`Assign To: "${rawAssignTo}" does not match any active user in your branch.`);
      else assignedToId = matchedUser.id;
    }

    if (rowErrors.length > 0) {
      validationErrors.push({ row: rowNum, data: { name: rawName, mobile: rawMobileStr }, errors: rowErrors });
    } else {
      validatedRows.push({
        rowNum,
        payload: {
          pipelineId:    pid,
          name:          rawName,
          mobile:        mobileClean,
          date:          parsedDate.toISOString(),
          interestedFor: rawInterested || undefined,
          assignedToId
        }
      });
    }
  }

  // Abort entirely if any row failed
  if (validationErrors.length > 0) {
    return {
      total:     rows.length,
      created:   0,
      skipped:   validationErrors.length,
      succeeded: [],
      failed:    validationErrors,
      message:   `Import aborted — ${validationErrors.length} row(s) have errors. Fix all errors and re-upload. No data was saved.`
    };
  }

  // ── PASS 2 — Insert all valid rows ────────────────────────────────────────
  const succeeded    = [];
  const insertErrors = [];

  for (const { rowNum, payload } of validatedRows) {
    try {
      const lead = await createLeadService(payload, actor);
      succeeded.push({ row: rowNum, leadId: lead.id, name: lead.name, mobile: lead.mobile });
    } catch (err) {
      const messages = err.errors
        ? err.errors.map((e) => e.message)
        : [err.message ?? "Unknown error"];
      insertErrors.push({ row: rowNum, data: { name: payload.name, mobile: payload.mobile }, errors: messages });
    }
  }

  return {
    total:     rows.length,
    created:   succeeded.length,
    skipped:   insertErrors.length,
    succeeded,
    failed:    insertErrors
  };
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

