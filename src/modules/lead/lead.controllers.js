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
  importLeadsFromExcelService,
  getLeadImportLogsService,
  getImportErrorsCsvService
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
          message: "No file uploaded. Send the file as form-data field named 'file'."
        });
      }
      const preview = req.query.preview === "true" || req.body.preview === "true";
      const result = await importLeadsFromExcelService(
        req.file.buffer,
        req.body.pipelineId,
        req.user,
        !preview,
        req.file.originalname,
        req.body.companyId ? Number(req.body.companyId) : null,
        req.body.branchId ? Number(req.body.branchId) : null
      );
      const msg = preview ? "Preview generated successfully" : "Import completed successfully";
      return sendSuccess(res, result, msg, 200);
    } catch (e) {
      next(e);
    }
  });
};

export const getLeadImportLogs = async (req, res, next) => {
  try {
    const logs = await getLeadImportLogsService(req.user);
    return sendSuccess(res, { logs }, "Lead import logs fetched successfully");
  } catch (err) {
    next(err);
  }
};

export const downloadImportErrors = async (req, res, next) => {
  try {
    const csv = await getImportErrorsCsvService(req.params.id, req.user);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=lead_import_errors_${req.params.id}.csv`);
    return res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
};

