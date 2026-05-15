import * as XLSX from "xlsx"
import prisma from "../../config/db.js"
import { BadRequestError, ForbiddenError, NotFoundError, ValidationError } from "../../utils/AppError.js"

const normalize = (v) => String(v || "").trim()

const assertPipelineScope = (actor, pipeline) => {
  if (actor.companyId && pipeline.companyId !== actor.companyId) throw new BadRequestError("Invalid pipeline scope")
  if (actor.branchId && pipeline.branchId !== actor.branchId) throw new BadRequestError("Invalid pipeline scope")
}

// ══════════════════════════════════════
// GET BRANCH USERS — for "Assign To" dropdown
// Returns all active users in the actor's branch
// ══════════════════════════════════════
export const getBranchUsersForLeadService = async (actor) => {
  if (!actor.branchId) throw new BadRequestError("No branch associated with your account")

  const users = await prisma.user.findMany({
    where: {
      branchId: actor.branchId,
      status: "ACTIVE"
    },
    select: {
      id: true,
      name: true,
      email: true,
      userRoles: {
        where: { isPrimary: true },
        select: { role: { select: { name: true } } }
      }
    },
    orderBy: { name: "asc" }
  })

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.userRoles[0]?.role?.name ?? null
  }))
}

export const createLeadService = async (data, actor) => {
  const name = normalize(data?.name)
  const mobile = normalize(data?.mobile)
  const interestedFor = data?.interested_for ?? data?.interestedFor
  const dateRaw = data?.date
  const pipelineId = Number(data?.pipelineId ?? data?.pipeline_id)
  const assignedToId = data?.assignedToId ?? data?.assigned_to
    ? Number(data?.assignedToId ?? data?.assigned_to)
    : null

  const errors = []
  if (!name) errors.push({ field: "name", message: "name is required" })
  if (!mobile) errors.push({ field: "mobile", message: "mobile is required" })
  if (!Number.isInteger(pipelineId) || pipelineId < 1) errors.push({ field: "pipelineId", message: "pipelineId is required" })
  if (!dateRaw) errors.push({ field: "date", message: "date is required" })
  if (assignedToId !== null && (!Number.isInteger(assignedToId) || assignedToId < 1)) {
    errors.push({ field: "assignedToId", message: "assignedToId must be a valid user id" })
  }
  if (errors.length) throw new ValidationError("Validation failed", errors)

  const date = new Date(dateRaw)
  if (Number.isNaN(date.getTime())) throw new BadRequestError("Invalid date")

  const pipeline = await prisma.pipeline.findUnique({ where: { id: pipelineId } })
  if (!pipeline || pipeline.isDeleted) throw new NotFoundError("Pipeline")
  assertPipelineScope(actor, pipeline)

  // Validate assignedTo user belongs to the same branch
  if (assignedToId !== null) {
    const assignedUser = await prisma.user.findUnique({
      where: { id: assignedToId },
      select: { id: true, branchId: true, status: true }
    })
    if (!assignedUser) throw new NotFoundError("Assigned user")
    if (assignedUser.status !== "ACTIVE") throw new BadRequestError("Assigned user is inactive")
    if (actor.branchId && assignedUser.branchId !== actor.branchId) {
      throw new ForbiddenError("Assigned user does not belong to your branch")
    }
  }

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
      assignedToId,
      name,
      mobile,
      date,
      interestedFor: interestedFor ? String(interestedFor).trim() : null,
      isDeleted: false,
      createdById: actor.id
    },
    include: {
      pipeline: { select: { id: true, name: true } },
      stage: { select: { id: true, name: true, isDefault: true } },
      assignedTo: { select: { id: true, name: true, email: true } }
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
        stage: { select: { id: true, name: true, isDefault: true } },
        assignedTo: { select: { id: true, name: true, email: true } }
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


// ══════════════════════════════════════
// BULK IMPORT LEADS FROM EXCEL
// Each row is converted into the exact same payload shape as the
// single-lead form and passed through createLeadService — so every
// validation rule, scope check, and DB write is 100% identical.
//
// Expected columns (case-insensitive):
//   name | phone number | date | interested at | assign to
// ══════════════════════════════════════
export const importLeadsFromExcelService = async (fileBuffer, pipelineId, actor) => {
  if (!fileBuffer) throw new BadRequestError("No file provided")

  const pid = Number(pipelineId)
  if (!Number.isInteger(pid) || pid < 1) throw new BadRequestError("pipelineId is required")

  // ── 1. Parse Excel ────────────────────────────────────────
  let rows
  try {
    const workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    rows = XLSX.utils.sheet_to_json(sheet, { defval: "" })
  } catch {
    throw new BadRequestError("Failed to parse Excel file. Make sure it is a valid .xlsx / .xls file.")
  }

  if (!rows || rows.length === 0) throw new BadRequestError("Excel file is empty or has no data rows")

  // ── 2. Map flexible column headers to fixed field names ───
  const HEADER_MAP = {
    name:         ["name"],
    mobile:       ["phone number", "phonenumber", "phone", "mobile"],
    date:         ["date"],
    interestedFor:["interested at", "interestedat", "interested_at", "interested for"],
    assignTo:     ["assign to", "assignto", "assigned to", "assignedto"]
  }

  const findCol = (rowKeys, aliases) => {
    const lower = rowKeys.map((k) => ({ orig: k, low: String(k).toLowerCase().trim() }))
    for (const alias of aliases) {
      const found = lower.find((k) => k.low === alias)
      if (found) return found.orig
    }
    return null
  }

  const sampleKeys = Object.keys(rows[0])
  const colName       = findCol(sampleKeys, HEADER_MAP.name)
  const colMobile     = findCol(sampleKeys, HEADER_MAP.mobile)
  const colDate       = findCol(sampleKeys, HEADER_MAP.date)
  const colInterested = findCol(sampleKeys, HEADER_MAP.interestedFor)
  const colAssignTo   = findCol(sampleKeys, HEADER_MAP.assignTo)

  if (!colName)   throw new BadRequestError('Excel is missing required column "Name"')
  if (!colMobile) throw new BadRequestError('Excel is missing required column "Phone Number"')
  if (!colDate)   throw new BadRequestError('Excel is missing required column "Date"')

  // ── 3. Pre-fetch branch users once for "Assign To" name → id lookup ──
  // The name in the Excel cell is resolved to a userId here, then passed
  // into createLeadService as assignedToId — same as the form does.
  const branchUsers = actor.branchId
    ? await prisma.user.findMany({
        where: { branchId: actor.branchId, status: "ACTIVE" },
        select: { id: true, name: true }
      })
    : []

  const findUserByName = (rawName) => {
    if (!rawName) return null
    const needle = String(rawName).toLowerCase().trim()
    return branchUsers.find((u) => u.name.toLowerCase().trim() === needle) ?? null
  }

  // ── 4. Process each row through createLeadService ─────────
  const succeeded = []
  const failed    = []

  for (let i = 0; i < rows.length; i++) {
    const row    = rows[i]
    const rowNum = i + 2 // row 1 = header, so first data row = 2

    const rawName       = normalize(row[colName])
    const rawMobile     = normalize(row[colMobile])
    const rawDate       = row[colDate]
    const rawInterested = colInterested ? normalize(row[colInterested]) : ""
    const rawAssignTo   = colAssignTo   ? normalize(row[colAssignTo])   : ""

    // ── Resolve "Assign To" name → user id before calling service ──
    // The form sends assignedToId (a number). We do the same here.
    let assignedToId = null
    if (rawAssignTo) {
      const user = findUserByName(rawAssignTo)
      if (!user) {
        failed.push({
          row: rowNum,
          data: { name: rawName, mobile: rawMobile },
          errors: [`user "${rawAssignTo}" not found in branch`]
        })
        continue
      }
      assignedToId = user.id
    }

    // ── Normalise date: xlsx gives a JS Date for native date cells;
    //    string cells need to be converted to ISO so new Date() parses them.
    let dateValue = rawDate
    if (rawDate instanceof Date) {
      // Already a proper JS Date from xlsx — convert to ISO string so
      // createLeadService receives the same format as the form
      dateValue = rawDate.toISOString()
    }

    // ── Build the exact same payload the form POSTs ────────────────
    const payload = {
      pipelineId:    pid,
      name:          rawName,
      mobile:        rawMobile,
      date:          dateValue,
      interestedFor: rawInterested || undefined,
      assignedToId:  assignedToId  // null = unassigned, same as form
    }

    // ── Delegate to createLeadService — identical path as single create ──
    try {
      const lead = await createLeadService(payload, actor)
      succeeded.push({
        row:    rowNum,
        leadId: lead.id,
        name:   lead.name,
        mobile: lead.mobile
      })
    } catch (err) {
      // Collect validation / business-rule errors per row without aborting the whole import
      const messages = err.errors
        ? err.errors.map((e) => e.message)   // ValidationError array
        : [err.message ?? "Unknown error"]
      failed.push({
        row:    rowNum,
        data:   { name: rawName, mobile: rawMobile },
        errors: messages
      })
    }
  }

  return {
    total:     rows.length,
    created:   succeeded.length,
    skipped:   failed.length,
    succeeded,
    failed
  }
}
