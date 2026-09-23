import * as opportunityService from './opportunity.services.js';
import { sendSuccess } from '../../utils/response.js';
import { ValidationError } from '../../utils/AppError.js';

/**
 * Controller: Create Opportunity
 */
export const createOpportunity = async (req, res, next) => {
  try {
    const opportunity = await opportunityService.createOpportunity(req.user, req.body, req);
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
    const opportunity = await opportunityService.updateOpportunity(req.user, id, req.body, req);
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
    const opportunity = await opportunityService.closeOpportunity(req.user, id, req.body, req);
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

export const getWinLossReasons = async (req, res, next) => {
  try {
    const companyId = req.query.companyId ? parseInt(req.query.companyId) : undefined;
    const reasons = await opportunityService.getWinLossReasonsService(req.user, companyId);
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Win/Loss reasons fetched successfully',
      data: reasons,
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
    const opportunity = await opportunityService.moveOpportunityStage(req.user, id, req.body, req);
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

/**
 * Controller: Close pipeline lead and auto-create opportunity
 * Triggered when ISE (or authorized user) drags a lead to CLOSURE on Kanban board
 */
export const closePipelineLeadAndCreateOpportunity = async (req, res, next) => {
  try {
    const leadId = Number(req.params.leadId);
    if (!leadId || isNaN(leadId)) {
      return res.status(400).json({ success: false, message: 'Invalid lead ID' });
    }
    const result = await opportunityService.createOpportunityFromClosure(
      req.user,
      { ...req.body, leadId },
      req
    );
    return sendSuccess(res, result, 'Lead closed and opportunity created successfully', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Controller: Qualify Opportunity
 * Computes a priority score (0-100%) from company criteria and saves it on the opportunity.
 * Does NOT touch the Lead qualification tables.
 */
export const qualifyOpportunity = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (!id || isNaN(id)) {
      throw new ValidationError('Invalid opportunity ID');
    }
    const result = await opportunityService.qualifyOpportunityService(id, req.body, req.user, req);
    return sendSuccess(res, result, `Opportunity qualification score saved: ${result.score}%`, 200);
  } catch (error) {
    next(error);
  }
};


