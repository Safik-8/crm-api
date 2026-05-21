import prisma from "../../config/db.js"
import { BadRequestError, NotFoundError, ValidationError } from "../../utils/AppError.js"
import { getBranchUsersByBranchId, leadStageLogInclude } from "../lead/lead.service.js"

const normalizeName = (name) => String(name || "").trim()
const normalizeTextFilter = (value) => {
  const text = String(value || "").trim()
  return text || null
}

const resolveOrgContext = async (data, actor) => {
  // branch users: fixed to actor
  if (actor.companyId && actor.branchId) {
    return { companyId: actor.companyId, branchId: actor.branchId }
  }

  // company level users (no branch): must specify branchId in body
  if (actor.companyId && !actor.branchId) {
    const branchId = Number(data?.branchId)
    if (!Number.isInteger(branchId) || branchId < 1) {
      throw new ValidationError("Validation failed", [{ field: "branchId", message: "branchId is required" }])
    }
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, companyId: actor.companyId },
      select: { id: true, companyId: true }
    })
    if (!branch) throw new BadRequestError("Invalid branchId for your company")
    return { companyId: actor.companyId, branchId }
  }

  // super admin: must specify companyId + branchId
  const companyId = Number(data?.companyId)
  const branchId = Number(data?.branchId)
  const errors = []
  if (!Number.isInteger(companyId) || companyId < 1) errors.push({ field: "companyId", message: "companyId is required" })
  if (!Number.isInteger(branchId) || branchId < 1) errors.push({ field: "branchId", message: "branchId is required" })
  if (errors.length) throw new ValidationError("Validation failed", errors)

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, companyId },
    select: { id: true }
  })
  if (!branch) throw new BadRequestError("Branch not found for given companyId")

  return { companyId, branchId }
}

const assertPipelineScope = (actor, pipeline) => {
  if (actor.companyId && pipeline.companyId !== actor.companyId) throw new BadRequestError("Invalid pipeline scope")
  if (actor.branchId && pipeline.branchId !== actor.branchId) throw new BadRequestError("Invalid pipeline scope")
}

