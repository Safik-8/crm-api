import { Router } from 'express';
import { authenticate } from '../../middleware/Authenticate.js';
import { hasPermission } from '../../middleware/hasPermission.js';
import * as customerController from './customer.controllers.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/customers
 * List customers — paginated, filtered, RBAC-scoped.
 */
router.get(
  '/',
  hasPermission('CUSTOMER', 'canView'),
  customerController.getCustomersList
);

/**
 * GET /api/customers/:id
 * Full customer detail view.
 */
router.get(
  '/:id',
  hasPermission('CUSTOMER', 'canView'),
  customerController.getCustomerById
);

/**
 * PATCH /api/customers/:id/status
 * Toggle ACTIVE / INACTIVE.
 */
router.patch(
  '/:id/status',
  hasPermission('CUSTOMER', 'canEdit'),
  customerController.updateCustomerStatus
);

export default router;
