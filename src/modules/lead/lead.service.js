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


// ══════════════════════════════════════════════════════════════════
// BULK IMPORT LEADS FROM EXCEL
//
// Allowed columns (exactly these 5, no more, no less required ones):
//   Name* | Phone Number* | Date* | Interested At | Assign To
//
// Validation per row:
//   • Name        — required, text only, max 100 chars
//   • Phone Number— required, digits only (spaces/dashes stripped),
//                   must be 7–15 digits
//   • Date        — required, stored as UTC midnight (YYYY-MM-DD 00:00:00)
//   • Interested At — optional, text, max 200 chars
//   • Assign To   — optional, must match an active branch user's name
//
// ══════════════════════════════════════════════════════════════════
// BULK IMPORT LEADS FROM EXCEL  — ALL OR NOTHING
//
// Allowed columns (exactly these 5, no more, no less required ones):
//   Name* | Phone Number* | Date* | Interested At | Assign To
//
// Two-pass approach:
//   PASS 1 — Validate every row. Collect ALL errors across ALL rows.
//            If even one row fails → return all errors, insert NOTHING.
//   PASS 2 — Only runs when every row is valid. Insert all rows.
//
// Validation per row:
//   • Name        — required, text only, max 100 chars
//   • Phone Number— required, digits only (spaces/dashes stripped),
//                   7–15 digits, not already in DB, not duplicate in file
//   • Date        — required, stored as UTC midnight (YYYY-MM-DD 00:00:00)
//   • Interested At — optional, text, max 200 chars
//   • Assign To   — optional, must match an active branch user's name
// ══════════════════════════════════════════════════════════════════
export const importLeadsFromExcelService = async (fileBuffer, pipelineId, actor) => {
  if (!fileBuffer) throw new BadRequestError("No file provided")

  const pid = Number(pipelineId)
  if (!Number.isInteger(pid) || pid < 1) throw new BadRequestError("pipelineId is required")

  // ── 1. Parse Excel ─────────────────────────────────────────────
  let rows
  try {
    const workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    rows = XLSX.utils.sheet_to_json(sheet, { defval: "" })
  } catch {
    throw new BadRequestError("Failed to parse Excel file. Make sure it is a valid .xlsx / .xls file.")
  }

  if (!rows || rows.length === 0) throw new BadRequestError("Excel file is empty or has no data rows")

  // ── 2. Define allowed columns & their aliases ──────────────────
  // Each entry: { key, aliases, required }
  const ALLOWED_COLUMNS = [
    { key: "name",         aliases: ["name"],                                                              required: true  },
    { key: "mobile",       aliases: ["phone number", "phonenumber", "phone", "mobile"],                    required: true  },
    { key: "date",         aliases: ["date"],                                                              required: true  },
    { key: "interestedFor",aliases: ["interested at", "interestedat", "interested_at", "interested for", "interested in", "interestedin"],  required: false },
    { key: "assignTo",     aliases: ["assign to", "assignto", "assigned to", "assignedto"],                required: false }
  ]

  // Build a flat set of ALL known aliases (lowercased) for unknown-column detection
  const ALL_KNOWN_ALIASES = new Set(
    ALLOWED_COLUMNS.flatMap((c) => c.aliases)
  )

  const findCol = (rowKeys, aliases) => {
    const lower = rowKeys.map((k) => ({ orig: k, low: String(k).toLowerCase().trim() }))
    for (const alias of aliases) {
      const found = lower.find((k) => k.low === alias)
      if (found) return found.orig
    }
    return null
  }

  const sheetKeys = Object.keys(rows[0])

  // ── 3. Filter out empty/phantom columns xlsx adds for blank cells ──
  // xlsx names these __EMPTY, __EMPTY_1, __EMPTY_2 etc. when a cell has
  // no header. We silently ignore them instead of rejecting the file.
  const meaningfulKeys = sheetKeys.filter(
    (k) => !String(k).startsWith("__EMPTY") && String(k).trim() !== ""
  )

  // ── 4. Reject unknown / extra columns upfront ──────────────────
  const unknownCols = meaningfulKeys.filter(
    (k) => !ALL_KNOWN_ALIASES.has(String(k).toLowerCase().trim())
  )
  if (unknownCols.length > 0) {
    throw new BadRequestError(
      `Excel contains unknown column(s): "${unknownCols.join('", "')}". ` +
      `Allowed columns are: Name, Phone Number, Date, Interested At, Assign To.`
    )
  }

  // ── 5. Resolve column names from the sheet ─────────────────────
  const colName       = findCol(meaningfulKeys, ALLOWED_COLUMNS[0].aliases)
  const colMobile     = findCol(meaningfulKeys, ALLOWED_COLUMNS[1].aliases)
  const colDate       = findCol(meaningfulKeys, ALLOWED_COLUMNS[2].aliases)
  const colInterested = findCol(meaningfulKeys, ALLOWED_COLUMNS[3].aliases)
  const colAssignTo   = findCol(meaningfulKeys, ALLOWED_COLUMNS[4].aliases)

  // Required columns must be present
  if (!colName)   throw new BadRequestError('Excel is missing required column "Name"')
  if (!colMobile) throw new BadRequestError('Excel is missing required column "Phone Number"')
  if (!colDate)   throw new BadRequestError('Excel is missing required column "Date"')

  // ── 5. Validate actor has a branch — required for Assign To lookup ──
  // The logged-in user's branchId is the scope for all user lookups.
  // Without it we cannot safely validate "Assign To" names.
  if (!actor.branchId) {
    throw new BadRequestError("Your account is not associated with a branch. Cannot import leads.")
  }

  // Pre-fetch ALL active users in the logged-in user's branch from the DB.
  // This is the single source of truth — same branch scope as the form's
  // GET /leads/branch-users dropdown.
  const branchUsers = await prisma.user.findMany({
    where: {
      branchId: actor.branchId,   // strictly scoped to actor's branch
      status:   "ACTIVE"          // inactive users cannot be assigned
    },
    select: { id: true, name: true, email: true }
  })

  // Case-insensitive name → user lookup within the branch
  const findUserByName = (rawName) => {
    if (!rawName) return null
    const needle = String(rawName).toLowerCase().trim()
    return branchUsers.find((u) => u.name.toLowerCase().trim() === needle) ?? null
  }

  // ── 6. Helper: parse a date value from Excel into UTC midnight ──
  // Stores as YYYY-MM-DDT00:00:00.000Z so the DB always gets a clean date
  const parseExcelDate = (raw) => {
    // Case A: xlsx already parsed it as a JS Date (native Excel date cell)
    if (raw instanceof Date) {
      if (Number.isNaN(raw.getTime())) return null
      // Use the local date parts from the Excel cell (year/month/day)
      // and store as UTC midnight to avoid timezone shifts
      const y = raw.getFullYear()
      const m = String(raw.getMonth() + 1).padStart(2, "0")
      const d = String(raw.getDate()).padStart(2, "0")
      return new Date(`${y}-${m}-${d}T00:00:00.000Z`)
    }

    // Case B: string cell — try common formats
    const str = String(raw).trim()
    if (!str) return null

    // Try ISO: YYYY-MM-DD or YYYY/MM/DD
    let m1 = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
    if (m1) {
      const d = new Date(`${m1[1]}-${m1[2].padStart(2,"0")}-${m1[3].padStart(2,"0")}T00:00:00.000Z`)
      return Number.isNaN(d.getTime()) ? null : d
    }

    // Try DD-MM-YYYY or DD/MM/YYYY
    let m2 = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
    if (m2) {
      const d = new Date(`${m2[3]}-${m2[2].padStart(2,"0")}-${m2[1].padStart(2,"0")}T00:00:00.000Z`)
      return Number.isNaN(d.getTime()) ? null : d
    }

    // Try DD-MMM-YYYY  e.g. 15-May-2026
    let m3 = str.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{4})$/)
    if (m3) {
      const d = new Date(`${m3[1]} ${m3[2]} ${m3[3]}`)
      if (!Number.isNaN(d.getTime())) {
        const y = d.getFullYear()
        const mo = String(d.getMonth() + 1).padStart(2, "0")
        const dy = String(d.getDate()).padStart(2, "0")
        return new Date(`${y}-${mo}-${dy}T00:00:00.000Z`)
      }
    }

    return null
  }

  // ── 7. Pre-fetch existing mobile numbers from DB (same pipeline scope) ──
  // Prevents re-importing a number that is already stored as a lead.
  // Scoped to the actor's company+branch via the pipeline relation.
  const existingLeads = await prisma.lead.findMany({
    where: {
      isDeleted: false,
      pipeline: {
        ...(actor.companyId ? { companyId: actor.companyId } : {}),
        ...(actor.branchId  ? { branchId:  actor.branchId  } : {})
      }
    },
    select: { mobile: true }
  })
  // Store as a Set for O(1) lookup
  const existingMobiles = new Set(existingLeads.map((l) => l.mobile))

  // ── 8. PASS 1 — Validate ALL rows first, collect every error ──────
  // Nothing is written to the DB in this pass.
  // If even one row has an error, the entire import is aborted.
  const validatedRows = []   // rows that passed — ready to insert
  const validationErrors = [] // rows that failed — returned to frontend
  const seenInFile = new Set() // catch duplicate mobiles within the file

  for (let i = 0; i < rows.length; i++) {
    const row    = rows[i]
    const rowNum = i + 2  // row 1 = header → first data row = 2
    const rowErrors = []

    // ── Extract raw values ────────────────────────────────────
    const rawName       = normalize(row[colName])
    const rawDate       = row[colDate]
    const rawInterested = colInterested ? normalize(row[colInterested]) : ""
    const rawAssignTo   = colAssignTo   ? normalize(row[colAssignTo])   : ""

    // ── Validate Name ─────────────────────────────────────────
    if (!rawName) {
      rowErrors.push("Name is required")
    } else if (rawName.length > 100) {
      rowErrors.push("Name must be 100 characters or less")
    } else if (/\d/.test(rawName)) {
      rowErrors.push("Name must not contain numbers")
    }

    // ── Validate Phone Number ─────────────────────────────────
    // Excel often stores phone numbers as numeric cells.
    // Large numbers can come through as scientific notation (9.876543210e9)
    // or with decimal points (9876543210.0) — handle all cases.
    const rawMobileStr = (() => {
      const v = row[colMobile]
      if (v === "" || v === null || v === undefined) return ""
      // If it's a number (Excel numeric cell), convert without scientific notation
      if (typeof v === "number") {
        return Math.round(v).toString()
      }
      return String(v).trim()
    })()

    // Strip spaces, dashes, parentheses, plus signs
    const mobileClean = rawMobileStr.replace(/[\s\-().+]/g, "")

    if (!mobileClean) {
      rowErrors.push("Phone Number is required")
    } else if (!/^\d+$/.test(mobileClean)) {
      rowErrors.push(`Phone Number must contain digits only — got "${rawMobileStr}"`)
    } else if (mobileClean.length !== 10) {
      rowErrors.push(`Phone Number must be exactly 10 digits — got ${mobileClean.length} digit(s)`)
    } else if (/^(\d)\1{9}$/.test(mobileClean)) {
      // All same digit — e.g. 0000000000, 9999999999
      rowErrors.push(`Phone Number "${mobileClean}" is not valid — all digits are the same`)
    } else if (existingMobiles.has(mobileClean)) {
      rowErrors.push(`Phone Number "${mobileClean}" is already registered in the system`)
    } else if (seenInFile.has(mobileClean)) {
      rowErrors.push(`Phone Number "${mobileClean}" appears more than once in this Excel file`)
    } else {
      seenInFile.add(mobileClean)
    }

    // ── Validate Date ─────────────────────────────────────────
    let parsedDate = null
    if (!rawDate && rawDate !== 0) {
      rowErrors.push("Date is required")
    } else {
      parsedDate = parseExcelDate(rawDate)
      if (!parsedDate) {
        rowErrors.push(
          `Date "${rawDate}" is not a valid date. ` +
          `Use formats: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, or a native Excel date cell.`
        )
      }
    }

    // ── Validate Interested At (optional) ─────────────────────
    if (rawInterested && rawInterested.length > 200) {
      rowErrors.push("Interested At must be 200 characters or less")
    }

    // ── Validate Assign To (optional) ─────────────────────────
    let assignedToId = null
    if (rawAssignTo) {
      const matchedUser = findUserByName(rawAssignTo)
      if (!matchedUser) {
        rowErrors.push(
          `Assign To: "${rawAssignTo}" does not match any active user in your branch. ` +
          `Check the spelling — it must exactly match the user's name in the system.`
        )
      } else {
        assignedToId = matchedUser.id
      }
    }

    if (rowErrors.length > 0) {
      // Row failed — record errors, do NOT add to validatedRows
      validationErrors.push({
        row:    rowNum,
        data:   { name: rawName, mobile: rawMobileStr },
        errors: rowErrors
      })
    } else {
      // Row passed — store the cleaned payload for PASS 2
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
      })
    }
  }

  // ── If ANY row failed validation — abort entirely, insert nothing ──
  if (validationErrors.length > 0) {
    return {
      total:     rows.length,
      created:   0,
      skipped:   validationErrors.length,
      succeeded: [],
      failed:    validationErrors,
      message:   `Import aborted — ${validationErrors.length} row(s) have errors. Fix all errors and re-upload. No data was saved.`
    }
  }

  // ── 9. PASS 2 — All rows valid, insert all into DB ────────────
  const succeeded = []
  const insertErrors = []

  for (const { rowNum, payload } of validatedRows) {
    try {
      const lead = await createLeadService(payload, actor)
      succeeded.push({
        row:    rowNum,
        leadId: lead.id,
        name:   lead.name,
        mobile: lead.mobile,
        date:   lead.date
      })
    } catch (err) {
      const messages = err.errors
        ? err.errors.map((e) => e.message)
        : [err.message ?? "Unknown error"]
      insertErrors.push({
        row:    rowNum,
        data:   { name: payload.name, mobile: payload.mobile },
        errors: messages
      })
    }
  }

  return {
    total:     rows.length,
    created:   succeeded.length,
    skipped:   insertErrors.length,
    succeeded,
    failed:    insertErrors
  }
}
