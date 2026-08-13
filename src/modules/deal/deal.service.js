import * as dealRepository from './deal.repository.js';
import { ROLE_RANKS } from '../../config/roleConstants.js';

const normalizeSort = (sortBy, sortOrder) => {
  const order = sortOrder === 'asc' ? 'asc' : 'desc';
  switch (sortBy) {
    case 'finalAmount':
      return { finalAmount: order };
    case 'dealNumber':
      return { dealNumber: order };
    case 'customerName':
      return { customer: { customerName: order } };
    case 'closingDate':
    default:
      return { closingDate: order };
  }
};

export const getDealsList = async (actor, queryParams) => {
  const page = Math.max(1, parseInt(queryParams.page) || 1);
  const limit = Math.min(100, parseInt(queryParams.limit) || 10);
  const skip = (page - 1) * limit;

  const sortBy = queryParams.sortBy || 'closingDate';
  const sortOrder = queryParams.sortOrder || (sortBy === 'finalAmount' ? 'desc' : 'desc');
  const orderBy = normalizeSort(sortBy, sortOrder);

  const where = dealRepository.buildDealWhere(actor, queryParams);
  const { total, deals } = await dealRepository.findDealsList({ where, skip, take: limit, orderBy });
  const stats = await dealRepository.findDealStats(where);

  return {
    items: deals,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    stats,
  };
};

export const getDealById = async (actor, id) => {
  return dealRepository.validateDealExists(id, actor);
};
