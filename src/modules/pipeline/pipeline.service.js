import prisma from "../../config/db.js"
import { BadRequestError, NotFoundError, ValidationError } from "../../utils/AppError.js"
import {
  assignStagesToPipelineTx,
  createAuditLog,
  createPipelineTx,
  fetchBranchUsers,
  findBranchByCompanyAndId,
  findLeadsForBoard,
  findPipelineById,
  findPipelinesByWhere,
  findPipelineWithStages,
  softDeletePipelineDb,
  updatePipelineDb,
  updatePipelineStageOrderTx
} from "./pipeline.repository.js"

const normalizeName = (name) => String(name || "").trim()
const normalizeTextFilter = (value) => {
  const text = String(value || "").trim()
  return text || null
}

const resolveOrgContext = async (data, actor) => {
  if (actor.companyId && actor.branchId) {
    return { companyId: actor.companyId, branchId: actor.branchId }
  }

  if (actor.companyId && !actor.branchId) {
    const branchId = Number(data?.branchId)
    if (!Number.isInteger(branchId) || branchId < 1) {
      throw new ValidationError("Validation failed", [{ field: "branchId", message: "branchId is required" }])
    }
    const branch = await findBranchByCompanyAndId(branchId, actor.companyId)
    if (!branch) throw new BadRequestError("Invalid branchId for your company")
    return { companyId: actor.companyId, branchId }
  }

  const companyId = Number(data?.companyId)
  const branchId = Number(data?.branchId)
  const errors = []
  if (!Number.isInteger(companyId) || companyId < 1) errors.push({ field: "companyId", message: "companyId is required" })
  if (!Number.isInteger(branchId) || branchId < 1) errors.push({ field: "branchId", message: "branchId is required" })
  if (errors.length) throw new ValidationError("Validation failed", errors)

  const branch = await findBranchByCompanyAndId(branchId, companyId)
  if (!branch) throw new BadRequestError("Branch not found for given companyId")

  return { companyId, branchId }
}

const assertPipelineScope = (actor, pipeline) => {
  if (actor.companyId && pipeline.companyId !== actor.companyId) throw new BadRequestError("Invalid pipeline scope")
  if (actor.branchId && pipeline.branchId !== actor.branchId) throw new BadRequestError("Invalid pipeline scope")
}

const normalizePipelineStagesOrder = (stages) => {
  if (!Array.isArray(stages)) return stages
  const activeStages = stages.filter(s => s.stage && !s.stage.isDeleted)
  const getType = (s) => s.stage?.stageType ?? s.stageType
  const prospect = activeStages.find(s => getType(s) === "PROSPECT")
  const closure  = activeStages.find(s => getType(s) === "CLOSURE")
  const middle   = activeStages.filter(s => getType(s) !== "PROSPECT" && getType(s) !== "CLOSURE")
  const ordered  = []
  if (prospect) ordered.push(prospect)
  ordered.push(...middle)
  if (closure) ordered.push(closure)
  return ordered
}

const parsePositiveInt = (value, fieldName) => {
  if (value === undefined || value === null || value === "") return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ValidationError("Validation failed", [{ field: fieldName, message: `${fieldName} must be a valid positive integer` }])
  }
  return parsed
}

const getUtcTodayBounds = () => {
  const now = new Date()
  const y = now.getUTCFullYear()
  const mo = now.getUTCMonth()
  const d = now.getUTCDate()
  const from = new Date(Date.UTC(y, mo, d, 0, 0, 0, 0))
  const to = new Date(Date.UTC(y, mo, d, 23, 59, 59, 999))
  return { from, to }
}

const parseDateRange = (dateFrom, dateTo, query) => {
  const allDates =
    query?.allDates === "1" ||
    query?.allDates === "true" ||
    query?.allDates === true ||
    String(query?.allDates || "").toLowerCase() === "yes"

  const hasFrom = dateFrom !== undefined && dateFrom !== null && String(dateFrom).trim() !== ""
  const hasTo = dateTo !== undefined && dateTo !== null && String(dateTo).trim() !== ""

  if (allDates || (!hasFrom && !hasTo)) {
    return { from: null, to: null, defaultedToToday: false, skippedDateFilter: true }
  }

  const from = hasFrom ? new Date(dateFrom) : null
  const to = hasTo ? new Date(dateTo) : null

  if (from && Number.isNaN(from.getTime())) {
    throw new ValidationError("Validation failed", [{ field: "dateFrom", message: "dateFrom must be a valid date" }])
  }
  if (to && Number.isNaN(to.getTime())) {
    throw new ValidationError("Validation failed", [{ field: "dateTo", message: "dateTo must be a valid date" }])
  }
  if (from && to && from > to) {
    throw new ValidationError("Validation failed", [{ field: "dateRange", message: "dateFrom cannot be after dateTo" }])
  }

  return { from, to, defaultedToToday: false, skippedDateFilter: false }
}

