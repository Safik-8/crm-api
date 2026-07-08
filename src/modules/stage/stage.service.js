import prisma from "../../config/db.js"
import { BadRequestError, ConflictError, NotFoundError, ValidationError } from "../../utils/AppError.js"

const normalizeName = (name) => String(name || "").trim()

export const createStageService = async (data, actor) => {
  const name = normalizeName(data?.name)
  if (!name) throw new ValidationError("Validation failed", [{ field: "name", message: "name is required" }])

  const existing = await prisma.stage.findFirst({
    where: { name },
    select: { id: true, isDeleted: true }
  })

  if (existing && !existing.isDeleted) throw new ConflictError("Stage name already exists", "name")

  if (existing && existing.isDeleted) {
    return prisma.stage.update({
      where: { id: existing.id },
      data: { isDeleted: false, updatedById: actor.id, name }
    })
  }

  return prisma.stage.create({
    data: {
      name,
      isDefault: false,
      isDeleted: false,
      createdById: actor.id
    }
  })
}

export const getAllStagesService = async () => {
  return prisma.stage.findMany({
    where: { isDeleted: false },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }]
  })
}

export const updateStageService = async (id, data, actor) => {
  const stageId = Number(id)
  if (!Number.isInteger(stageId) || stageId < 1) throw new BadRequestError("Invalid stage id")

  const name = normalizeName(data?.name)
  if (!name) throw new ValidationError("Validation failed", [{ field: "name", message: "name is required" }])

  const stage = await prisma.stage.findUnique({ where: { id: stageId } })
  if (!stage || stage.isDeleted) throw new NotFoundError("Stage")
  if (stage.isDefault) throw new BadRequestError("Default stage cannot be renamed")

  const duplicate = await prisma.stage.findFirst({
    where: { name, id: { not: stageId }, isDeleted: false },
    select: { id: true }
  })
  if (duplicate) throw new ConflictError("Stage name already exists", "name")

  return prisma.stage.update({
    where: { id: stageId },
    data: { name, updatedById: actor.id }
  })
}

export const deleteStageService = async (id, actor) => {
  const stageId = Number(id)
  if (!Number.isInteger(stageId) || stageId < 1) throw new BadRequestError("Invalid stage id")

  const stage = await prisma.stage.findUnique({ where: { id: stageId } })
  if (!stage || stage.isDeleted) throw new NotFoundError("Stage")
  if (stage.isDefault) throw new BadRequestError("Default stage cannot be deleted")

  const leadCount = await prisma.lead.count({
    where: { stageId, isDeleted: false }
  })
  if (leadCount > 0) {
    throw new BadRequestError("Stage cannot be deleted because it contains leads")
  }

  return prisma.stage.update({
    where: { id: stageId },
    data: { isDeleted: true, updatedById: actor.id }
  })
}

const normalizePipelineStagesOrder = (stages) => {
  if (!Array.isArray(stages)) return stages
  const prospect = stages.find(s => s.stage.name === "Prospect")
  const closure = stages.find(s => s.stage.name === "Closure")
  const middle = stages.filter(s => s.stage.name !== "Prospect" && s.stage.name !== "Closure")
  const ordered = []
  if (prospect) ordered.push(prospect)
  ordered.push(...middle)
  if (closure) ordered.push(closure)
  return ordered
}

export const getStagesForPipelineService = async (pipelineId, actor) => {
  const pid = Number(pipelineId)
  if (!Number.isInteger(pid) || pid < 1) throw new BadRequestError("Invalid pipeline id")

  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pid },
    select: { id: true, branchId: true, companyId: true, isDeleted: true }
  })
  if (!pipeline || pipeline.isDeleted) throw new NotFoundError("Pipeline")

  // tenant guard
  if (actor.companyId && pipeline.companyId !== actor.companyId) throw new BadRequestError("Invalid pipeline scope")
  if (actor.branchId && pipeline.branchId !== actor.branchId) throw new BadRequestError("Invalid pipeline scope")

  const pipelineStages = await prisma.pipelineStage.findMany({
    where: { pipelineId: pid },
    orderBy: { orderNo: "asc" },
    include: { stage: true }
  })

  return normalizePipelineStagesOrder(pipelineStages).map(ps => ({
    id: ps.stage.id,
    name: ps.stage.name,
    isDefault: ps.stage.isDefault,
    orderNo: ps.orderNo
  }))
}

