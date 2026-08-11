import * as settingsService from './qualification-settings.service.js';

export const getCompanyCriteria = async (req, res, next) => {
  try {
    const companyId = req.user.companyId || 1;
    const criteria = await settingsService.getCompanyCriteriaService(companyId);
    res.status(200).json({ success: true, data: criteria });
  } catch (error) {
    next(error);
  }
};

export const getCompanySettings = async (req, res, next) => {
  try {
    const companyId = req.user.companyId || 1;
    const settings = await settingsService.getCompanySettingsService(companyId);
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

export const createCriterion = async (req, res, next) => {
  try {
    const companyId = req.user.companyId || 1;
    const criterion = await settingsService.createCriterionService(companyId, req.body);
    res.status(201).json({ success: true, message: 'Criterion field created successfully', data: criterion });
  } catch (error) {
    next(error);
  }
};

export const updateCriterion = async (req, res, next) => {
  try {
    const companyId = req.user.companyId || 1;
    const criterion = await settingsService.updateCriterionService(companyId, req.params.id, req.body);
    res.status(200).json({ success: true, message: 'Criterion updated successfully', data: criterion });
  } catch (error) {
    next(error);
  }
};

export const deleteCriterion = async (req, res, next) => {
  try {
    const companyId = req.user.companyId || 1;
    await settingsService.softDeleteCriterionService(companyId, req.params.id);
    res.status(200).json({ success: true, message: 'Criterion deactivated successfully' });
  } catch (error) {
    next(error);
  }
};

export const saveCriteriaMatrix = async (req, res, next) => {
  try {
    const companyId = req.user.companyId || 1;
    const updatedMatrix = await settingsService.saveCompanyCriteriaMatrixService(companyId, req.body.criteria);
    res.status(200).json({ success: true, message: 'Qualification criteria matrix saved successfully', data: updatedMatrix });
  } catch (error) {
    next(error);
  }
};

export const updateCompanySettings = async (req, res, next) => {
  try {
    const companyId = req.user.companyId || 1;
    const settings = await settingsService.updateCompanySettingsService(companyId, req.body);
    res.status(200).json({ success: true, message: 'Qualification settings updated successfully', data: settings });
  } catch (error) {
    next(error);
  }
};

export const autoBalanceCriteria = async (req, res, next) => {
  try {
    const companyId = req.user.companyId || 1;
    const currentCriteria = await settingsService.getCompanyCriteriaService(companyId);
    const balanced = settingsService.calculateBalancedWeights(currentCriteria);
    const updated = await settingsService.saveCompanyCriteriaMatrixService(companyId, balanced);
    res.status(200).json({ success: true, message: 'Criteria weights auto-balanced to 100 points', data: updated });
  } catch (error) {
    next(error);
  }
};
