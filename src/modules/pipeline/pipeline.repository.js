import prisma from "../../config/db.js"
import { getBranchUsersByBranchId, leadStageLogInclude } from "../lead/lead.repository.js"

const SYSTEM_STAGE_DEFS = [
  { name: "Prospect", stageType: "PROSPECT", colorCode: "#3b82f6", code: "PROSPECT" },
  { name: "Closure",  stageType: "CLOSURE",  colorCode: "#8b5cf6", code: "CLOSURE"  }
]

export const findBranchByCompanyAndId = async (branchId, companyId = null) => {
  const where = { id: branchId }
  if (companyId) where.companyId = companyId
  return prisma.branch.findFirst({
    where,
    select: { id: true, companyId: true }
  })
}

export const findPipelineById = async (id) => {
  return prisma.pipeline.findUnique({
    where: { id: Number(id) }
  })
}

export const findPipelinesByWhere = async (where) => {
  return prisma.pipeline.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      stages: {
        where: { stage: { isDeleted: false } },
        orderBy: { orderNo: "asc" },
        include: { stage: true }
      },
      _count: {
        select: {
          leads: {
            where: { isDeleted: false }
          }
        }
      }
    }
  })
}

export const findPipelineWithStages = async (id) => {
  return prisma.pipeline.findFirst({
    where: { id: Number(id), isDeleted: false },
    include: {
      stages: {
        where: { stage: { isDeleted: false } },
        orderBy: { orderNo: "asc" },
        include: { stage: true }
      }
    }
  })
}

export const findLeadsForBoard = async (leadWhere, sortBy, sortOrder) => {
  return prisma.lead.findMany({
    where: leadWhere,
    orderBy: { [sortBy]: sortOrder },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      course: { select: { id: true, name: true } },
      opportunities: { select: { id: true }, where: { isDeleted: false } },
      qualification: true,
      ...leadStageLogInclude
    }
  })
}

export const fetchBranchUsers = async (branchId) => {
  return getBranchUsersByBranchId(branchId)
}

export const ensureDefaultStages = async (tx, actorId) => {
  const stages = {}

  for (const def of SYSTEM_STAGE_DEFS) {
    let stage = await tx.stage.findFirst({
      where: { stageType: def.stageType, isDeleted: false },
      select: { id: true, isDefault: true, isDeleted: true, status: true }
    })

    if (!stage) {
      stage = await tx.stage.findUnique({
        where: { name: def.name },
        select: { id: true, isDefault: true, isDeleted: true, status: true }
      })
    }

    if (stage) {
      stage = await tx.stage.update({
        where: { id: stage.id },
        data: {
          isDeleted: false,
          isDefault: true,
          stageType: def.stageType,
          colorCode: stage.colorCode || def.colorCode,
          code: stage.code || def.code,
          status: "ACTIVE",
          updatedById: actorId
        }
      })
    } else {
      stage = await tx.stage.create({
        data: {
          name: def.name,
          stageType: def.stageType,
          colorCode: def.colorCode,
          code: def.code,
          status: "ACTIVE",
          isDefault: true,
          isDeleted: false,
          createdById: actorId
        }
      })
    }

    stages[def.name] = stage
  }

  return stages
}

export const createPipelineTx = async (name, companyId, branchId, actorId) => {
  return prisma.$transaction(async (tx) => {
    const pipeline = await tx.pipeline.create({
      data: {
        name,
        companyId,
        branchId,
        isDeleted: false,
        createdById: actorId
      }
    })

    const { Prospect: prospect, Closure: closure } = await ensureDefaultStages(tx, actorId)

    await tx.pipelineStage.createMany({
      data: [
        { pipelineId: pipeline.id, stageId: prospect.id, orderNo: 1 },
        { pipelineId: pipeline.id, stageId: closure.id, orderNo: 2 }
      ]
    })

    return pipeline
  })
}

export const updatePipelineDb = async (id, name, actorId) => {
  return prisma.pipeline.update({
    where: { id: Number(id) },
    data: { name, updatedById: actorId }
  })
}

