import prisma from '../../config/db.js';

// ─── RBAC where builder ───────────────────────────────────────────────────────
export const buildDealWhere = (actor, q = {}) => {
  const isSA   = actor.primaryRole === 'SUPER_ADMIN';
  const rank   = actor.primaryRoleRank ?? 0;
  const where  = {};

  // Tenant
  if (!isSA && actor.companyId) where.companyId = actor.companyId;
  if (isSA  && q.companyId)     where.companyId = parseInt(q.companyId);

  // Branch scope (Branch Manager & below rank <= 60 locked to branch, rank >= 61 is company-wide)
  if (rank >= 41 && rank <= 60 && actor.branchId) where.branchId = actor.branchId;
  if (rank >= 61 && q.branchId)                  where.branchId = parseInt(q.branchId);

  // BDE/ISE/Custom Reps see only own
  if (rank <= 40) where.closedById = actor.id;
  if (rank > 40 && q.ownerId) where.closedById = parseInt(q.ownerId);

  // Outcome filter
  if (q.outcome) where.outcome = q.outcome;

  // Search
  if (q.search) {
    const s = q.search.trim();
    where.OR = [
      { dealNumber:           { contains: s, mode: 'insensitive' } },
      { opportunity: { opportunityName: { contains: s, mode: 'insensitive' } } },
      { lead:        { name:            { contains: s, mode: 'insensitive' } } },
    ];
  }

  // Date range on closingDate
  if (q.dateFrom || q.dateTo) {
    where.closingDate = {};
    if (q.dateFrom) where.closingDate.gte = new Date(q.dateFrom);
    if (q.dateTo) {
      const t = new Date(q.dateTo); t.setHours(23, 59, 59, 999);
      where.closingDate.lte = t;
    }
  }

  // Amount range
  if (q.minAmount || q.maxAmount) {
    where.finalAmount = {};
    if (q.minAmount) where.finalAmount.gte = parseFloat(q.minAmount);
    if (q.maxAmount) where.finalAmount.lte = parseFloat(q.maxAmount);
  }

  return where;
};

// ─── Shared includes ──────────────────────────────────────────────────────────
const LIST_INCLUDE = {
  opportunity : { select: { id: true, opportunityName: true, expectedRevenue: true } },
  lead        : { select: { id: true, name: true, mobile: true, email: true } },
  closedBy    : { select: { id: true, name: true, email: true } },
  customer    : { select: { id: true, customerName: true, customerCode: true, status: true } },
};

const DETAIL_INCLUDE = {
  ...LIST_INCLUDE,
  reason      : { select: { id: true, reasonName: true, reasonType: true } },
  revenueLog  : {
    select: { id: true, revenueAmount: true, revenueDate: true, paymentStatus: true, notes: true },
  },
  histories   : {
    orderBy : { createdAt: 'desc' },
    include : { createdBy: { select: { id: true, name: true } } },
  },
};

// ─── Queries ──────────────────────────────────────────────────────────────────
export const findDealsList = async ({ where, skip = 0, take = 20, orderBy }) => {
  const [total, deals] = await prisma.$transaction([
    prisma.deal.count({ where }),
    prisma.deal.findMany({ where, skip, take, orderBy, include: LIST_INCLUDE }),
  ]);
  return { total, deals };
};

export const findDealById = async (id, extraWhere = {}) =>
  prisma.deal.findFirst({
    where: { id: Number(id), ...extraWhere },
    include: DETAIL_INCLUDE,
  });

// ─── Summary stats ────────────────────────────────────────────────────────────
export const getDealStats = async (where) => {
  const [total, wonCount, lostCount, cancelledCount, wonRevenue] = await prisma.$transaction([
    prisma.deal.count({ where }),
    prisma.deal.count({ where: { ...where, outcome: 'WON' } }),
    prisma.deal.count({ where: { ...where, outcome: 'LOST' } }),
    prisma.deal.count({ where: { ...where, outcome: 'CANCELLED' } }),
    prisma.deal.aggregate({
      where: { ...where, outcome: 'WON' },
      _sum: { finalAmount: true },
    }),
  ]);

  return {
    total,
    won         : wonCount,
    lost        : lostCount,
    cancelled   : cancelledCount,
    wonRevenue  : Number(wonRevenue._sum.finalAmount ?? 0),
  };
};
