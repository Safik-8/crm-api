import { Router } from 'express';
import { authenticate }   from '../../middleware/Authenticate.js';
import { hasPermission }  from '../../middleware/hasPermission.js';
import * as ctrl          from './deal.controllers.js';

const router = Router();
router.use(authenticate);

// Stats must come before /:id so it isn't swallowed
router.get('/stats', hasPermission('PIPELINE', 'canView'), ctrl.getDealsStats);
router.get('/',      hasPermission('PIPELINE', 'canView'), ctrl.getDealsList);
router.get('/:id',   hasPermission('PIPELINE', 'canView'), ctrl.getDealById);

export default router;
