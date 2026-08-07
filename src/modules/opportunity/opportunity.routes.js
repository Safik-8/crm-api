import { Router } from 'express';
import { authenticate } from '../../middleware/Authenticate.js';
import { hasPermission } from '../../middleware/hasPermission.js';
import * as opportunityController from './opportunity.controllers.js';
import { authorize } from '../../middleware/authorize.js';
import {
  createOpportunitySchema,
  updateOpportunitySchema,
  closeOpportunitySchema,
  createOpportunityStageSchema,
  updateOpportunityStageSchema,
  bulkOpportunityStagesSchema,
  moveOpportunityStageSchema,
  validateBody,
} from './opportunity.validation.js';

const router = Router();

// Protect all opportunity endpoints with JWT Authentication
router.use(authenticate);

router.get('/stages', hasPermission('LEAD', 'canView'), opportunityController.getOpportunityStages);
router.put('/stages/bulk', hasPermission('OPPORTUNITY_PIPELINE', 'canEdit'), validateBody(bulkOpportunityStagesSchema), opportunityController.bulkUpdateOpportunityStages);
router.post('/stages', hasPermission('OPPORTUNITY_PIPELINE', 'canCreate'), validateBody(createOpportunityStageSchema), opportunityController.createOpportunityStage);
router.patch('/stages/:stageId', hasPermission('OPPORTUNITY_PIPELINE', 'canEdit'), validateBody(updateOpportunityStageSchema), opportunityController.updateOpportunityStage);
router.patch('/stages/:stageId/toggle', hasPermission('OPPORTUNITY_PIPELINE', 'canEdit'), opportunityController.toggleOpportunityStage);
router.delete('/stages/:stageId', hasPermission('OPPORTUNITY_PIPELINE', 'canDelete'), opportunityController.deleteOpportunityStage);
router.patch('/:id/stage', hasPermission('LEAD', 'canEdit'), validateBody(moveOpportunityStageSchema), opportunityController.moveOpportunityStage);


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
