import { Router } from 'express';
import { authenticate } from '../../middleware/Authenticate.js';
import { hasPermission } from '../../middleware/hasPermission.js';
import * as ctrl from './proposal.controllers.js';

const router = Router();
router.use(authenticate);

router.post('/', hasPermission('OPPORTUNITY', 'canCreate'), ctrl.createProposal);
router.get('/', hasPermission('OPPORTUNITY', 'canView'), ctrl.getProposalsList);
router.get('/:id', hasPermission('OPPORTUNITY', 'canView'), ctrl.getProposalById);
router.put('/:id', hasPermission('OPPORTUNITY', 'canEdit'), ctrl.updateProposal);
router.patch('/:id/status', hasPermission('OPPORTUNITY', 'canEdit'), ctrl.updateProposalStatus);
router.delete('/:id', hasPermission('OPPORTUNITY', 'canDelete'), ctrl.deleteProposal);

export default router;
