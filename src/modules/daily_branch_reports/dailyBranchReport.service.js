import prisma from "../../config/db.js"
import { BadRequestError, ConflictError, ValidationError } from "../../utils/AppError.js"

// ══════════════════════════════════════════════════════════════════
// DASHBOARD — GET REPORTS  (auto-computed from leads table)
//
// 5 metrics derived from current stage name on leads:
//   1. Total Call Done        → stage.name = "Call Done"
//   2. Total Counselling Done → stage.name = "Counselling Done"
//   3. Total Follow Up Taken  → stage.name = "Follow Up"
//   4. Total Qualified Leads  → stage.name = "Hot Lead"
//   5. Total Closure Done     → stage.name = "Closure"
//
// Scoped to the authenticated user's branch via pipeline.branchId.
// Date range: today by default, or ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// All metrics default to 0 when no data exists.
// ══════════════════════════════════════════════════════════════════

// Stage name → dashboard card label mapping (dynamic lookup)
const DASHBOARD_STAGE_MAP = [
  { key: "totalCallDone",         stageName: "Call Done"         },
  { key: "totalCounsellingDone",  stageName: "Counselling Done"  },
  { key: "totalFollowUpTaken",    stageName: "Follow Up"         },
  { key: "totalQualifiedLeads",   stageName: "Hot Lead"          },
  { key: "totalClosureDone",      stageName: "Closure"           },
]

export const getDashboardReportsService = async (query, user) => {
  const branchId = Number(user?.branchId)
  if (!Number.isInteger(branchId) || branchId < 1) throw new BadRequestError("Branch is required")

  // ── Date range ────────────────────────────────────────────────
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  let startDate = todayStart
  let endDate   = todayEnd

  if (query?.startDate) {
    const d = new Date(query.startDate)
    if (Number.isNaN(d.getTime())) throw new BadRequestError("Invalid startDate. Use YYYY-MM-DD format.")
    d.setHours(0, 0, 0, 0)
    startDate = d
  }
  if (query?.endDate) {
    const d = new Date(query.endDate)
    if (Number.isNaN(d.getTime())) throw new BadRequestError("Invalid endDate. Use YYYY-MM-DD format.")
    d.setHours(23, 59, 59, 999)
    endDate = d
  }

  if (startDate > endDate) throw new BadRequestError("startDate cannot be after endDate")

  // ── Dynamically resolve stage IDs by name ─────────────────────
  // We look up by name so it works regardless of which stages exist.
  const stageNames = DASHBOARD_STAGE_MAP.map(m => m.stageName)
  const stages = await prisma.stage.findMany({
    where: { name: { in: stageNames }, isDeleted: false },
    select: { id: true, name: true }
  })
  const stageIdByName = new Map(stages.map(s => [s.name, s.id]))

  // ── Base lead filter: branch scope + date range (stageChangedAt) ─
  // We use stageChangedAt so the count reflects when the lead
  // actually moved into that stage within the selected date range.
  const baseLeadWhere = {
    isDeleted: false,
    pipeline: { branchId },
    stageChangedAt: { gte: startDate, lte: endDate }
  }

  // ── Count leads per stage in parallel ────────────────────────
  const counts = await Promise.all(
    DASHBOARD_STAGE_MAP.map(async ({ key, stageName }) => {
      const stageId = stageIdByName.get(stageName)
      if (!stageId) return { key, stageName, count: 0, stageExists: false }

      const count = await prisma.lead.count({
        where: { ...baseLeadWhere, stageId }
      })
      return { key, stageName, count, stageExists: true }
    })
  )

  // ── Build response cards ──────────────────────────────────────
  const cards = counts.map(({ key, stageName, count, stageExists }) => ({
    key,
    label: LABEL_MAP[key],
    stageName,
    stageExists,
    count
  }))

  const totalLeadsInRange = cards.reduce((sum, c) => sum + c.count, 0)

  return {
    range: {
      startDate: startDate.toISOString(),
      endDate:   endDate.toISOString(),
      isDefault: !query?.startDate && !query?.endDate
    },
    branchId,
    totalLeadsInRange,
    cards
  }
}

// Human-readable labels for each key
const LABEL_MAP = {
  totalCallDone:        "Total Call Done",
  totalCounsellingDone: "Total Counselling Done",
  totalFollowUpTaken:   "Total Follow Up Taken",
  totalQualifiedLeads:  "Total Qualified Leads (Hot Lead)",
  totalClosureDone:     "Total Closure Done",
}


