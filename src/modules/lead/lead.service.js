import prisma from "../../config/db.js"
import { BadRequestError, NotFoundError, ValidationError } from "../../utils/AppError.js"

const normalize = (v) => String(v || "").trim()

const assertPipelineScope = (actor, pipeline) => {
  if (actor.companyId && pipeline.companyId !== actor.companyId) throw new BadRequestError("Invalid pipeline scope")
  if (actor.branchId && pipeline.branchId !== actor.branchId) throw new BadRequestError("Invalid pipeline scope")
}

export const createLeadService = async (data, actor) => {
  const name = normalize(data?.name)
  const mobile = normalize(data?.mobile)
  const interestedFor = data?.interested_for ?? data?.interestedFor
  const dateRaw = data?.date
  const pipelineId = Number(data?.pipelineId ?? data?.pipeline_id)

  const errors = []
  if (!name) errors.push({ field: "name", message: "name is required" })
  if (!mobile) errors.push({ field: "mobile", message: "mobile is required" })
  if (!Number.isInteger(pipelineId) || pipelineId < 1) errors.push({ field: "pipelineId", message: "pipelineId is required" })
  if (!dateRaw) errors.push({ field: "date", message: "date is required" })
  if (errors.length) throw new ValidationError("Validation failed", errors)

  const date = new Date(dateRaw)
  if (Number.isNaN(date.getTime())) throw new BadRequestError("Invalid date")

  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } })
  if (!pipeline || pipeline.isDeleted) throw new NotFoundError("Pipeline")
  assertPipelineScope(actor, pipeline)

  const prospectStage = await prisma.stage.findUnique({
    where: { name: "Prospect" },
    select: { id: true, isDeleted: true }
  })
  if (!prospectStage || prospectStage.isDeleted) throw new BadRequestError('Default stage "Prospect" is missing. Re-run server init.')

  const mapping = await prisma.pipelineStage.findUnique({
    where: { pipelineId_stageId: { pipelineId, stageId: prospectStage.id } },
    select: { id: true }
  })
  if (!mapping) throw new BadRequestError('Pipeline is missing required "Prospect" stage assignment')

  const lead = await prisma.lead.create({
    data: {
      pipelineId,
      stageId: prospectStage.id,
      name,
      mobile,
      date,
      interestedFor: interestedFor ? String(interestedFor).trim() : null,
      isDeleted: false,
      createdById: actor.id
    },
    include: {
      pipeline: { select: { id: true, name: true } },
      stage: { select: { id: true, name: true, isDefault: true } }
    }
  })

  return lead
}

export const getLeadsService = async (query, actor) => {
  const where = { isDeleted: false }

  // scope via pipeline relation
  if (actor.companyId) where.pipeline = { ...(where.pipeline || {}), companyId: actor.companyId }
  if (actor.branchId) where.pipeline = { ...(where.pipeline || {}), branchId: actor.branchId }

  if (query?.pipelineId) where.pipelineId = Number(query.pipelineId)
  if (query?.stageId) where.stageId = Number(query.stageId)

  const page = Number(query?.page || 1)
  const limit = Number(query?.limit || 20)
  const skip = (page - 1) * limit

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        pipeline: { select: { id: true, name: true } },
        stage: { select: { id: true, name: true, isDefault: true } }
      }
    }),
    prisma.lead.count({ where })
  ])

  return {
    leads,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  }
}

export const updateLeadStageService = async (leadId, data, actor) => {
  const id = Number(leadId)
  const stageId = Number(data?.stageId ?? data?.stage_id)

  const errors = []
  if (!Number.isInteger(id) || id < 1) errors.push({ field: "id", message: "Invalid lead id" })
  if (!Number.isInteger(stageId) || stageId < 1) errors.push({ field: "stageId", message: "stageId is required" })
  if (errors.length) throw new ValidationError("Validation failed", errors)

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { pipeline: true }
  })
  if (!lead || lead.isDeleted) throw new NotFoundError("Lead")
  assertPipelineScope(actor, lead.pipeline)

  const mapping = await prisma.pipelineStage.findUnique({
    where: { pipelineId_stageId: { pipelineId: lead.pipelineId, stageId } },
    select: { id: true }
  })
  if (!mapping) throw new BadRequestError("Stage is not assigned to this pipeline")

  return prisma.lead.update({
    where: { id },
    data: { stageId, updatedById: actor.id },
    include: {
      pipeline: { select: { id: true, name: true } },
      stage: { select: { id: true, name: true, isDefault: true } }
    }
  })
}

export const addLeadCommentService = async (leadId, data, actor) => {
  const id = Number(leadId)
  const comment = normalize(data?.comment)

  const errors = []
  if (!Number.isInteger(id) || id < 1) errors.push({ field: "leadId", message: "Invalid lead id" })
  if (!comment) errors.push({ field: "comment", message: "comment is required" })
  if (errors.length) throw new ValidationError("Validation failed", errors)

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { pipeline: true }
  })
  if (!lead || lead.isDeleted) throw new NotFoundError("Lead")
  assertPipelineScope(actor, lead.pipeline)

  return prisma.leadComment.create({
    data: {
      leadId: id,
      userId: actor.id,
      comment,
      isDeleted: false,
      createdById: actor.id
    },
    include: {
      user: { select: { id: true, name: true, email: true } }
    }
  })
}

export const getLeadCommentsService = async (leadId, actor) => {
  const id = Number(leadId)
  if (!Number.isInteger(id) || id < 1) throw new BadRequestError("Invalid lead id")

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { pipeline: true }
  })
  if (!lead || lead.isDeleted) throw new NotFoundError("Lead")
  assertPipelineScope(actor, lead.pipeline)

  return prisma.leadComment.findMany({
    where: { leadId: id, isDeleted: false },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true, email: true } }
    }
  })
}

