import prisma from "../../config/db.js"
import { BadRequestError, ConflictError, ValidationError } from "../../utils/AppError.js"


export const submitDailyBranchReportService = async (data, user) => {
  const { reportDate, callsReceived, qualifiedLeads, counsellingDone, counsellingBooked, officeVisits, closures, revenue, followupsDone, pendingFollowups, seminarTasks, joiningFormalities } = data;

  const branchId = user.branchId;
  if (!branchId) throw new BadRequestError("Branch is required");

  if (!reportDate || !callsReceived || !qualifiedLeads || !counsellingDone || !counsellingBooked || !officeVisits || !closures || !revenue || !followupsDone || !pendingFollowups || !seminarTasks || !joiningFormalities ) {
  }
  const errors = [];
  if (!reportDate) errors.push({ field: "reportDate", message: "Report date is required" });
  if (!callsReceived) errors.push({ field: "callsReceived", message: "Calls received is required" });
  if (!qualifiedLeads) errors.push({ field: "qualifiedLeads", message: "Qualified leads is required" });
  if (!counsellingDone) errors.push({ field: "counsellingDone", message: "Counselling done is required" });
  if (!counsellingBooked) errors.push({ field: "counsellingBooked", message: "Counselling booked is required" });
  if (!officeVisits) errors.push({ field: "officeVisits", message: "Office visits is required" });
  if (!closures) errors.push({ field: "closures", message: "Closures is required" });
  if (!revenue) errors.push({ field: "revenue", message: "Revenue is required" });
  if (!followupsDone) errors.push({ field: "followupsDone", message: "Followups done is required" });
  if (!pendingFollowups) errors.push({ field: "pendingFollowups", message: "Pending followups is required" });
  if (!seminarTasks) errors.push({ field: "seminarTasks", message: "Seminar tasks is required" });
  if (!joiningFormalities) errors.push({ field: "joiningFormalities", message: "Joining formalities is required" });
  if (errors.length) throw new ValidationError("Validation failed", errors);

 
  // Submit-once: one report per user per branch per day (multiple users allowed)
  const existing = await prisma.dailyBranchReport.findUnique({
    where: { branchId_reportDate_createdById: { branchId, reportDate, createdById: user.id } },
    select: { id: true }
  })
  if (existing) throw new ConflictError("Daily report already submitted for this date")

  await prisma.dailyBranchReport.create({
    data: {
      branchId,
      reportDate,
      callsReceived,
      qualifiedLeads,
      counsellingDone,
      counsellingBooked,
      officeVisits,
      closures,
      revenue,
      followupsDone,
      pendingFollowups,
      seminarTasks,
      joiningFormalities,
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

console.log(startDate, endDate);

  
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
    "revenue",
    "followupsDone",
    "pendingFollowups",
    "seminarTasks",
    "joiningFormalities"
  ]

  const emptyTotals = {
    callsReceived: 0,
    qualifiedLeads: 0,
    counsellingDone: 0,
    counsellingBooked: 0,
    officeVisits: 0,
    closures: 0,
    revenue: 0,
    followupsDone: 0,
    pendingFollowups: 0,
    seminarTasks: 0,
    joiningFormalities: 0
  }

  const normalizeSums = (sum) => ({
    callsReceived: sum?.callsReceived ?? 0,
    qualifiedLeads: sum?.qualifiedLeads ?? 0,
    counsellingDone: sum?.counsellingDone ?? 0,
    counsellingBooked: sum?.counsellingBooked ?? 0,
    officeVisits: sum?.officeVisits ?? 0,
    closures: sum?.closures ?? 0,
    revenue: sum?.revenue ?? 0,
    followupsDone: sum?.followupsDone ?? 0,
    pendingFollowups: sum?.pendingFollowups ?? 0,
    seminarTasks: sum?.seminarTasks ?? 0,
    joiningFormalities: sum?.joiningFormalities ?? 0
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
        user: userById.get(r.createdById) || { id: r.createdById }
      }))
    }
  })

  return {
    range: { startDate, endDate },
    reportsCount: totalsAgg._count?._all || 0,
    cards
  }
}
