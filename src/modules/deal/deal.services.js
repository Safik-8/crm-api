import { NotFoundError, ForbiddenError } from '../../utils/AppError.js';
import * as dealRepo from './deal.repository.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const resolveOrderBy = (sortBy, sortOrder = 'desc') => {
  const dir = sortOrder === 'asc' ? 'asc' : 'desc';
  switch (sortBy) {
    case 'finalAmount' : return { finalAmount : dir };
    case 'dealNumber'  : return { dealNumber  : dir };
    case 'customerName': return { lead: { name: dir } };
    default            : return { closingDate : dir };
  }
};

// ─── List ─────────────────────────────────────────────────────────────────────
export const getDealsList = async (actor, q) => {
  const page  = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(100, parseInt(q.limit) || 20);
  const skip  = (page - 1) * limit;

  const where   = dealRepo.buildDealWhere(actor, q);
  const orderBy = resolveOrderBy(q.sortBy, q.sortOrder);

  const { total, deals } = await dealRepo.findDealsList({ where, skip, take: limit, orderBy });
  const stats = await dealRepo.getDealStats(where);

  return {
    items: deals,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    stats,
  };
};

// ─── Stats ────────────────────────────────────────────────────────────────────
export const getDealsStats = async (actor, q) => {
  const where = dealRepo.buildDealWhere(actor, q);
  return dealRepo.getDealStats(where);
};

// ─── Detail ───────────────────────────────────────────────────────────────────
export const getDealById = async (actor, id) => {
  const rank = actor.primaryRoleRank ?? 0;

  const extraWhere = {};
  if (actor.primaryRole !== 'SUPER_ADMIN' && actor.companyId) {
    extraWhere.companyId = actor.companyId;
  }
  if (rank <= 40) extraWhere.closedById = actor.id;
  if (rank >= 41 && rank <= 60 && actor.branchId) extraWhere.branchId = actor.branchId;

  const deal = await dealRepo.findDealById(id, extraWhere);
  if (!deal) throw new NotFoundError('Deal');

  return deal;
};
