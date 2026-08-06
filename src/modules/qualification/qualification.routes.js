import express from 'express';
import { evaluateLead, getLeadHistory } from './qualification.controllers.js';
import { authenticate } from '../../middleware/Authenticate.js';
import { hasPermission } from '../../middleware/hasPermission.js';

const router = express.Router();

router.use(authenticate);

router.post(
  '/:id/qualify',
  hasPermission('LEAD', 'canEdit'),
  evaluateLead
);

router.get(
  '/:id/qualification-history',
  hasPermission('LEAD', 'canView'),
  getLeadHistory
);

export default router;
