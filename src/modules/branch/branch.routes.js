// src/modules/branch/branch.routes.js

import { Router } from "express"
import {
  createBranch,
  getBranches,
  getBranchById,
  updateBranch,
  assignUserToBranch,
  getBranchesPaginated
} from "./branch.controllers.js"
import {
  createBranchSchema,
  updateBranchSchema,
  assignUserSchema,
  validateBody
} from "./branch.validation.js"
import { authenticate } from "../../middleware/Authenticate.js"
import { hasPermission } from "../../middleware/hasPermission.js"

const router = Router()

// All routes in this module require JWT authentication
router.use(authenticate)

// POST /api/branches — create/onboard a new branch
router.post(
  "/",
  hasPermission("BRANCH", "canCreate"),
  validateBody(createBranchSchema),
  createBranch
)

// GET /api/branches — raw list (useful for dropdowns)
router.get(
  "/",
  hasPermission("BRANCH", "canView"),
  getBranches
)

// GET /api/branches/paginated — paginated/filtered list (useful for tables)
router.get(
  "/paginated",
  hasPermission("BRANCH", "canView"),
  getBranchesPaginated
)

// GET /api/branches/:id — fetch single branch details
router.get(
  "/:id",
  hasPermission("BRANCH", "canView"),
  getBranchById
)

// PUT /api/branches/:id — update name or status
router.put(
  "/:id",
  hasPermission("BRANCH", "canEdit"),
  validateBody(updateBranchSchema),
  updateBranch
)

// POST /api/branches/:id/assign-user — onboard manager or BDE/ISE
router.post(
  "/:id/assign-user",
  hasPermission("BRANCH", "canEdit"),
  validateBody(assignUserSchema),
  assignUserToBranch
)

export default router