const normalizePipelineStagesOrder = (stages) => {
  if (!Array.isArray(stages)) return stages
  const prospect = stages.find(s => s.name === "Prospect")
  const closure = stages.find(s => s.name === "Closure")
  const middle = stages.filter(s => s.name !== "Prospect" && s.name !== "Closure")
  const ordered = []
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

/** UTC calendar day bounds for "today" (matches lead date storage as UTC day). */
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
    String(query?.allDates || "").toLowerCase() === "yes"

  if (allDates) {
    return { from: null, to: null, defaultedToToday: false, skippedDateFilter: true }
  }

  const hasFrom = dateFrom !== undefined && dateFrom !== null && String(dateFrom).trim() !== ""
  const hasTo = dateTo !== undefined && dateTo !== null && String(dateTo).trim() !== ""

  if (!hasFrom && !hasTo) {
    const { from, to } = getUtcTodayBounds()
    return { from, to, defaultedToToday: true, skippedDateFilter: false }
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
  // One search box: matches lead name, mobile, or interestedFor (case-insensitive partial match)
  const search = normalizeTextFilter(query?.search ?? query?.leadName ?? query?.name ?? query?.q)

  return {
    search,
    stageId,
    assignedToId,
    dateFrom: from,
    dateTo: to,
    dateDefaultedToToday: defaultedToToday,
    dateFilterSkipped: skippedDateFilter,
    sortBy,
    sortOrder
  }
}

const ensureDefaultStages = async (tx, actorId) => {
  const stageNames = ["Prospect", "Closure"]
  const stages = {}

  for (const name of stageNames) {
    let stage = await tx.stage.findUnique({
      where: { name },
      select: { id: true, isDefault: true, isDeleted: true }
    })

    if (stage) {
      if (stage.isDeleted || !stage.isDefault) {
        stage = await tx.stage.update({
          where: { id: stage.id },
          data: { isDeleted: false, isDefault: true, updatedById: actorId }
        })
      }
    } else {
      stage = await tx.stage.create({
        data: {
          name,
          isDefault: true,
          isDeleted: false,
          createdById: actorId
        }
      })
    }

    stages[name] = stage
  }

  return stages
}

export const createPipelineService = async (data, actor) => {
  const name = normalizeName(data?.name)
  if (!name) throw new ValidationError("Validation failed", [{ field: "name", message: "name is required" }])

  const { companyId, branchId } = await resolveOrgContext(data, actor)

  // Rule: Every pipeline MUST have Prospect first and Closure last.
  return prisma.$transaction(async (tx) => {
    const pipeline = await tx.pipeline.create({
      data: {
        name,
        companyId,
        branchId,
        isDeleted: false,
        createdById: actor.id
      }
    })

    const { Prospect: prospect, Closure: closure } = await ensureDefaultStages(tx, actor.id)

    await tx.pipelineStage.createMany({
      data: [
        { pipelineId: pipeline.id, stageId: prospect.id, orderNo: 1 },
        { pipelineId: pipeline.id, stageId: closure.id, orderNo: 2 }
      ]
    })

    return pipeline
  })
}

export const listPipelinesService = async (query, actor) => {
  const where = { isDeleted: false }

  if (actor.companyId) where.companyId = actor.companyId
  if (actor.branchId) where.branchId = actor.branchId

  const listSearch = normalizeTextFilter(query?.search ?? query?.leadName ?? query?.name ?? query?.q)
  if (listSearch) {
    where.leads = {
      some: {
        isDeleted: false,
        OR: [
          { name: { contains: listSearch, mode: "insensitive" } },
          { mobile: { contains: listSearch, mode: "insensitive" } },
          { interestedFor: { contains: listSearch, mode: "insensitive" } }
        ]
      }
    }
  }

  if (!actor.branchId && query?.branchId) {
    where.branchId = Number(query.branchId)
  }

  const pipelines = await prisma.pipeline.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      stages: {
        orderBy: { orderNo: "asc" },
        include: { stage: true }
      }
    }
  })

  const pipelineIds = pipelines.map(p => p.id)
  if (!pipelineIds.length) return []

  const leadCounts = await prisma.lead.groupBy({
    by: ["pipelineId", "stageId"],
    where: {
      isDeleted: false,
      pipelineId: { in: pipelineIds }
    },
    _count: { _all: true }
  })

  const countsByPipelineId = new Map()
  const countsByPipelineStageKey = new Map()
  for (const row of leadCounts) {
    const key = `${row.pipelineId}:${row.stageId}`
    const count = row._count?._all ?? 0
    countsByPipelineStageKey.set(key, count)
    countsByPipelineId.set(row.pipelineId, (countsByPipelineId.get(row.pipelineId) ?? 0) + count)
  }

  return pipelines.map(p => ({
    id: p.id,
    name: p.name,
    branchId: p.branchId,
    companyId: p.companyId,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    leadCount: countsByPipelineId.get(p.id) ?? 0,
    stages: normalizePipelineStagesOrder(p.stages).map(ps => ({
      id: ps.stage.id,
      name: ps.stage.name,
      isDefault: ps.stage.isDefault,
      orderNo: ps.orderNo,
      leadCount: countsByPipelineStageKey.get(`${p.id}:${ps.stageId}`) ?? 0
    }))
  }))
}

