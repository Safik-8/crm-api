import prisma from "../../config/db.js"
import { BadRequestError, NotFoundError, ValidationError } from "../../utils/AppError.js"

const normalizeName = (name) => String(name || "").trim()

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

const ensureProspectStage = async (tx, actorId) => {
  const existing = await tx.stage.findFirst({
    where: { OR: [{ isDefault: true }, { name: "Prospect" }] }
  })
  if (existing) {
    if (existing.isDeleted) {
      return tx.stage.update({
        where: { id: existing.id },
        data: { isDeleted: false, isDefault: true, updatedById: actorId }
      })
    }
    if (!existing.isDefault) {
      return tx.stage.update({
        where: { id: existing.id },
        data: { isDefault: true, updatedById: actorId }
      })
    }
    return existing
  }

  return tx.stage.create({
    data: {
      name: "Prospect",
      isDefault: true,
      isDeleted: false,
      createdById: actorId
    }
  })
}

export const createPipelineService = async (data, actor) => {
  const name = normalizeName(data?.name)
  if (!name) throw new ValidationError("Validation failed", [{ field: "name", message: "name is required" }])

  const { companyId, branchId } = await resolveOrgContext(data, actor)

  // Rule: Every pipeline MUST have "Prospect" stage assigned.
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

    const prospect = await ensureProspectStage(tx, actor.id)

    await tx.pipelineStage.upsert({
      where: { pipelineId_stageId: { pipelineId: pipeline.id, stageId: prospect.id } },
      update: { orderNo: 1 },
      create: {
        pipelineId: pipeline.id,
        stageId: prospect.id,
        orderNo: 1
      }
    })

    return pipeline
  })
}

export const listPipelinesService = async (query, actor) => {
  const where = { isDeleted: false }

  if (actor.companyId) where.companyId = actor.companyId
  if (actor.branchId) where.branchId = actor.branchId

  if (!actor.branchId && query?.branchId) {
    where.branchId = Number(query.branchId)
  }

  return prisma.pipeline.findMany({
    where,
    orderBy: { createdAt: "desc" }
  })
}

export const getPipelineDetailsService = async (id, actor) => {
  const pipelineId = Number(id)
  if (!Number.isInteger(pipelineId) || pipelineId < 1) throw new BadRequestError("Invalid pipeline id")

  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    include: {
      stages: {
        orderBy: { orderNo: "asc" },
        include: { stage: true }
      },
      leads: {
        where: { isDeleted: false },
        orderBy: { createdAt: "desc" },
        include: { stage: true }
      }
    }
  })

  if (!pipeline || pipeline.isDeleted) throw new NotFoundError("Pipeline")
  assertPipelineScope(actor, pipeline)

  const stages = pipeline.stages.map(ps => ({
    id: ps.stage.id,
    name: ps.stage.name,
    isDefault: ps.stage.isDefault,
    orderNo: ps.orderNo
  }))

  return {
    id: pipeline.id,
    name: pipeline.name,
    branchId: pipeline.branchId,
    companyId: pipeline.companyId,
    createdAt: pipeline.createdAt,
    updatedAt: pipeline.updatedAt,
    stages,
    leads: pipeline.leads
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
    const prospect = await ensureProspectStage(tx, actor.id)

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

    const set = new Set([prospect.id, ...incomingStageIds, ...createdStageIds])
    const finalStageIds = [...set]

    let ordered = finalStageIds
    if (orderedStageIds && orderedStageIds.length) {
      const orderedSet = new Set(orderedStageIds)
      const same =
        orderedStageIds.length === finalStageIds.length &&
        finalStageIds.every(id => orderedSet.has(id))

      if (!same) throw new BadRequestError("orderedStageIds must contain the same stage ids being assigned")
      ordered = orderedStageIds
    } else {
      // default order: Prospect first, then rest by name
      const stages = await tx.stage.findMany({ where: { id: { in: finalStageIds } }, select: { id: true, name: true, isDefault: true } })
      const prospectId = prospect.id
      const rest = stages
        .filter(s => s.id !== prospectId)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(s => s.id)
      ordered = [prospectId, ...rest]
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
    const prospect = await tx.stage.findFirst({ where: { isDefault: true, isDeleted: false }, select: { id: true } })
    if (prospect && !orderedSet.has(prospect.id)) throw new BadRequestError("Prospect stage must be included")

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

