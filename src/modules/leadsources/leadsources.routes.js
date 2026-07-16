// src/modules/leadsources/leadsources.routes.js

import { Router } from "express"
import { authenticate }  from "../../middleware/Authenticate.js"
import { hasPermission } from "../../middleware/hasPermission.js"
import {
  createLeadSource,
  getLeadSources,
  updateLeadSource,
  toggleLeadSourceStatus
} from "./leadsources.controllers.js"
import {
  createLeadSourceSchema,
  updateLeadSourceSchema,
  validateBody
} from "./leadsources.validation.js"

const router = Router()
router.use(authenticate)

router.get(
  "/",
  hasPermission("LEAD_SOURCE", "canView"),
  getLeadSources
)

router.post(
  "/",
  hasPermission("LEAD_SOURCE", "canCreate"),
  validateBody(createLeadSourceSchema),
  createLeadSource
)

router.put(
  "/:id",
  hasPermission("LEAD_SOURCE", "canEdit"),
  validateBody(updateLeadSourceSchema),
  updateLeadSource
)

router.patch(
  "/:id/toggle-status",
  hasPermission("LEAD_SOURCE", "canEdit"),
  toggleLeadSourceStatus
)

export default router
