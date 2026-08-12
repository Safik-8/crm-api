import * as proposalService from './proposal.services.js';
import { sendSuccess } from '../../utils/response.js';

export const createProposal = async (req, res, next) => {
  try {
    const proposal = await proposalService.createProposal(req.user, req.body);
    return sendSuccess(res, proposal, 'Proposal created successfully', 201);
  } catch (err) { next(err); }
};

export const getProposalsList = async (req, res, next) => {
  try {
    const result = await proposalService.getProposalsList(req.user, req.query);
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: 'Proposals fetched successfully',
      data: result.items,
      pagination: result.pagination,
      timestamp: new Date().toISOString()
    });
  } catch (err) { next(err); }
};

export const getProposalById = async (req, res, next) => {
  try {
    const proposal = await proposalService.getProposalById(req.user, req.params.id);
    return sendSuccess(res, proposal, 'Proposal details fetched successfully');
  } catch (err) { next(err); }
};

export const updateProposal = async (req, res, next) => {
  try {
    const proposal = await proposalService.updateProposal(req.user, req.params.id, req.body);
    return sendSuccess(res, proposal, 'Proposal revised successfully');
  } catch (err) { next(err); }
};

export const updateProposalStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const proposal = await proposalService.updateProposalStatus(req.user, req.params.id, status);
    return sendSuccess(res, proposal, `Proposal status updated to ${status} successfully`);
  } catch (err) { next(err); }
};

export const deleteProposal = async (req, res, next) => {
  try {
    await proposalService.deleteProposal(req.user, req.params.id);
    return sendSuccess(res, null, 'Proposal deleted successfully');
  } catch (err) { next(err); }
};
