// src/modules/lead/lead.controllers.js

import { sendSuccess } from "../../utils/response.js";
import {
  getBranchUsersForLeadService,
  getLeadFormDataService,
  createLeadService,
  getLeadsService,
  getLeadByIdService,
  updateLeadService,
  deleteLeadService,
  updateLeadStageService,
  addLeadCommentService,
  getLeadCommentsService,
  importLeadsFromExcelService
} from "./lead.services.js";
import { uploadExcel } from "./lead.upload.js";

export const getBranchUsersForLead = async (req, res, next) => {
  try {
    const users = await getBranchUsersForLeadService(req.user);
    return sendSuccess(res, { users }, "Branch users fetched");
  } catch (err) {
    next(err);
  }
};

export const getLeadFormData = async (req, res, next) => {
  try {
    const formData = await getLeadFormDataService(req.user, req.query);
    return sendSuccess(res, formData, "Lead form data fetched");
  } catch (err) {
    next(err);
  }
};

export const createLead = async (req, res, next) => {
  try {
    const lead = await createLeadService(req.body, req.user);
    return sendSuccess(res, { lead }, "Lead created successfully", 201);
  } catch (err) {
    next(err);
  }
};

export const getLeads = async (req, res, next) => {
  try {
    const result = await getLeadsService(req.query, req.user);
    return sendSuccess(res, result, "Leads fetched");
  } catch (err) {
    next(err);
  }
};

export const getLeadById = async (req, res, next) => {
  try {
    const lead = await getLeadByIdService(req.params.id, req.user);
    return sendSuccess(res, { lead }, "Lead fetched");
  } catch (err) {
    next(err);
  }
};

export const updateLead = async (req, res, next) => {
  try {
    const lead = await updateLeadService(req.params.id, req.body, req.user);
    return sendSuccess(res, { lead }, "Lead updated successfully");
  } catch (err) {
    next(err);
  }
};

export const deleteLead = async (req, res, next) => {
  try {
    const lead = await deleteLeadService(req.params.id, req.user);
    return sendSuccess(res, { lead }, "Lead deleted successfully");
  } catch (err) {
    next(err);
  }
};

export const updateLeadStage = async (req, res, next) => {
  try {
    const lead = await updateLeadStageService(req.params.id, req.body, req.user);
    return sendSuccess(res, { lead }, "Lead stage updated");
  } catch (err) {
    next(err);
  }
};

export const addLeadComment = async (req, res, next) => {
  try {
    const comment = await addLeadCommentService(req.params.id, req.body, req.user);
    return sendSuccess(res, { comment }, "Comment added", 201);
  } catch (err) {
    next(err);
  }
};

export const getLeadComments = async (req, res, next) => {
  try {
    const comments = await getLeadCommentsService(req.params.id, req.user);
    return sendSuccess(res, { comments }, "Comments fetched");
  } catch (err) {
    next(err);
  }
};

export const importLeadsFromExcel = (req, res, next) => {
  uploadExcel(req, res, async (err) => {
    if (err) return next(err);
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file uploaded. Send the Excel file as form-data field named 'file'."
        });
      }
      const result = await importLeadsFromExcelService(req.file.buffer, req.body.pipelineId, req.user);
      return sendSuccess(res, result, `Import complete. ${result.created} lead(s) created, ${result.skipped} skipped.`, 200);
    } catch (e) {
      next(e);
    }
  });
};
