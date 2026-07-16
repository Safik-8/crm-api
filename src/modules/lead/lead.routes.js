// src/modules/lead/lead.routes.js

import { Router } from "express";
import { authenticate } from "../../middleware/Authenticate.js";
import { hasPermission } from "../../middleware/hasPermission.js";
import {
  getBranchUsersForLead,
  getLeadFormData,
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  deleteLead,
  updateLeadStage,
  addLeadComment,
  getLeadComments,
  importLeadsFromExcel,
  restoreLead,
  getLeadNotes,
  createLeadNote,
  updateLeadNote,
  deleteLeadNote,
  getLeadTimeline
} from "./lead.controllers.js";
import {
  createLeadSchema,
  updateLeadSchema,
  updateLeadStageSchema,
  addCommentSchema,
  validateBody
} from "./lead.validation.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ── Dropdown helpers — must be registered BEFORE /:id routes ─────────────────
router.get("/branch-users", hasPermission("LEAD", "canCreate"), getBranchUsersForLead);
router.get("/form-data",    hasPermission("LEAD", "canCreate"), getLeadFormData);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.post(  "/",    hasPermission("LEAD", "canCreate"), validateBody(createLeadSchema), createLead);
router.get(   "/",    hasPermission("LEAD", "canView"),   getLeads);
router.get(   "/:id", hasPermission("LEAD", "canView"),   getLeadById);
router.put(   "/:id", hasPermission("LEAD", "canEdit"),   validateBody(updateLeadSchema), updateLead);
router.delete("/:id", hasPermission("LEAD", "canDelete"), deleteLead);

// ── Lead Restore (Reopen soft-deleted lead) ──────────────────────────────────
router.patch("/:id/restore", hasPermission("LEAD", "canDelete"), restoreLead);

// ── Notes CRUD ────────────────────────────────────────────────────────────────
router.get(   "/:id/notes",         hasPermission("LEAD", "canView"), getLeadNotes);
router.post(  "/:id/notes",         hasPermission("LEAD", "canEdit"), createLeadNote);
router.put(   "/:id/notes/:noteId", hasPermission("LEAD", "canEdit"), updateLeadNote);
router.delete("/:id/notes/:noteId", hasPermission("LEAD", "canEdit"), deleteLeadNote);

// ── Timeline ──────────────────────────────────────────────────────────────────
router.get("/:id/timeline", hasPermission("LEAD", "canView"), getLeadTimeline);

// ── Bulk Excel import ─────────────────────────────────────────────────────────
router.post("/import-excel", hasPermission("LEAD", "canCreate"), importLeadsFromExcel);

// ── Kanban stage update (drag-drop) ──────────────────────────────────────────
router.patch("/:id/stage", hasPermission("LEAD", "canEdit"), validateBody(updateLeadStageSchema), updateLeadStage);

// ── Comments ──────────────────────────────────────────────────────────────────
router.post("/:id/comments", hasPermission("ACTIVITY", "canCreate"), validateBody(addCommentSchema), addLeadComment);
router.get( "/:id/comments", hasPermission("ACTIVITY", "canView"),   getLeadComments);

export default router;
