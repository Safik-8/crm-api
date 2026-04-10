// src/modules/branch/branch.routes.js

import { Router } from "express"
import {
    createBranch,
    getBranches,
    getBranchById,
    updateBranch,
    assignUserToBranch
} from "./branch.controllers.js"
import { authenticate } from "../../middleware/Authenticate.js"
import { authorize } from "../../middleware/authorize.js"
import { hasPermission } from "../../middleware/hasPermission.js"

const router = Router()

router.use(authenticate)

// POST /api/branches
router.post(
    "/",
    authorize("SUPER_ADMIN", "BRANCH_ADMIN"),
    hasPermission("BRANCH", "canCreate"),
    createBranch
)

// GET /api/branches?company_id=X
router.get(
    "/",
    hasPermission("BRANCH", "canView"),
    getBranches
)

// GET /api/branches/:id
router.get(
    "/:id",
    hasPermission("BRANCH", "canView"),
    getBranchById
)

// PUT /api/branches/:id
router.put(
    "/:id",
    authorize("SUPER_ADMIN", "BRANCH_ADMIN"),
    hasPermission("BRANCH", "canEdit"),
    updateBranch
)

// POST /api/branches/:id/assign-user
router.post(
    "/:id/assign-user",
    authorize("SUPER_ADMIN", "BRANCH_ADMIN"),
    hasPermission("BRANCH", "canEdit"),
    assignUserToBranch
)

export default router;