export const submitDailyBranchReportService = async (data, user) => {
  const { reportDate, callsReceived, qualifiedLeads, counsellingDone, counsellingBooked, officeVisits, closures, followupsDone, pendingFollowups } = data;

  const branchId = Number(user?.branchId)
  if (!Number.isInteger(branchId) || branchId < 1) throw new BadRequestError("Branch is required")

  const parseReportDateToUtcMidnight = (value) => {
    if (!value) return null
    if (value instanceof Date) {
      const d = new Date(value.getTime())
      d.setUTCHours(0, 0, 0, 0)
      return d
    }
    const s = String(value).trim()
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
    if (!m) return null
    const year = Number(m[1])
    const month = Number(m[2])
    const day = Number(m[3])
    const d = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
    if (Number.isNaN(d.getTime())) return null
    if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null
    return d
  }

  const requireNumber = (field, value, errors) => {
    if (value === undefined || value === null || value === "") {
      errors.push({ field, message: `${field} is required` })
      return null
    }
    const n = typeof value === "number" ? value : Number(value)
    if (!Number.isFinite(n)) {
      errors.push({ field, message: `${field} must be a number` })
      return null
    }
    return n
  }

  const parsedReportDate = parseReportDateToUtcMidnight(reportDate)
  const errors = [];
  if (!parsedReportDate) errors.push({ field: "reportDate", message: "Invalid reportDate. Expected YYYY-MM-DD." })

  const callsReceivedNum = requireNumber("callsReceived", callsReceived, errors)
  const qualifiedLeadsNum = requireNumber("qualifiedLeads", qualifiedLeads, errors)
  const counsellingDoneNum = requireNumber("counsellingDone", counsellingDone, errors)
  const counsellingBookedNum = requireNumber("counsellingBooked", counsellingBooked, errors)
  const officeVisitsNum = requireNumber("officeVisits", officeVisits, errors)
  const closuresNum = requireNumber("closures", closures, errors)
  const followupsDoneNum = requireNumber("followupsDone", followupsDone, errors)
  const pendingFollowupsNum = requireNumber("pendingFollowups", pendingFollowups, errors)

  if (errors.length) throw new ValidationError("Validation failed", errors);

 
  // Submit-once: one report per user per branch per day (multiple users allowed)
  const existing = await prisma.dailyBranchReport.findUnique({
    where: { branchId_reportDate_createdById: { branchId, reportDate: parsedReportDate, createdById: user.id } },
    select: { id: true }
  })
  if (existing) throw new ConflictError("Daily report already submitted for this date")

  await prisma.dailyBranchReport.create({
    data: {
      branchId,
      reportDate: parsedReportDate,
      callsReceived: callsReceivedNum,
      qualifiedLeads: qualifiedLeadsNum,
      counsellingDone: counsellingDoneNum,
      counsellingBooked: counsellingBookedNum,
      officeVisits: officeVisitsNum,
      closures: closuresNum,
      followupsDone: followupsDoneNum,
      pendingFollowups: pendingFollowupsNum,
      createdById: user.id
    }
  })
  return true;
}

export const getDailyBranchReportsService = async (query , user) => {
  // Branch admin/manager dashboard must be scoped by authenticated user's branchId
  const branchId = Number(user?.branchId)
  if (!Number.isInteger(branchId) || branchId < 1) throw new BadRequestError("Branch is required")

  // Default: today (server time). If startDate/endDate provided, use that range.
  const startDate = query?.startDate ? new Date(query.startDate) : new Date()
  const endDate = query?.endDate ? new Date(query.endDate) : new Date()

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new BadRequestError("Invalid startDate/endDate")
  }

  startDate.setHours(0, 0, 0, 0)
  endDate.setHours(23, 59, 59, 999)

  
  // Match reports for this branch.
  // Primary key in table is `daily_branch_reports.branch_id`.
  // If some historical rows have wrong branch_id, we still include them when the creator user is in this branch.
  const baseWhere = {
    isDeleted: false,
    reportDate: { gte: startDate, lte: endDate },
    OR: [
      { branchId },
      { createdBy: { branchId } }
    ]
  }

  const METRICS = [
    "callsReceived",
    "qualifiedLeads",
    "counsellingDone",
    "counsellingBooked",
    "officeVisits",
    "closures",
    "followupsDone",
    "pendingFollowups"
  ]

  const emptyTotals = {
    callsReceived: 0,
    qualifiedLeads: 0,
    counsellingDone: 0,
    counsellingBooked: 0,
    officeVisits: 0,
    closures: 0,
    followupsDone: 0,
    pendingFollowups: 0
  }

  const normalizeSums = (sum) => ({
    callsReceived: sum?.callsReceived ?? 0,
    qualifiedLeads: sum?.qualifiedLeads ?? 0,
    counsellingDone: sum?.counsellingDone ?? 0,
    counsellingBooked: sum?.counsellingBooked ?? 0,
    officeVisits: sum?.officeVisits ?? 0,
    closures: sum?.closures ?? 0,
    followupsDone: sum?.followupsDone ?? 0,
    pendingFollowups: sum?.pendingFollowups ?? 0
  })

  // Branch admin dashboard: show branch data only.
  // Reports are submitted by ISE users and already include createdById, so we avoid extra role joins here.
  const where = baseWhere
  const reportsCount = await prisma.dailyBranchReport.count({ where })

  if (!reportsCount) {
    return {
      range: { startDate, endDate },
      reportsCount: 0,
      cards: METRICS.map(m => ({ metric: m, total: 0, topPerformers: [] }))
    }
  }

  // 1) Totals of all ISE reports in range (branch totals)
  const totalsAgg = await prisma.dailyBranchReport.aggregate({
    where,
    _sum: METRICS.reduce((acc, k) => ((acc[k] = true), acc), {}),
    _count: { _all: true }
  })
  const totals = normalizeSums(totalsAgg._sum)

  // 2) Per-metric top performers (DESC, return ALL)
  const metricGroupeds = await Promise.all(
    METRICS.map((m) =>
      prisma.dailyBranchReport.groupBy({
        by: ["createdById"],
        where,
        _sum: { [m]: true },
        orderBy: { _sum: { [m]: "desc" } }
      })
    )
  )

  const allUserIds = Array.from(new Set(metricGroupeds.flat().map(r => r.createdById)))
  const users = allUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: allUserIds } },
        select: { id: true, name: true, email: true }
      })
    : []
  const userById = new Map(users.map(u => [u.id, u]))

  const cards = METRICS.map((m, idx) => {
    const rows = metricGroupeds[idx] || []
    return {
      metric: m,
      total: totals[m],
      topPerformers: rows.map(r => ({
        user: {
          ...(userById.get(r.createdById) || { id: r.createdById }),
          total: r?._sum?.[m] ?? 0
        }
      }))
    }
  })

  return {
    range: { startDate, endDate },
    reportsCount: totalsAgg._count?._all || 0,
    cards
  }
}
