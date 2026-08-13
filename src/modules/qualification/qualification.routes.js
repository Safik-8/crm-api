import express from 'express';
import { evaluateLead, getLeadHistory, getQualificationConfig } from './qualification.controllers.js';
import { authenticate } from '../../middleware/Authenticate.js';
import { hasPermission } from '../../middleware/hasPermission.js';

const router = express.Router();

router.use(authenticate);

router.get(
  '/qualification/config',
  hasPermission('QUALIFICATION', 'canView'),
  getQualificationConfig
);

router.post(
  '/:id/qualify',
  hasPermission('QUALIFICATION', 'canEdit'),
  evaluateLead
);

router.get(
  '/:id/qualification-history',
  hasPermission('QUALIFICATION', 'canView'),
  getLeadHistory
);

export default router;
