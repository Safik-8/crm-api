import { Router } from 'express';
import { authenticate } from '../../middleware/Authenticate.js';
import { hasPermission } from '../../middleware/hasPermission.js';
import * as opportunityController from './opportunity.controllers.js';
import { authorize } from '../../middleware/authorize.js';
import {
  createOpportunitySchema,
  updateOpportunitySchema,
  closeOpportunitySchema,
  closureOpportunitySchema,
  createOpportunityStageSchema,
  updateOpportunityStageSchema,
  bulkOpportunityStagesSchema,
  moveOpportunityStageSchema,
  qualifyOpportunitySchema,
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
 * @access  Private (OPPORTUNITY:canView)
 */
router.get('/', hasPermission('OPPORTUNITY', 'canView'), opportunityController.getOpportunitiesList);

// Pipeline Closure → auto-create opportunity
// Permission: LEAD:canEdit — ISE, BDE, BM, Admin all have this
router.post(
  '/from-pipeline-closure/:leadId',
  hasPermission('LEAD', 'canEdit'),
  validateBody(closureOpportunitySchema),
  opportunityController.closePipelineLeadAndCreateOpportunity
);

/**
 * @route   POST /api/opportunities
 * @desc    Create a new opportunity for a qualified lead
 * @access  Private (OPPORTUNITY:canCreate)
 */
router.post(
  '/',
  hasPermission('OPPORTUNITY', 'canCreate'),
  validateBody(createOpportunitySchema),
  opportunityController.createOpportunity
);

// Fetch active win/loss reasons for the company (used when closing opportunities as LOST)
router.get('/reasons', hasPermission('LEAD', 'canView'), opportunityController.getWinLossReasons);

/**
 * @route   GET /api/opportunities/:id
 * @desc    Get detailed single opportunity profile
 * @access  Private (OPPORTUNITY:canView)
 */
router.get('/:id', hasPermission('OPPORTUNITY', 'canView'), opportunityController.getOpportunityById);

/**
 * @route   PATCH /api/opportunities/:id
 * @desc    Update opportunity details (revenue, closing date, notes)
 * @access  Private (OPPORTUNITY:canEdit)
 */
router.patch(
  '/:id',
  hasPermission('OPPORTUNITY', 'canEdit'),
  validateBody(updateOpportunitySchema),
  opportunityController.updateOpportunity
);

/**
 * @route   POST /api/opportunities/:id/qualify
 * @desc    Qualify an opportunity — computes a priority score (0–100%) from company criteria.
 *          Stores score on the opportunity record. Does NOT touch Lead qualification tables.
 * @access  Private (OPPORTUNITY:canEdit)
 */
router.post(
  '/:id/qualify',
  hasPermission('OPPORTUNITY', 'canEdit'),
  validateBody(qualifyOpportunitySchema),
  opportunityController.qualifyOpportunity
);

/**
 * @route   POST /api/opportunities/:id/close
 * @desc    Close opportunity outcome (WON / LOST / CANCELLED)
 * @access  Private (OPPORTUNITY:canEdit)
 */
router.post(
  '/:id/close',
  hasPermission('OPPORTUNITY', 'canEdit'),
  validateBody(closeOpportunitySchema),
  opportunityController.closeOpportunity
);

export default router;

