import prisma from '../../config/db.js';

/**
 * Build RBAC-scoped where clause for customer queries.
 */
export const buildCustomerWhere = (actor, queryParams = {}) => {
  const isSuperAdmin = actor.primaryRole === 'SUPER_ADMIN';
  const rank = actor.primaryRoleRank ?? 0;

  const where = { isDeleted: false };

  // ── Tenant scoping ────────────────────────────────────────────────────────
  if (!isSuperAdmin && actor.companyId) {
    where.companyId = actor.companyId;
  }
  if (isSuperAdmin && queryParams.companyId) {
    where.companyId = parseInt(queryParams.companyId);
  }

  // Branch tier (Branch Manager + Level 2 custom roles rank 41..60) → restrict to own branch
  if (rank >= 41 && rank <= 60 && actor.branchId) {
    where.branchId = actor.branchId;
  }

  // SA/Company Admin & Custom roles (rank >= 61) can filter by branch explicitly
  if (rank >= 61 && queryParams.branchId) {
    where.branchId = parseInt(queryParams.branchId);
  }

  // BDE/ISE & Lower Tiers (rank <= 40) → only their own customers
  if (rank <= 40) {
    where.assignedOwnerId = actor.id;
  }

  // Manager+ (rank >= 41) can filter by specific owner
  if (rank >= 41 && queryParams.ownerId) {
    where.assignedOwnerId = parseInt(queryParams.ownerId);
  }

  // ── Filters ───────────────────────────────────────────────────────────────
  if (queryParams.status) {
    where.status = queryParams.status;
  }

  if (queryParams.search) {
    const s = queryParams.search.trim();
    where.OR = [
      { customerName: { contains: s, mode: 'insensitive' } },
      { contactNumber: { contains: s, mode: 'insensitive' } },
      { email: { contains: s, mode: 'insensitive' } },
      { customerCode: { contains: s, mode: 'insensitive' } },
    ];
  }

  if (queryParams.dateFrom || queryParams.dateTo) {
    where.createdAt = {};
    if (queryParams.dateFrom) where.createdAt.gte = new Date(queryParams.dateFrom);
    if (queryParams.dateTo) {
      const to = new Date(queryParams.dateTo);
      to.setHours(23, 59, 59, 999);
      where.createdAt.lte = to;
    }
  }

  return where;
};

/** Standard include block for list queries */
const LIST_INCLUDE = {
  assignedOwner: { select: { id: true, name: true, email: true } },
  purchasedProduct: { select: { id: true, name: true, code: true } },
  branch: { select: { id: true, name: true } },
  deal: {
    select: {
      id: true,
      dealNumber: true,
      outcome: true,
      finalAmount: true,
      closingDate: true,
    },
  },
};

/** Full include block for detail queries */
const DETAIL_INCLUDE = {
  assignedOwner: { select: { id: true, name: true, email: true } },
  purchasedProduct: { select: { id: true, name: true, code: true } },
  branch: { select: { id: true, name: true } },
  lead: {
    select: {
      id: true,
      name: true,
      mobile: true,
      email: true,
      source: { select: { id: true, name: true } },
    },
  },
  opportunity: {
    select: {
      id: true,
      opportunityName: true,
      expectedRevenue: true,
      probabilityPercentage: true,
      status: true,
      stage: { select: { id: true, name: true, colorCode: true } },
    },
  },
  deal: {
    select: {
      id: true,
      dealNumber: true,
      outcome: true,
      finalAmount: true,
      closingDate: true,
      remarks: true,
      closedBy: { select: { id: true, name: true } },
    },
  },
  revenueLogs: {
    select: {
      id: true,
      revenueAmount: true,
      revenueDate: true,
      paymentStatus: true,
      notes: true,
    },
    orderBy: { revenueDate: 'desc' },
  },
};

/**
 * Paginated list
 */
export const findCustomersList = async ({ where, skip = 0, take = 20, orderBy = { createdAt: 'desc' } }) => {
  const [total, customers] = await prisma.$transaction([
    prisma.customer.count({ where }),
    prisma.customer.findMany({ where, skip, take, orderBy, include: LIST_INCLUDE }),
  ]);
  return { total, customers };
};

/**
 * Single customer detail
 */
export const findCustomerById = async (id, where = {}) => {
  return prisma.customer.findFirst({
    where: { id: Number(id), isDeleted: false, ...where },
    include: DETAIL_INCLUDE,
  });
};

/**
 * Update customer status
 */
export const updateCustomerStatus = async (id, status, updatedById) => {
  return prisma.customer.update({
    where: { id: Number(id) },
    data: { status, updatedById },
    include: LIST_INCLUDE,
  });
};

/**
 * Get customer stats aggregated by filters
 */
export const getCustomerStats = async (where) => {
  const [total, active, inactive, revenue] = await prisma.$transaction([
    prisma.customer.count({ where }),
    prisma.customer.count({ where: { ...where, status: 'ACTIVE' } }),
    prisma.customer.count({ where: { ...where, status: 'INACTIVE' } }),
    prisma.customer.aggregate({
      where,
      _sum: { totalRevenue: true },
    }),
  ]);
  return {
    total,
    active,
    inactive,
    totalRevenue: Number(revenue._sum.totalRevenue || 0),
  };
};

