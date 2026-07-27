// src/modules/stage/stage.service.js

import prisma from "../../config/db.js"
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError
} from "../../utils/AppError.js"

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalizeName = (name) => String(name || "").trim()

/** System stage types that can never be disabled or have their type changed */
const SYSTEM_STAGE_TYPES = ["PROSPECT", "CLOSURE"]

// ─── GAP-3 FIX: normalizePipelineStagesOrder uses stageType, not name ─────────
// Receives an array of PipelineStage objects that include `.stage` relation
const normalizePipelineStagesOrder = (stages) => {
  if (!Array.isArray(stages)) return stages
  const prospect = stages.find(s => s.stage?.stageType === "PROSPECT")
  const closure  = stages.find(s => s.stage?.stageType === "CLOSURE")
  const middle   = stages.filter(
    s => s.stage?.stageType !== "PROSPECT" && s.stage?.stageType !== "CLOSURE"
  )
  const ordered = []
  if (prospect) ordered.push(prospect)
  ordered.push(...middle)
  if (closure) ordered.push(closure)
  return ordered
}

// ─── B1: createStageService ───────────────────────────────────────────────────

export const createStageService = async (data, actor) => {
  const name = normalizeName(data?.name)
  if (!name) throw new ValidationError("Validation failed", [{ field: "name", message: "name is required" }])

  const existing = await prisma.stage.findFirst({
    where: { name },
    select: { id: true, isDeleted: true }
  })

  if (existing && !existing.isDeleted) throw new ConflictError("Stage name already exists", "name")

  // Auto-derive code if not supplied: e.g. "Scholarship Review" -> "SCHOLARSHIP_REVIEW"
  let derivedCode = data.code?.toUpperCase() || name.toUpperCase().replace(/[^A-Z0-9]/g, "_").replace(/_+/g, "_").slice(0, 30);
  
  // Ensure derived code is unique if another stage has it
  const codeOccupied = await prisma.stage.findFirst({
    where: { code: derivedCode, id: existing ? { not: existing.id } : undefined }
  });
  if (codeOccupied) {
    derivedCode = `${derivedCode}_${Date.now().toString().slice(-4)}`;
  }

  // Auto-derive stageType if not supplied
  let derivedType = data.stageType || "REGULAR";
  if (!data.stageType) {
    const cleanUpper = name.trim().toUpperCase();
    if (cleanUpper === "WON" || cleanUpper === "CLOSED WON" || cleanUpper.startsWith("WON ")) derivedType = "WON";
    else if (cleanUpper === "LOST" || cleanUpper === "CLOSED LOST" || cleanUpper.startsWith("LOST ")) derivedType = "LOST";
  }

  // Soft-restore: bring back deleted stage and update ALL fields
  if (existing && existing.isDeleted) {
    return prisma.stage.update({
      where: { id: existing.id },
      data: {
        isDeleted:    false,
        name,
        code:         derivedCode,
        colorCode:    data.colorCode || "#3b82f6",
        displayOrder: data.displayOrder ?? 0,
        stageType:    derivedType,
        status:       "ACTIVE",
        updatedById:  actor.id
      }
    })
  }

  return prisma.stage.create({
    data: {
      name,
      code:         derivedCode,
      colorCode:    data.colorCode || "#3b82f6",
      displayOrder: data.displayOrder ?? 0,
      stageType:    derivedType,
      status:       "ACTIVE",
      isDefault:    false,
      isDeleted:    false,
      createdById:  actor.id
    }
  })
}

// ─── B2: getAllStagesService (public — ACTIVE only) ───────────────────────────

export const getAllStagesService = async () => {
  return prisma.stage.findMany({
    where: { isDeleted: false, status: "ACTIVE" },
    orderBy: [{ displayOrder: "asc" }, { isDefault: "desc" }, { name: "asc" }]
  })
}

// ─── B2: getAllStagesAdminService (admin — ACTIVE + INACTIVE, not deleted) ────

export const getAllStagesAdminService = async () => {
  return prisma.stage.findMany({
    where: { isDeleted: false },
    orderBy: [{ displayOrder: "asc" }, { isDefault: "desc" }, { name: "asc" }]
  })
}

// ─── B3: updateStageService ───────────────────────────────────────────────────

export const updateStageService = async (id, data, actor) => {
  const stageId = Number(id)
  if (!Number.isInteger(stageId) || stageId < 1) throw new BadRequestError("Invalid stage id")

  const stage = await prisma.stage.findUnique({ where: { id: stageId } })
  if (!stage || stage.isDeleted) throw new NotFoundError("Stage")

  // Build update payload — only include fields present in request
  const updateData = { updatedById: actor.id }

  if (data.name !== undefined) {
    const name = normalizeName(data.name)
    if (!name) throw new ValidationError("Validation failed", [{ field: "name", message: "name cannot be empty" }])

    // System stages (PROSPECT, CLOSURE) can be renamed, but the name check runs
    const duplicate = await prisma.stage.findFirst({
      where: { name, id: { not: stageId }, isDeleted: false },
      select: { id: true }
    })
    if (duplicate) throw new ConflictError("Stage name already exists", "name")

    updateData.name = name
  }

  if (data.code !== undefined) {
    updateData.code = data.code?.toUpperCase() || null
  }

  if (data.colorCode !== undefined) {
    updateData.colorCode = data.colorCode || null
  }

  if (data.displayOrder !== undefined) {
    updateData.displayOrder = data.displayOrder
  }

  if (data.stageType !== undefined) {
    // Cannot change stageType of a system stage
    if (SYSTEM_STAGE_TYPES.includes(stage.stageType)) {
      throw new ForbiddenError("System stage type (PROSPECT / CLOSURE) cannot be changed")
    }
    updateData.stageType = data.stageType
  }

  return prisma.stage.update({
    where: { id: stageId },
    data: updateData
  })
}

