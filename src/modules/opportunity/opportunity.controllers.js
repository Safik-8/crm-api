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
    const stages = await opportunityService.getOpportunityStagesService(req.user);
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
