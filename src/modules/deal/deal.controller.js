import * as dealService from './deal.service.js';
import { sendSuccess } from '../../utils/response.js';

export const getDealsList = async (req, res, next) => {
  try {
    const result = await dealService.getDealsList(req.user, req.query);
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Deals fetched successfully',
      data: result.items,
      pagination: result.pagination,
      stats: result.stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

export const getDealById = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const deal = await dealService.getDealById(req.user, id);
    return sendSuccess(res, deal, 'Deal details fetched successfully', 200);
  } catch (error) {
    next(error);
  }
};
