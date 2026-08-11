import express from 'express';
import {
  getCompanyCriteria,
  getCompanySettings,
  createCriterion,
  updateCriterion,
  deleteCriterion,
  saveCriteriaMatrix,
  updateCompanySettings,
  autoBalanceCriteria,
} from './qualification-settings.controllers.js';
import { authenticate } from '../../middleware/Authenticate.js';
import { PermissionDeniedError } from '../../utils/AppError.js';

const router = express.Router();

router.use(authenticate);

// Permissive read middleware for qualification criteria
const canReadCriteria = (req, res, next) => {
  if (!req.user) return next(new PermissionDeniedError('QUALIFICATION', 'canView'));
  if (req.user.primaryRole === 'SUPER_ADMIN' || req.user.primaryRole === 'COMPANY_ADMIN') return next();

  const qualPerms = req.user.permissions?.['QUALIFICATION'];
  const sysPerms = req.user.permissions?.['SYSTEM_SETTINGS'];
  const leadPerms = req.user.permissions?.['LEAD'];

  if (
    (qualPerms && qualPerms.canView) ||
    (sysPerms && sysPerms.canView) ||
    (leadPerms && (leadPerms.canView || leadPerms.canEdit))
  ) {
    return next();
  }

  if (req.user.primaryRoleRank && Number(req.user.primaryRoleRank) >= 40) {
    return next();
  }

  return next(new PermissionDeniedError('QUALIFICATION', 'canView'));
};

// Permissive edit middleware for qualification criteria (QUALIFICATION canEdit OR SYSTEM_SETTINGS canEdit)
const canEditCriteria = (req, res, next) => {
  if (!req.user) return next(new PermissionDeniedError('QUALIFICATION', 'canEdit'));
  if (req.user.primaryRole === 'SUPER_ADMIN' || req.user.primaryRole === 'COMPANY_ADMIN') return next();

  const qualPerms = req.user.permissions?.['QUALIFICATION'];
  const sysPerms = req.user.permissions?.['SYSTEM_SETTINGS'];

  if ((qualPerms && (qualPerms.canEdit || qualPerms.canCreate)) || (sysPerms && sysPerms.canEdit)) {
    return next();
  }

  return next(new PermissionDeniedError('QUALIFICATION', 'canEdit'));
};

// Permissive delete middleware for qualification criteria
const canDeleteCriteria = (req, res, next) => {
  if (!req.user) return next(new PermissionDeniedError('QUALIFICATION', 'canDelete'));
  if (req.user.primaryRole === 'SUPER_ADMIN' || req.user.primaryRole === 'COMPANY_ADMIN') return next();

  const qualPerms = req.user.permissions?.['QUALIFICATION'];
  const sysPerms = req.user.permissions?.['SYSTEM_SETTINGS'];

  if ((qualPerms && qualPerms.canDelete) || (sysPerms && (sysPerms.canDelete || sysPerms.canEdit))) {
    return next();
  }

  return next(new PermissionDeniedError('QUALIFICATION', 'canDelete'));
};

router.get('/criteria', canReadCriteria, getCompanyCriteria);
router.get('/settings', canReadCriteria, getCompanySettings);

router.post('/criteria', canEditCriteria, createCriterion);
router.put('/criteria/:id', canEditCriteria, updateCriterion);
router.delete('/criteria/:id', canDeleteCriteria, deleteCriterion);

router.post('/matrix', canEditCriteria, saveCriteriaMatrix);
router.post('/auto-balance', canEditCriteria, autoBalanceCriteria);
router.put('/settings', canEditCriteria, updateCompanySettings);

export default router;
