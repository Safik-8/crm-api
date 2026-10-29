import prisma from "../../config/db.js"
import { getBranchUsersByBranchId, leadStageLogInclude } from "../lead/lead.repository.js"
import { ValidationError } from "../../utils/AppError.js"

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

/**
 * Enterprise Differential Sync for Pipeline Stages:
 * 1. Active Lead Protection Guard: Prevents de-assigning stages containing active leads.
 * 2. Prunes removed stages atomically.
 * 3. Creates newly assigned stages.
 * 4. Updates orderNo in-place for existing stages without table/ID churn.
 */
const syncPipelineStagesDifferentialTx = async (tx, pipelineId, finalOrderedStageIds) => {
  const pid = Number(pipelineId)

  // 1. Fetch current assignments
  const currentAssignments = await tx.pipelineStage.findMany({
    where: { pipelineId: pid },
    select: { id: true, stageId: true, orderNo: true }
  })
  const currentMap = new Map(currentAssignments.map(a => [a.stageId, a]))
  const targetStageIdsSet = new Set(finalOrderedStageIds)

  // 2. Identify stages to remove
  const stagesToRemove = currentAssignments.filter(a => !targetStageIdsSet.has(a.stageId))
  if (stagesToRemove.length > 0) {
    const removedStageIds = stagesToRemove.map(s => s.stageId)
    // Active Lead Protection Guard: Block removal if active leads exist in these stages
    const activeLeadsCount = await tx.lead.count({
      where: {
        pipelineId: pid,
        stageId: { in: removedStageIds },
        isDeleted: false
      }
    })
    if (activeLeadsCount > 0) {
      const affectedStages = await tx.stage.findMany({
        where: { id: { in: removedStageIds } },
        select: { name: true }
      })
      const stageNames = affectedStages.map(s => `"${s.name}"`).join(', ')
      throw new ValidationError(
        `Cannot remove stage(s) ${stageNames} from this pipeline because ${activeLeadsCount} active lead(s) are currently assigned. Please move or reassign the leads first.`
      )
    }

    await tx.pipelineStage.deleteMany({
      where: {
        pipelineId: pid,
        stageId: { in: removedStageIds }
      }
    })
  }

  // 3. Target order mapping (1-indexed sequence)
  const targetOrders = finalOrderedStageIds.map((stageId, index) => ({
    stageId,
    orderNo: index + 1
  }))

  // 4. Create newly assigned stages
  const stagesToCreate = targetOrders.filter(t => !currentMap.has(t.stageId))
  if (stagesToCreate.length > 0) {
    await tx.pipelineStage.createMany({
      data: stagesToCreate.map(t => ({
        pipelineId: pid,
        stageId: t.stageId,
        orderNo: t.orderNo
      }))
    })
  }

  // 5. In-place update of orderNo for existing stages whose order changed
  const stagesToUpdate = targetOrders.filter(t => {
    const existing = currentMap.get(t.stageId)
    return existing && existing.orderNo !== t.orderNo
  })

  for (const t of stagesToUpdate) {
    await tx.pipelineStage.update({
      where: {
        pipelineId_stageId: {
          pipelineId: pid,
          stageId: t.stageId
        }
      },
      data: { orderNo: t.orderNo }
    })
  }

  // 6. Return fresh assignments ordered by orderNo
  return tx.pipelineStage.findMany({
    where: { pipelineId: pid },
    orderBy: { orderNo: "asc" },
    include: { stage: true }
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

    // Determine the caller's requested order sequence
    const preferredOrder = (Array.isArray(orderedStageIds) && orderedStageIds.length > 0)
      ? orderedStageIds
      : (Array.isArray(incomingStageIds) ? incomingStageIds : [])

    const candidateIds = Array.from(new Set([
      prospect.id,
      ...preferredOrder,
      ...incomingStageIds,
      ...createdStageIds,
      closure.id
    ]))

    const existingStages = await tx.stage.findMany({
      where: { id: { in: candidateIds }, isDeleted: false },
      select: { id: true, stageType: true }
    })

    const customMiddleStageIdsSet = new Set(
      existingStages
        .filter(s => s.stageType !== "PROSPECT" && s.stageType !== "CLOSURE")
        .map(s => s.id)
    )

    // Build the ordered middle stage list:
    // 1. Maintain exact sequence from preferredOrder
    const orderedMiddleIds = preferredOrder.filter(id => customMiddleStageIdsSet.has(id))

    // 2. Append any newly created stages or valid middle stages not in preferredOrder
    const includedMiddleSet = new Set(orderedMiddleIds)
    const extraMiddleIds = [
      ...createdStageIds.filter(id => customMiddleStageIdsSet.has(id)),
      ...incomingStageIds.filter(id => customMiddleStageIdsSet.has(id))
    ].filter(id => !includedMiddleSet.has(id))

    // 3. Strict anchor enforcement: [Prospect, ...middleStages, Closure]
    const finalOrderedStageIds = Array.from(new Set([
      prospect.id,
      ...orderedMiddleIds,
      ...extraMiddleIds,
      closure.id
    ]))

    return syncPipelineStagesDifferentialTx(tx, pipelineId, finalOrderedStageIds)
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

    // Include any existing middle stages that weren't explicitly provided
    const requestedSet = new Set(validRequestedMiddleStageIds)
    const existingMiddleIds = existingAssignments
      .filter(ps => ps.stageId !== prospect.id && ps.stageId !== closure.id)
      .map(ps => ps.stageId)
      .filter(id => !requestedSet.has(id))

    const finalOrderedStageIds = Array.from(new Set([
      prospect.id,
      ...validRequestedMiddleStageIds,
      ...existingMiddleIds,
      closure.id
    ]))

    return syncPipelineStagesDifferentialTx(tx, pipelineId, finalOrderedStageIds)
  })
}

import { recordAuditLog } from "../auditLog/auditLog.service.js";

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

  return recordAuditLog({
    req: reqObj,
    tx,
    companyId: data?.companyId ?? null,
    moduleName: "PIPELINE",
    entityType: data?.entityType || "PIPELINE",
    entityId: data?.entityId,
    actionType,
    action: actionCode,
    oldValue: data?.oldValue ?? null,
    newValue: data?.details ?? data?.newValue ?? null,
    performedById: data?.performedBy || data?.performedById || null,
  });
};