const buildLeadBoardQueryOptions = (query) => {
  const sortBy = String(query?.sortBy || "createdAt").trim()
  const sortOrder = String(query?.sortOrder || "desc").trim().toLowerCase()
  const allowedSortBy = new Set(["createdAt", "updatedAt", "name", "date", "mobile"])
  const allowedSortOrder = new Set(["asc", "desc"])

  if (!allowedSortBy.has(sortBy)) {
    throw new ValidationError("Validation failed", [{
      field: "sortBy",
      message: "sortBy must be one of createdAt, updatedAt, name, date, mobile"
    }])
  }
  if (!allowedSortOrder.has(sortOrder)) {
    throw new ValidationError("Validation failed", [{ field: "sortOrder", message: "sortOrder must be asc or desc" }])
  }

  const { from, to, defaultedToToday, skippedDateFilter } = parseDateRange(query?.dateFrom, query?.dateTo, query)
  const stageId = parsePositiveInt(query?.stageId, "stageId")
  const assignedToId = parsePositiveInt(query?.assignedToId, "assignedToId")
  const search = normalizeTextFilter(query?.search ?? query?.leadName ?? query?.name ?? query?.q)

  const rawPriority = normalizeTextFilter(query?.priority)?.toUpperCase()
  const allowedPriorities = new Set(["HIGH", "MEDIUM", "LOW"])
  const priority = allowedPriorities.has(rawPriority) ? rawPriority : null

  return {
    search,
    stageId,
    assignedToId,
    priority,
    dateFrom: from,
    dateTo: to,
    dateDefaultedToToday: defaultedToToday,
    dateFilterSkipped: skippedDateFilter,
    sortBy,
    sortOrder
  }
}

export const createPipelineService = async (data, actor) => {
  const name = normalizeName(data?.name)
  if (!name) throw new ValidationError("Validation failed", [{ field: "name", message: "name is required" }])

  const { companyId, branchId } = await resolveOrgContext(data, actor)

  const pipeline = await createPipelineTx(name, companyId, branchId, actor.id)

  await createAuditLog({
    companyId,
    branchId,
    performedBy: actor.id,
    action: "PIPELINE_CREATED",
    entityId: pipeline.id,
    details: `Created pipeline '${pipeline.name}'`
  })

  return pipeline
}

export const listPipelinesService = async (query, actor) => {
  const where = { isDeleted: false }

  if ((!actor.primaryRoleRank || actor.primaryRoleRank < 100) && actor.role !== 'SUPER_ADMIN') {
    if (actor.companyId) where.companyId = actor.companyId;
    if (actor.branchId && actor.primaryRoleRank < 80) where.branchId = actor.branchId;
  }

  const pipelines = await findPipelinesByWhere(where)

  return pipelines.map(p => ({
    id: p.id,
    name: p.name,
    companyId: p.companyId,
    branchId: p.branchId,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    _count: p._count,
    leadCount: p._count?.leads ?? 0,
    stages: normalizePipelineStagesOrder(p.stages).map(ps => ({
      id: ps.stage.id,
      name: ps.stage.name,
      isDefault: ps.stage.isDefault,
      orderNo: ps.orderNo,
      stageType: ps.stage.stageType,
      colorCode: ps.stage.colorCode,
      code: ps.stage.code,
      status: ps.stage.status
    }))
  }))
}

