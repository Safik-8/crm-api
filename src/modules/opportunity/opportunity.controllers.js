import * as opportunityService from './opportunity.services.js';
import { sendSuccess } from '../../utils/response.js';

/**
 * Controller: Create Opportunity
 */
export const createOpportunity = async (req, res, next) => {
  try {
    const opportunity = await opportunityService.createOpportunity(req.user, req.body);
    return sendSuccess(res, opportunity, 'Opportunity created successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Get Single Opportunity Detail
 */
export const getOpportunityById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const opportunity = await opportunityService.getOpportunityById(req.user, id);
    return sendSuccess(res, opportunity, 'Opportunity details fetched successfully', 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Update Opportunity
 */
export const updateOpportunity = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const opportunity = await opportunityService.updateOpportunity(req.user, id, req.body);
    return sendSuccess(res, opportunity, 'Opportunity updated successfully', 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Close Opportunity (Won / Lost / Cancelled)
 */
export const closeOpportunity = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const opportunity = await opportunityService.closeOpportunity(req.user, id, req.body);
    return sendSuccess(res, opportunity, `Opportunity closed as ${req.body.outcome}`, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: List Paginated Opportunities
 */
export const getOpportunitiesList = async (req, res, next) => {
  try {
    const result = await opportunityService.getOpportunitiesList(req.user, req.query);
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Opportunities list fetched successfully',
      data: result.items,
      pagination: result.pagination,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

export const getOpportunityStages = async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const companyId = req.query.companyId ? parseInt(req.query.companyId) : undefined;
    const stages = await opportunityService.getOpportunityStagesService(req.user, includeInactive, companyId);
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Opportunity stages fetched successfully',
      data: stages,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Create Opportunity Stage
 */
export const createOpportunityStage = async (req, res, next) => {
  try {
    const stage = await opportunityService.createOpportunityStage(req.user, req.body);
    return res.status(201).json({
      success: true,
      statusCode: 201,
      message: 'Opportunity stage created successfully',
      data: stage,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Update Opportunity Stage
 */
export const updateOpportunityStage = async (req, res, next) => {
  try {
    const id = parseInt(req.params.stageId);
    const stage = await opportunityService.updateOpportunityStage(req.user, id, req.body);
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Opportunity stage updated successfully',
      data: stage,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Toggle Opportunity Stage status
 */
export const toggleOpportunityStage = async (req, res, next) => {
  try {
    const id = parseInt(req.params.stageId);
    const status = req.body.status;
    const companyId = req.body.companyId ? parseInt(req.body.companyId) : (req.query.companyId ? parseInt(req.query.companyId) : undefined);
    const stage = await opportunityService.toggleOpportunityStage(req.user, id, status, companyId);
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: `Opportunity stage status updated to ${status}`,
      data: stage,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Delete Opportunity Stage
 */
export const deleteOpportunityStage = async (req, res, next) => {
  try {
    const id = parseInt(req.params.stageId);
    const companyId = req.query.companyId ? parseInt(req.query.companyId) : (req.body.companyId ? parseInt(req.body.companyId) : undefined);
    await opportunityService.deleteOpportunityStage(req.user, id, companyId);
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Opportunity stage deleted successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Bulk Update Opportunity Stages
 */
export const bulkUpdateOpportunityStages = async (req, res, next) => {
  try {
    const result = await opportunityService.bulkUpdateOpportunityStagesService(req.user, req.body);
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Opportunity stages bulk updated successfully',
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller: Move Opportunity Stage
 */
export const moveOpportunityStage = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const opportunity = await opportunityService.moveOpportunityStage(req.user, id, req.body);
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Opportunity stage updated successfully',
      data: opportunity,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

