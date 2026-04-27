import prisma from "../../config/db.js"
import { BadRequestError, NotFoundError, ValidationError } from "../../utils/AppError.js"


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

 
  // one report per user per branch per day (multiple users allowed)
  await prisma.dailyBranchReport.upsert({
    where: { branchId_reportDate_createdById: { branchId, reportDate, createdById: user.id } },
    update: {
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
      updatedById: user.id
    },
    create: {
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
   
  const branchId = user.branchId;
  if (!branchId) throw new BadRequestError("Branch is required");

  const startDate = query?.startDate ? new Date(query.startDate) : new Date()
  const endDate = query?.endDate ? new Date(query.endDate) : new Date()

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new BadRequestError("Invalid startDate/endDate")
  }

  startDate.setHours(0, 0, 0, 0)
  endDate.setHours(23, 59, 59, 999)

  const baseWhere = { branchId, isDeleted: false, reportDate: { gte: startDate, lte: endDate } }

  // Limit report calculations to ISE users of this branch
  const iseUserRoles = await prisma.userRole.findMany({
    where: {
      branchId,
      role: { name: "ISE" }
    },
    select: { userId: true }
  })
  const iseUserIds = iseUserRoles.map(r => r.userId)
  const where = iseUserIds.length ? { ...baseWhere, createdById: { in: iseUserIds } } : { ...baseWhere, createdById: { in: [-1] } }

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

  // 1) SUM of all ISE data in range (branch totals)
  const totalsAgg = await prisma.dailyBranchReport.aggregate({
    where,
    _sum: {
      callsReceived: true,
      qualifiedLeads: true,
      counsellingDone: true,
      counsellingBooked: true,
      officeVisits: true,
      closures: true,
      revenue: true,
      followupsDone: true,
      pendingFollowups: true,
      seminarTasks: true,
      joiningFormalities: true
    },
    _count: { _all: true }
  })

  // 2) Top performance ISE details (group by ISE user)
  // query.sortBy: callsReceived | qualifiedLeads | closures | revenue | ...
  const sortBy = String(query?.sortBy || "revenue")
  const allowedSort = new Set([
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
  ])
  const metric = allowedSort.has(sortBy) ? sortBy : "revenue"
  const order = String(query?.order || "desc").toLowerCase() === "asc" ? "asc" : "desc"
  const top = Math.min(Math.max(Number(query?.top || 5) || 5, 1), 50)

  const grouped = await prisma.dailyBranchReport.groupBy({
    by: ["createdById"],
    where,
    _sum: {
      callsReceived: true,
      qualifiedLeads: true,
      counsellingDone: true,
      counsellingBooked: true,
      officeVisits: true,
      closures: true,
      revenue: true,
      followupsDone: true,
      pendingFollowups: true,
      seminarTasks: true,
      joiningFormalities: true
    },
    orderBy: { _sum: { [metric]: order } },
    take: top
  })

  const userIds = grouped.map(g => g.createdById)
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true }
  })
  const userById = new Map(users.map(u => [u.id, u]))

  const topPerformers = grouped.map(g => ({
    user: userById.get(g.createdById) || { id: g.createdById },
    totals: normalizeSums(g._sum)
  }))

  return {
    range: { startDate, endDate },
    totals: normalizeSums(totalsAgg._sum),
    reportsCount: totalsAgg._count?._all || 0,
    topMetric: metric,
    topOrder: order,
    topPerformers
  }
}
