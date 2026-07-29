// src/modules/followup/followup.routes.js

import { Router } from "express";
import { authenticate }  from "../../middleware/Authenticate.js";
import { hasPermission } from "../../middleware/hasPermission.js";
import { createFollowupSchema, updateFollowupSchema, completeFollowupSchema, validateBody } from "./followup.validation.js";
import { createFollowup, getFollowups, getFollowupsByLead, getFollowupById, updateFollowup, completeFollowup, cancelFollowup, deleteFollowup } from "./followup.controller.js";

const router = Router();
router.use(authenticate);

// CRITICAL: /lead/:leadId MUST be before /:id to avoid route collision
router.get(   "/lead/:leadId",  hasPermission("FOLLOWUP", "canView"),   getFollowupsByLead);
router.post(  "/",              hasPermission("FOLLOWUP", "canCreate"), validateBody(createFollowupSchema),   createFollowup);
router.get(   "/",              hasPermission("FOLLOWUP", "canView"),   getFollowups);
router.get(   "/:id",           hasPermission("FOLLOWUP", "canView"),   getFollowupById);
router.patch( "/:id",           hasPermission("FOLLOWUP", "canEdit"),   validateBody(updateFollowupSchema),   updateFollowup);
router.patch( "/:id/complete",  hasPermission("FOLLOWUP", "canEdit"),   validateBody(completeFollowupSchema), completeFollowup);
router.patch( "/:id/cancel",    hasPermission("FOLLOWUP", "canEdit"),   cancelFollowup);
router.delete("/:id",           hasPermission("FOLLOWUP", "canDelete"), deleteFollowup);

export default router;
