import { NotFoundError, ForbiddenError, ValidationError } from '../../utils/AppError.js';
import { ROLE_RANKS } from '../../config/roleConstants.js';
import * as customerRepository from './customer.repository.js';

/**
 * List customers — paginated, filtered, RBAC-scoped.
 */
export const getCustomersList = async (actor, queryParams) => {
  const page  = Math.max(1, parseInt(queryParams.page)  || 1);
  const limit = Math.min(100, parseInt(queryParams.limit) || 20);
  const skip  = (page - 1) * limit;

  const where = customerRepository.buildCustomerWhere(actor, queryParams);

  const { total, customers } = await customerRepository.findCustomersList({
    where,
    skip,
    take: limit,
  });

  return {
    items: customers,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get single customer detail — RBAC-scoped.
 */
export const getCustomerById = async (actor, id) => {
  const rank = actor.primaryRoleRank ?? 0;

  // Build scoped where for findById
  const scopedWhere = {};
  if (actor.primaryRole !== 'SUPER_ADMIN' && actor.companyId) {
    scopedWhere.companyId = actor.companyId;
  }
  // BDE/ISE → only own
  if (rank < 60) {
    scopedWhere.assignedOwnerId = actor.id;
  }
  // Branch Manager → own branch
  if (rank >= 60 && rank < 80 && actor.branchId) {
    scopedWhere.branchId = actor.branchId;
  }

  const customer = await customerRepository.findCustomerById(id, scopedWhere);
  if (!customer) throw new NotFoundError('Customer');

  return customer;
};

/**
 * Toggle customer status — Admin/Manager only.
 */
export const updateCustomerStatus = async (actor, id, status) => {
  const rank = actor.primaryRoleRank ?? 0;

  // Only rank >= 60 (Branch Manager+) can toggle status
  if (rank < 60) {
    throw new ForbiddenError('Only managers and above can update customer status.');
  }

  if (!['ACTIVE', 'INACTIVE'].includes(status)) {
    throw new ValidationError('Status must be ACTIVE or INACTIVE.');
  }

  // Scope check — Branch Manager can only update their branch's customers
  const scopedWhere = {};
  if (actor.primaryRole !== 'SUPER_ADMIN' && actor.companyId) {
    scopedWhere.companyId = actor.companyId;
  }
  if (rank >= 60 && rank < 80 && actor.branchId) {
    scopedWhere.branchId = actor.branchId;
  }

  const customer = await customerRepository.findCustomerById(id, scopedWhere);
  if (!customer) throw new NotFoundError('Customer');

  return customerRepository.updateCustomerStatus(id, status, actor.id);
};