const getSubordinateIds = async (managerId, companyId) => {
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

const actorScope = (actor) => {
  const scope = {};
  if ((actor.primaryRoleRank && actor.primaryRoleRank >= 100) || actor.role === 'SUPER_ADMIN') {
    return scope;
  }
  if (actor.companyId) scope.companyId = actor.companyId;
  if (actor.branchId && (!actor.primaryRoleRank || actor.primaryRoleRank < 80)) {
    scope.branchId = actor.branchId;
  }
  return scope;
};

export const getPipelineDetailsService = async (id, query, actor) => {
  const pipelineId = Number(id)
  if (!Number.isInteger(pipelineId) || pipelineId < 1) {
    throw new ValidationError("Validation failed", [{ field: "id", message: "Invalid pipeline id" }])
  }

  const pipeline = await findPipelineWithStages(pipelineId)
  if (!pipeline) throw new NotFoundError("Pipeline")
  assertPipelineScope(actor, pipeline)

  const options = buildLeadBoardQueryOptions(query)

  const stages = normalizePipelineStagesOrder(pipeline.stages).map(ps => ({
    id:        ps.stage.id,
    name:      ps.stage.name,
    isDefault: ps.stage.isDefault,
    orderNo:   ps.orderNo,
    stageType: ps.stage.stageType,
    colorCode: ps.stage.colorCode,
    code:      ps.stage.code,
    status:    ps.stage.status,
    leads:     []
  }))

  const leadWhere = {
    pipelineId: pipeline.id,
    isDeleted: false,
    ...actorScope(actor)
  }

  // HRBAC scoping for roles with Rank < 60 (BDE / ISE)
  // Strict Model: Reps see leads assigned to them or their direct subordinates
  if (actor && actor.primaryRoleRank < 60) {
    const subordinates = await getSubordinateIds(actor.id, actor.companyId);
    const allowedAssigneeIds = [actor.id, ...subordinates];

    if (query?.assignedToId) {
      const filterAssignee = Number(query.assignedToId);
      if (allowedAssigneeIds.includes(filterAssignee)) {
        leadWhere.assignedToId = filterAssignee;
      } else {
        leadWhere.assignedToId = -1; // Not allowed: force empty results
      }
    } else {
      leadWhere.assignedToId = { in: allowedAssigneeIds };
    }
  } else if (query?.assignedToId) {
    leadWhere.assignedToId = Number(query.assignedToId);
  }

  if (query.includeConverted === 'only') {
    leadWhere.opportunities = { some: { isDeleted: false } };
  } else if (query.includeConverted === 'true' || query.includeConverted === 'all') {
    // Show all leads (includes converted)
  } else {
    // Default: active prospecting view (excludes converted)
    leadWhere.opportunities = { none: { isDeleted: false } };
  }

  if (options.stageId) leadWhere.stageId = options.stageId
  if (options.priority) leadWhere.priority = options.priority

  if (options.search) {
    const searchConditions = [
      { name: { contains: options.search, mode: "insensitive" } },
      { mobile: { contains: options.search, mode: "insensitive" } },
      { interestedFor: { contains: options.search, mode: "insensitive" } }
    ];

    if (leadWhere.OR) {
      const existingScopeOR = leadWhere.OR;
      delete leadWhere.OR;
      leadWhere.AND = [
        { OR: existingScopeOR },
        { OR: searchConditions }
      ];
    } else {
      leadWhere.OR = searchConditions;
    }
  }
  if (!options.dateFilterSkipped && (options.dateFrom || options.dateTo)) {
    leadWhere.date = {
      ...(options.dateFrom ? { gte: options.dateFrom } : {})
    }
    if (options.dateTo) {
      leadWhere.date.lte = options.dateTo
    }
  }

  const leads = await findLeadsForBoard(leadWhere, options.sortBy, options.sortOrder)

  const leadsByStageId = new Map()
  for (const lead of leads) {
    const stageLeads = leadsByStageId.get(lead.stageId) || []
    stageLeads.push(lead)
    leadsByStageId.set(lead.stageId, stageLeads)
  }

  const boardStages = stages.map(stage => ({
    ...stage,
    leads: leadsByStageId.get(stage.id) || []
  }))

  const assignableUsers = await fetchBranchUsers(pipeline.branchId)

  return {
    id: pipeline.id,
    name: pipeline.name,
    branchId: pipeline.branchId,
    companyId: pipeline.companyId,
    createdAt: pipeline.createdAt,
    updatedAt: pipeline.updatedAt,
    stages: boardStages,
    leads,
    assignableUsers,
    filters: {
      stageId: options.stageId,
      assignedToId: options.assignedToId,
      priority: options.priority,
      search: options.search,
      dateFrom: options.dateFrom,
      dateTo: options.dateTo,
      dateDefaultedToToday: options.dateDefaultedToToday,
      allDates: options.dateFilterSkipped
    },
    sort: {
      sortBy: options.sortBy,
      sortOrder: options.sortOrder
    }
  }
}

export const updatePipelineService = async (id, data, actor) => {
  const pipelineId = Number(id)
  if (!Number.isInteger(pipelineId) || pipelineId < 1) throw new BadRequestError("Invalid pipeline id")

  const name = normalizeName(data?.name)
  if (!name) throw new ValidationError("Validation failed", [{ field: "name", message: "name is required" }])

  const pipeline = await findPipelineById(pipelineId)
  if (!pipeline || pipeline.isDeleted) throw new NotFoundError("Pipeline")
  assertPipelineScope(actor, pipeline)

  const updated = await updatePipelineDb(pipelineId, name, actor.id)

  await createAuditLog({
    companyId: pipeline.companyId,
    branchId: pipeline.branchId,
    performedBy: actor.id,
    action: "PIPELINE_UPDATED",
    entityId: pipeline.id,
    details: `Updated pipeline name from '${pipeline.name}' to '${name}'`
  })

  return updated
}

export const deletePipelineService = async (id, actor) => {
  const pipelineId = Number(id)
  if (!Number.isInteger(pipelineId) || pipelineId < 1) throw new BadRequestError("Invalid pipeline id")

  const pipeline = await findPipelineById(pipelineId)
  if (!pipeline || pipeline.isDeleted) throw new NotFoundError("Pipeline")
  assertPipelineScope(actor, pipeline)

  const deleted = await softDeletePipelineDb(pipelineId, actor.id)

  await createAuditLog({
    companyId: pipeline.companyId,
    branchId: pipeline.branchId,
    performedBy: actor.id,
    action: "PIPELINE_DELETED",
    entityId: pipeline.id,
    details: `Soft deleted pipeline '${pipeline.name}'`
  })

  return deleted
}

export const assignStagesToPipelineService = async (pipelineId, data, actor) => {
  const pid = Number(pipelineId)
  if (!Number.isInteger(pid) || pid < 1) throw new BadRequestError("Invalid pipeline id")

  const pipeline = await findPipelineById(pid)
  if (!pipeline || pipeline.isDeleted) throw new NotFoundError("Pipeline")
  assertPipelineScope(actor, pipeline)

  const incomingStageIds = Array.isArray(data?.stageIds) ? data.stageIds.map(Number).filter(n => Number.isInteger(n) && n > 0) : []
  const newStages = Array.isArray(data?.newStages) ? data.newStages : []
  const orderedStageIds = Array.isArray(data?.orderedStageIds) ? data.orderedStageIds.map(Number).filter(n => Number.isInteger(n) && n > 0) : null

  const assignedStages = await assignStagesToPipelineTx(pid, incomingStageIds, newStages, orderedStageIds, actor.id)

  await createAuditLog({
    companyId: pipeline.companyId,
    branchId: pipeline.branchId,
    performedBy: actor.id,
    action: "PIPELINE_STAGES_ASSIGNED",
    entityId: pipeline.id,
    details: `Assigned stages to pipeline '${pipeline.name}'`
  })

  return assignedStages
}

export const updatePipelineStageOrderService = async (pipelineId, data, actor) => {
  const pid = Number(pipelineId)
  if (!Number.isInteger(pid) || pid < 1) throw new BadRequestError("Invalid pipeline id")

  const pipeline = await findPipelineById(pid)
  if (!pipeline || pipeline.isDeleted) throw new NotFoundError("Pipeline")
  assertPipelineScope(actor, pipeline)

  const orderedStageIds = Array.isArray(data?.orderedStageIds) ? data.orderedStageIds.map(Number).filter(n => Number.isInteger(n) && n > 0) : []

  const updatedStages = await updatePipelineStageOrderTx(pid, orderedStageIds, actor.id)

  await createAuditLog({
    companyId: pipeline.companyId,
    branchId: pipeline.branchId,
    performedBy: actor.id,
    action: "PIPELINE_STAGE_ORDER_UPDATED",
    entityId: pipeline.id,
    details: `Updated stage order for pipeline '${pipeline.name}'`
  })

  return updatedStages
}
