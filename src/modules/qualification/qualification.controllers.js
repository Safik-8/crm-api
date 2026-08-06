import { evaluateLeadService, getLeadHistoryService } from './qualification.services.js';
import { saveQualificationSchema } from './qualification.validation.js';
import { sendSuccess } from '../../utils/response.js';

export const evaluateLead = async (req, res, next) => {
  try {
    const { id: leadId } = req.params;
    const data = saveQualificationSchema.parse(req.body);
    const actor = req.user;

    const result = await evaluateLeadService(leadId, data, actor);

    return sendSuccess(res, result, 'Lead qualification evaluated successfully');
  } catch (error) {
    next(error);
  }
};

export const getLeadHistory = async (req, res, next) => {
  try {
    const { id: leadId } = req.params;
    const actor = req.user;

    const result = await getLeadHistoryService(leadId, actor);

    return sendSuccess(res, result, 'Qualification history fetched successfully');
  } catch (error) {
    next(error);
  }
};
