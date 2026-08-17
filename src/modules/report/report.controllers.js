import * as reportService from './report.service.js';
import { sendSuccess } from '../../utils/response.js';

export const getReportsList = async (req, res, next) => {
  try {
    const systemReports = reportService.getSystemReports(req.user.primaryRole, req.user.primaryRoleRank, req.user.permissions);
    const savedReports = await reportService.getSavedConfigsList(req.user);
    
    return sendSuccess(res, {
      systemReports,
      savedReports
    }, 'Reports fetched successfully');
  } catch (err) {
    next(err);
  }
};

export const generateReport = async (req, res, next) => {
  try {
    // Generate data based on body filters
    const reportData = await reportService.generateReportData(req.user, req.body);
    return sendSuccess(res, reportData, 'Report generated successfully');
  } catch (err) {
    next(err);
  }
};

export const saveConfig = async (req, res, next) => {
  try {
    const savedConfig = await reportService.saveReportConfig(req.user, req.body);
    return sendSuccess(res, savedConfig, 'Report configuration saved successfully', 201);
  } catch (err) {
    next(err);
  }
};

export const updateConfig = async (req, res, next) => {
  try {
    const updatedConfig = await reportService.updateReportConfig(req.user, req.params.id, req.body);
    return sendSuccess(res, updatedConfig, 'Report configuration updated successfully');
  } catch (err) {
    next(err);
  }
};

export const deleteConfig = async (req, res, next) => {
  try {
    await reportService.deleteReportConfig(req.user, req.params.id);
    return sendSuccess(res, null, 'Report configuration deleted successfully');
  } catch (err) {
    next(err);
  }
};