export const softDeletePipelineDb = async (id, actorId) => {
  return prisma.pipeline.update({
    where: { id: Number(id) },
    data: { isDeleted: true, updatedById: actorId }
  })
}

export const assignStagesToPipelineTx = async (pipelineId, incomingStageIds, newStages, orderedStageIds, actorId) => {
  return prisma.$transaction(async (tx) => {
    const { Prospect: prospect, Closure: closure } = await ensureDefaultStages(tx, actorId)

    const createdStageIds = []
    for (const s of newStages) {
      const name = String(s?.name || "").trim()
      if (!name) continue

      const existing = await tx.stage.findFirst({
        where: { name },
        select: { id: true, isDeleted: true }
      })

      if (existing) {
        if (existing.isDeleted) {
          await tx.stage.update({
            where: { id: existing.id },
            data: { isDeleted: false, updatedById: actorId }
          })
        }
        createdStageIds.push(existing.id)
      } else {
        const created = await tx.stage.create({
          data: { name, isDefault: false, isDeleted: false, createdById: actorId }
        })
        createdStageIds.push(created.id)
      }
    }

    const mergedStageIds = Array.from(new Set([prospect.id, ...incomingStageIds, ...createdStageIds, closure.id]))

    const existingCustomStages = await tx.stage.findMany({
      where: { id: { in: mergedStageIds }, isDeleted: false },
      select: { id: true, stageType: true }
    })

    const customMiddleStages = existingCustomStages.filter(
      s => s.stageType !== "PROSPECT" && s.stageType !== "CLOSURE"
    )

    let finalOrderedStageIds = []

    if (Array.isArray(orderedStageIds) && orderedStageIds.length > 0) {
      const providedIdsSet = new Set(orderedStageIds)
      const validMiddleIds = customMiddleStages.map(s => s.id).filter(id => providedIdsSet.has(id))
      finalOrderedStageIds = [prospect.id, ...validMiddleIds, closure.id]
    } else {
      finalOrderedStageIds = [prospect.id, ...customMiddleStages.map(s => s.id), closure.id]
    }

    await tx.pipelineStage.deleteMany({
      where: { pipelineId: Number(pipelineId) }
    })

    await tx.pipelineStage.createMany({
      data: finalOrderedStageIds.map((stageId, index) => ({
        pipelineId: Number(pipelineId),
        stageId,
        orderNo: index + 1
      }))
    })

    return tx.pipelineStage.findMany({
      where: { pipelineId: Number(pipelineId) },
      orderBy: { orderNo: "asc" },
      include: { stage: true }
    })
  })
}

export const updatePipelineStageOrderTx = async (pipelineId, orderedStageIds, actorId) => {
  return prisma.$transaction(async (tx) => {
    const { Prospect: prospect, Closure: closure } = await ensureDefaultStages(tx, actorId)

    const existingAssignments = await tx.pipelineStage.findMany({
      where: { pipelineId: Number(pipelineId) },
      include: { stage: true }
    })

    const assignableStageIdsSet = new Set(existingAssignments.map(ps => ps.stageId))

    const validRequestedMiddleStageIds = orderedStageIds.filter(id => {
      if (id === prospect.id || id === closure.id) return false
      return assignableStageIdsSet.has(id)
    })

    const finalOrderedStageIds = [prospect.id, ...validRequestedMiddleStageIds, closure.id]

    await tx.pipelineStage.deleteMany({
      where: { pipelineId: Number(pipelineId) }
    })

    return tx.pipelineStage.findMany({
      where: { pipelineId: Number(pipelineId) },
      orderBy: { orderNo: "asc" },
      include: { stage: true }
    })
  })
}

export const createAuditLog = async (data, tx = prisma) => {
  return tx.auditLog.create({
    data: {
      companyId: data.companyId ?? null,
      entityType: "PIPELINE",
      entityId: data.entityId,
      action: data.action,
      oldValue: data.oldValue ?? null,
      newValue: data.details ?? data.newValue ?? null,
      performedById: data.performedBy || data.performedById
    }
  })
}
