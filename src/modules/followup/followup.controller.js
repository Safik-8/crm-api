// src/modules/followup/followup.controller.js

import { sendSuccess } from "../../utils/response.js";
import {
  createFollowupService, getFollowupsService, getFollowupsByLeadService,
  getFollowupByIdService, updateFollowupService, completeFollowupService,
  cancelFollowupService, deleteFollowupService,
} from "./followup.service.js";

export const createFollowup   = async (req, res, next) => { try { return sendSuccess(res, { followup: await createFollowupService(req.body, req.user) }, "Follow-up scheduled", 201); } catch(e){next(e);} };
export const getFollowups     = async (req, res, next) => { try { return sendSuccess(res, await getFollowupsService(req.query, req.user), "Follow-ups fetched"); } catch(e){next(e);} };
export const getFollowupById  = async (req, res, next) => { try { return sendSuccess(res, { followup: await getFollowupByIdService(req.params.id, req.user) }, "Follow-up fetched"); } catch(e){next(e);} };
export const updateFollowup   = async (req, res, next) => { try { return sendSuccess(res, { followup: await updateFollowupService(req.params.id, req.body, req.user) }, "Follow-up updated"); } catch(e){next(e);} };
export const completeFollowup = async (req, res, next) => { try { return sendSuccess(res, { followup: await completeFollowupService(req.params.id, req.body, req.user) }, "Follow-up completed"); } catch(e){next(e);} };
export const cancelFollowup   = async (req, res, next) => { try { return sendSuccess(res, { followup: await cancelFollowupService(req.params.id, req.user) }, "Follow-up cancelled"); } catch(e){next(e);} };
export const deleteFollowup   = async (req, res, next) => { try { return sendSuccess(res, await deleteFollowupService(req.params.id, req.user), "Follow-up deleted"); } catch(e){next(e);} };

// parseInt guard before hitting service (rejects /lead/abc gracefully)
export const getFollowupsByLead = async (req, res, next) => {
  const leadId = parseInt(req.params.leadId, 10);
  if (isNaN(leadId) || leadId < 1)
    return res.status(400).json({ success: false, message: "Invalid lead ID in URL" });
  try {
    return sendSuccess(res, await getFollowupsByLeadService(leadId, req.query, req.user), "Lead follow-ups fetched");
  } catch(e) { next(e); }
};
