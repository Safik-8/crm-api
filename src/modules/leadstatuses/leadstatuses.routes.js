// src/modules/leadstatuses/leadstatuses.routes.js
import { Router } from "express"
import { authenticate }  from "../../middleware/Authenticate.js"
import { hasPermission } from "../../middleware/hasPermission.js"
import {
  createLeadStatus, getLeadStatuses, updateLeadStatus,
  toggleLeadStatus, deleteLeadStatus, reorderLeadStatuses,
} from "./leadstatuses.controllers.js"
import {
  createLeadStatusSchema, updateLeadStatusSchema,
  reorderLeadStatusesSchema, validateBody,
} from "./leadstatuses.validation.js"

const router = Router()
router.use(authenticate)

// CRITICAL: /reorder MUST come before /:id routes to avoid Express param collision
router.patch("/reorder",           hasPermission("LEAD_STATUS", "canEdit"),   validateBody(reorderLeadStatusesSchema), reorderLeadStatuses)
router.get("/",                    hasPermission("LEAD_STATUS", "canView"),                                              getLeadStatuses)
router.post("/",                   hasPermission("LEAD_STATUS", "canCreate"), validateBody(createLeadStatusSchema),     createLeadStatus)
router.put("/:id",                 hasPermission("LEAD_STATUS", "canEdit"),   validateBody(updateLeadStatusSchema),     updateLeadStatus)
router.patch("/:id/toggle-status", hasPermission("LEAD_STATUS", "canEdit"),                                              toggleLeadStatus)
router.delete("/:id",              hasPermission("LEAD_STATUS", "canDelete"),                                            deleteLeadStatus)

export default router
