import { sendSuccess } from "../../utils/response.js"
import {
  addLeadCommentService,
  createLeadService,
  getBranchUsersForLeadService,
  getLeadCommentsService,
  getLeadsService,
  updateLeadStageService
} from "./lead.service.js"

export const getBranchUsersForLead = async (req, res, next) => {
  try {
    const users = await getBranchUsersForLeadService(req.user)
    return sendSuccess(res, { users }, "Branch users fetched")
  } catch (err) {
    next(err)
  }
}

export const createLead = async (req, res, next) => {
  try {
    const lead = await createLeadService(req.body, req.user)
    return sendSuccess(res, { lead }, "Lead created successfully", 201)
  } catch (err) {
    next(err)
  }
}

export const getLeads = async (req, res, next) => {
  try {
    const result = await getLeadsService(req.query, req.user)
    return sendSuccess(res, result, "Leads fetched")
  } catch (err) {
    next(err)
  }
}

export const updateLeadStage = async (req, res, next) => {
  try {
    const lead = await updateLeadStageService(req.params.id, req.body, req.user)
    return sendSuccess(res, { lead }, "Lead stage updated")
  } catch (err) {
    next(err)
  }
}

export const addLeadComment = async (req, res, next) => {
  try {
    const comment = await addLeadCommentService(req.params.id, req.body, req.user)
    return sendSuccess(res, { comment }, "Comment added", 201)
  } catch (err) {
    next(err)
  }
}

export const getLeadComments = async (req, res, next) => {
  try {
    const comments = await getLeadCommentsService(req.params.id, req.user)
    return sendSuccess(res, { comments }, "Comments fetched")
  } catch (err) {
    next(err)
  }
}

