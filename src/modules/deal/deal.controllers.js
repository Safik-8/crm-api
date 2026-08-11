import * as dealService from './deal.services.js';
import { sendSuccess } from '../../utils/response.js';

/** GET /api/deals */
export const getDealsList = async (req, res, next) => {
  try {
    const result = await dealService.getDealsList(req.user, req.query);
    return res.status(200).json({
      success    : true,
      statusCode : 200,
      message    : 'Deals fetched successfully',
      data       : result.items,
      pagination : result.pagination,
      timestamp  : new Date().toISOString(),
    });
  } catch (err) { next(err); }
};

/** GET /api/deals/stats */
export const getDealsStats = async (req, res, next) => {
  try {
    const stats = await dealService.getDealsStats(req.user, req.query);
    return sendSuccess(res, stats, 'Deal stats fetched successfully');
  } catch (err) { next(err); }
};

/** GET /api/deals/:id */
export const getDealById = async (req, res, next) => {
  try {
    const deal = await dealService.getDealById(req.user, parseInt(req.params.id));
    return sendSuccess(res, deal, 'Deal details fetched successfully');
  } catch (err) { next(err); }
};