export const getPipelineDetailsService = async (id, query, actor) => {
  const pipelineId = Number(id)
  if (!Number.isInteger(pipelineId) || pipelineId < 1) throw new BadRequestError("Invalid pipeline id")
  const options = buildLeadBoardQueryOptions(query)

  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    include: {
      stages: {
        orderBy: { orderNo: "asc" },
        include: { stage: true }
      }
    }
  })

  if (!pipeline || pipeline.isDeleted) throw new NotFoundError("Pipeline")
  assertPipelineScope(actor, pipeline)

  const stages = normalizePipelineStagesOrder(pipeline.stages).map(ps => ({
    id: ps.stage.id,
    name: ps.stage.name,
    isDefault: ps.stage.isDefault,
    orderNo: ps.orderNo,
    leads: []
  }))

  const leadWhere = {
    pipelineId: pipeline.id,
    isDeleted: false
  }

  if (options.stageId) leadWhere.stageId = options.stageId
  if (options.assignedToId) leadWhere.assignedToId = options.assignedToId
  if (options.search) {
    leadWhere.OR = [
      { name: { contains: options.search, mode: "insensitive" } },
      { mobile: { contains: options.search, mode: "insensitive" } },
      { interestedFor: { contains: options.search, mode: "insensitive" } }
    ]
  }
  if (!options.dateFilterSkipped && (options.dateFrom || options.dateTo)) {
    leadWhere.date = {
      ...(options.dateFrom ? { gte: options.dateFrom } : {}),
      ...(options.dateTo ? { lte: options.dateTo } : {})
    }
  }

  const leads = await prisma.lead.findMany({
    where: leadWhere,
    orderBy: { [options.sortBy]: options.sortOrder },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      ...leadStageLogInclude
    }
  })

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

  const assignableUsers = await getBranchUsersByBranchId(pipeline.branchId)

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

  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } })
  if (!pipeline || pipeline.isDeleted) throw new NotFoundError("Pipeline")
  assertPipelineScope(actor, pipeline)

  return prisma.pipeline.update({
    where: { id: pipelineId },
    data: { name, updatedById: actor.id }
  })
}

export const deletePipelineService = async (id, actor) => {
  const pipelineId = Number(id)
  if (!Number.isInteger(pipelineId) || pipelineId < 1) throw new BadRequestError("Invalid pipeline id")

  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } })
  if (!pipeline || pipeline.isDeleted) throw new NotFoundError("Pipeline")
  assertPipelineScope(actor, pipeline)

  return prisma.pipeline.update({
    where: { id: pipelineId },
    data: { isDeleted: true, updatedById: actor.id }
  })
}

export const assignStagesToPipelineService = async (pipelineId, data, actor) => {
  const pid = Number(pipelineId)
  if (!Number.isInteger(pid) || pid < 1) throw new BadRequestError("Invalid pipeline id")

  const pipeline = await prisma.pipeline.findUnique({ where: { id: pid } })
  if (!pipeline || pipeline.isDeleted) throw new NotFoundError("Pipeline")
  assertPipelineScope(actor, pipeline)

  const incomingStageIds = Array.isArray(data?.stageIds) ? data.stageIds.map(Number).filter(n => Number.isInteger(n) && n > 0) : []
  const newStages = Array.isArray(data?.newStages) ? data.newStages : []
  const orderedStageIds = Array.isArray(data?.orderedStageIds) ? data.orderedStageIds.map(Number).filter(n => Number.isInteger(n) && n > 0) : null

  return prisma.$transaction(async (tx) => {
    const { Prospect: prospect, Closure: closure } = await ensureDefaultStages(tx, actor.id)

    const createdStageIds = []
    for (const s of newStages) {
      const name = normalizeName(s?.name)
      if (!name) continue

      const existing = await tx.stage.findFirst({
        where: { name },
        select: { id: true, isDeleted: true }
      })

      if (existing) {
        if (existing.isDeleted) {
          await tx.stage.update({
            where: { id: existing.id },
            data: { isDeleted: false, updatedById: actor.id }
          })
        }
        createdStageIds.push(existing.id)
      } else {
        const created = await tx.stage.create({
          data: { name, isDefault: false, isDeleted: false, createdById: actor.id }
        })
        createdStageIds.push(created.id)
      }
    }

    const set = new Set([prospect.id, closure.id, ...incomingStageIds, ...createdStageIds])
    const finalStageIds = [...set]

    let ordered = finalStageIds
    if (orderedStageIds && orderedStageIds.length) {
      const orderedSet = new Set(orderedStageIds)
      const same =
        orderedStageIds.length === finalStageIds.length &&
        finalStageIds.every(id => orderedSet.has(id))

      if (!same) throw new BadRequestError("orderedStageIds must contain the same stage ids being assigned")
      if (orderedStageIds[0] !== prospect.id) throw new BadRequestError("Prospect stage must come first")
      if (orderedStageIds[orderedStageIds.length - 1] !== closure.id) throw new BadRequestError("Closure stage must come last")

      ordered = orderedStageIds
    } else {
      // default order: Prospect first, closure last, then other stages by name
      const stages = await tx.stage.findMany({ where: { id: { in: finalStageIds } }, select: { id: true, name: true } })
      const rest = stages
        .filter(s => s.id !== prospect.id && s.id !== closure.id)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(s => s.id)
      ordered = [prospect.id, ...rest, closure.id]
    }

    await tx.pipelineStage.deleteMany({ where: { pipelineId: pid } })
    await tx.pipelineStage.createMany({
      data: ordered.map((stageId, idx) => ({
        pipelineId: pid,
        stageId,
        orderNo: idx + 1
      }))
    })

    const mapping = await tx.pipelineStage.findMany({
      where: { pipelineId: pid },
      orderBy: { orderNo: "asc" },
      include: { stage: true }
    })

    return mapping.map(m => ({
      stageId: m.stageId,
      name: m.stage.name,
      isDefault: m.stage.isDefault,
      orderNo: m.orderNo
    }))
  })
}

