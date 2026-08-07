import * as customerService from './customer.services.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * GET /api/customers
 * List paginated customers with filters and RBAC scoping.
 */
export const getCustomersList = async (req, res, next) => {
  try {
    const result = await customerService.getCustomersList(req.user, req.query);
    return res.status(200).json({
      success    : true,
      statusCode : 200,
      message    : 'Customers fetched successfully',
      data       : result.items,
      pagination : result.pagination,
      timestamp  : new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/customers/:id
 * Get single customer with full linked data.
 */
export const getCustomerById = async (req, res, next) => {
  try {
    const id       = parseInt(req.params.id);
    const customer = await customerService.getCustomerById(req.user, id);
    return sendSuccess(res, customer, 'Customer details fetched successfully', 200);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/customers/:id/status
 * Toggle customer status — Admin/Manager only.
 */
export const updateCustomerStatus = async (req, res, next) => {
  try {
    const id       = parseInt(req.params.id);
    const { status } = req.body;
    const customer = await customerService.updateCustomerStatus(req.user, id, status);
    return sendSuccess(res, customer, `Customer status updated to ${status}`, 200);
  } catch (error) {
    next(error);
  }
};
