import { Router } from 'express';
import { authenticate } from '../../middleware/Authenticate.js';
import { hasPermission } from '../../middleware/hasPermission.js';
import * as opportunityController from './opportunity.controllers.js';
import {
  createOpportunitySchema,
  updateOpportunitySchema,
  closeOpportunitySchema,
  validateBody,
} from './opportunity.validation.js';

const router = Router();

// Protect all opportunity endpoints with JWT Authentication
router.use(authenticate);

router.get('/stages', hasPermission('LEAD', 'canView'), opportunityController.getOpportunityStages);

/**
 * @route   GET /api/opportunities
 * @desc    List paginated opportunities with search & filters (HRBAC Scoped)
 * @access  Private (LEAD:canView)
 */
router.get('/', hasPermission('LEAD', 'canView'), opportunityController.getOpportunitiesList);

/**
 * @route   POST /api/opportunities
 * @desc    Create a new opportunity for a qualified lead
 * @access  Private (LEAD:canCreate)
 */
router.post(
  '/',
  hasPermission('LEAD', 'canCreate'),
  validateBody(createOpportunitySchema),
  opportunityController.createOpportunity
);

/**
 * @route   GET /api/opportunities/:id
 * @desc    Get detailed single opportunity profile
 * @access  Private (LEAD:canView)
 */
router.get('/:id', hasPermission('LEAD', 'canView'), opportunityController.getOpportunityById);

/**
 * @route   PATCH /api/opportunities/:id
 * @desc    Update opportunity details (revenue, closing date, notes)
 * @access  Private (LEAD:canEdit)
 */
router.patch(
  '/:id',
  hasPermission('LEAD', 'canEdit'),
  validateBody(updateOpportunitySchema),
  opportunityController.updateOpportunity
);

/**
 * @route   POST /api/opportunities/:id/close
 * @desc    Close opportunity outcome (WON / LOST / CANCELLED)
 * @access  Private (LEAD:canEdit)
 */
router.post(
  '/:id/close',
  hasPermission('LEAD', 'canEdit'),
  validateBody(closeOpportunitySchema),
  opportunityController.closeOpportunity
);

export default router;