export const updatePipelineStageOrderService = async (pipelineId, data, actor) => {
  const pid = Number(pipelineId)
  if (!Number.isInteger(pid) || pid < 1) throw new BadRequestError("Invalid pipeline id")

  const orderedStageIds = Array.isArray(data?.orderedStageIds) ? data.orderedStageIds.map(Number).filter(n => Number.isInteger(n) && n > 0) : []
  if (!orderedStageIds.length) throw new ValidationError("Validation failed", [{ field: "orderedStageIds", message: "orderedStageIds is required" }])

  const pipeline = await prisma.pipeline.findUnique({ where: { id: pid } })
  if (!pipeline || pipeline.isDeleted) throw new NotFoundError("Pipeline")
  assertPipelineScope(actor, pipeline)

  return prisma.$transaction(async (tx) => {
    const existing = await tx.pipelineStage.findMany({
      where: { pipelineId: pid },
      select: { stageId: true }
    })
    const existingIds = existing.map(e => e.stageId)
    const existingSet = new Set(existingIds)

    const orderedSet = new Set(orderedStageIds)
    const same =
      orderedStageIds.length === existingIds.length &&
      existingIds.every(id => orderedSet.has(id))
    if (!same) throw new BadRequestError("orderedStageIds must match existing pipeline stages")

    // Prospect must remain included; if not present, it's invalid
    const prospect = await tx.stage.findUnique({ where: { name: "Prospect" }, select: { id: true } })
    const closure = await tx.stage.findUnique({ where: { name: "Closure" }, select: { id: true } })
    if (prospect && !orderedSet.has(prospect.id)) throw new BadRequestError("Prospect stage must be included")
    if (closure && !orderedSet.has(closure.id)) throw new BadRequestError("Closure stage must be included")
    if (prospect && orderedStageIds[0] !== prospect.id) throw new BadRequestError("Prospect stage must come first")
    if (closure && orderedStageIds[orderedStageIds.length - 1] !== closure.id) throw new BadRequestError("Closure stage must come last")

    for (let i = 0; i < orderedStageIds.length; i++) {
      const stageId = orderedStageIds[i]
      if (!existingSet.has(stageId)) continue
      await tx.pipelineStage.update({
        where: { pipelineId_stageId: { pipelineId: pid, stageId } },
        data: { orderNo: i + 1 }
      })
    }

    const mapping = await tx.pipelineStage.findMany({
      where: { pipelineId: pid },
      orderBy: { orderNo: "asc" },
      include: { stage: true }
    })

    return mapping.map(m => ({
      stageId: m.stageId,
      name: m.stage.name,
      isDefault: m.stage.isDefault,
      orderNo: m.orderNo
    }))
  })
}