// ─── GAP-10 FIX + B4: deleteStageService ─────────────────────────────────────

export const deleteStageService = async (id, actor) => {
  const stageId = Number(id)
  if (!Number.isInteger(stageId) || stageId < 1) throw new BadRequestError("Invalid stage id")

  const stage = await prisma.stage.findUnique({ where: { id: stageId } })
  if (!stage || stage.isDeleted) throw new NotFoundError("Stage")

  // GAP-10: Guard by stageType first, then legacy isDefault check
  if (SYSTEM_STAGE_TYPES.includes(stage.stageType)) {
    throw new BadRequestError("System stages (Prospect / Closure) cannot be deleted")
  }
  if (stage.isDefault) throw new BadRequestError("Default stage cannot be deleted")

  const leadCount = await prisma.lead.count({
    where: { stageId, isDeleted: false }
  })
  if (leadCount > 0) {
    throw new BadRequestError(`Stage cannot be deleted: ${leadCount} active lead(s) are in this stage. Move them first.`)
  }

  return prisma.stage.update({
    where: { id: stageId },
    data: { isDeleted: true, updatedById: actor.id }
  })
}

// ─── B4: toggleStageStatusService (NEW) ──────────────────────────────────────

export const toggleStageStatusService = async (id, data, actor) => {
  const stageId = Number(id)
  if (!Number.isInteger(stageId) || stageId < 1) throw new BadRequestError("Invalid stage id")

  const stage = await prisma.stage.findUnique({ where: { id: stageId } })
  if (!stage || stage.isDeleted) throw new NotFoundError("Stage")

  // System stages cannot be disabled
  if (SYSTEM_STAGE_TYPES.includes(stage.stageType)) {
    throw new ForbiddenError("System stages (Prospect / Closure) cannot be disabled")
  }

  if (data.status === "INACTIVE") {
    const activeLeadCount = await prisma.lead.count({
      where: { stageId, isDeleted: false }
    })
    if (activeLeadCount > 0) {
      throw new BadRequestError(
        `Cannot disable stage "${stage.name}": ${activeLeadCount} active lead(s) are currently in this stage. Move them first.`
      )
    }

    const assignedPipelineCount = await prisma.pipelineStage.count({
      where: { stageId }
    })
    if (assignedPipelineCount > 0) {
      throw new BadRequestError(
        `Cannot disable stage "${stage.name}" because it is currently assigned to ${assignedPipelineCount} active pipeline(s). Remove it from the pipeline(s) first.`
      )
    }
  }

  const updated = await prisma.stage.update({
    where: { id: stageId },
    data: { status: data.status, updatedById: actor.id }
  })

  // Audit log
  await prisma.auditLog.create({
    data: {
      entityType:    "STAGE",
      entityId:      stageId,
      action:        data.status === "ACTIVE" ? "STAGE_ENABLED" : "STAGE_DISABLED",
      oldValue:      JSON.stringify({ status: stage.status }),
      newValue:      JSON.stringify({ status: data.status }),
      performedById: actor.id
    }
  })

  return updated
}

// ─── B5: getStagesForPipelineService — returns full stage metadata ─────────────

export const getStagesForPipelineService = async (pipelineId, actor) => {
  const pid = Number(pipelineId)
  if (!Number.isInteger(pid) || pid < 1) throw new BadRequestError("Invalid pipeline id")

  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pid },
    select: { id: true, branchId: true, companyId: true, isDeleted: true }
  })
  if (!pipeline || pipeline.isDeleted) throw new NotFoundError("Pipeline")

  // Tenant guard
  if (actor.companyId && pipeline.companyId !== actor.companyId) throw new BadRequestError("Invalid pipeline scope")
  if (actor.branchId  && pipeline.branchId  !== actor.branchId)  throw new BadRequestError("Invalid pipeline scope")

  const pipelineStages = await prisma.pipelineStage.findMany({
    where: { pipelineId: pid },
    orderBy: { orderNo: "asc" },
    include: { stage: true }
  })

  // GAP-3 FIX: normalizePipelineStagesOrder now uses stageType
  return normalizePipelineStagesOrder(pipelineStages).map(ps => ({
    id:           ps.stage.id,
    name:         ps.stage.name,
    isDefault:    ps.stage.isDefault,
    orderNo:      ps.orderNo,
    code:         ps.stage.code,
    colorCode:    ps.stage.colorCode,
    status:       ps.stage.status,
    stageType:    ps.stage.stageType,
    displayOrder: ps.stage.displayOrder
  }))
}
