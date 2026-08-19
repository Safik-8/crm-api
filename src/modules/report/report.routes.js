import { Router } from 'express';
import { authenticate } from '../../middleware/Authenticate.js';
import { hasPermission } from '../../middleware/hasPermission.js';
import {
  getReportsList,
  generateReport,
  saveConfig,
  updateConfig,
  deleteConfig
} from './report.controllers.js';

const router = Router();

// Secure all routes in report module
router.use(authenticate);

router.get('/list', hasPermission('REPORT', 'canView'), getReportsList);
router.post('/generate', hasPermission('REPORT', 'canCreate'), generateReport);
router.post('/save', hasPermission('REPORT', 'canEdit'), saveConfig);
router.put('/save/:id', hasPermission('REPORT', 'canEdit'), updateConfig);
router.delete('/save/:id', hasPermission('REPORT', 'canDelete'), deleteConfig);

export default router;
