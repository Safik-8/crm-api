// src/modules/leadSource/leadSource.routes.js

import { Router }        from "express"
import {
  createLeadSource,
  getLeadSources,
  getLeadSourceById,
  updateLeadSource,
} from "./leadSource.controller.js"
import { authenticate }  from "../../middleware/authorize.js"
import { authorize }     from "../../middleware/authorize.js"

const router = Router()

router.use(authenticate)

// GET /api/lead-sources — all authenticated users
router.get("/",    getLeadSources)

// GET /api/lead-sources/:id
router.get("/:id", getLeadSourceById)

// POST /api/lead-sources — Super Admin or Branch Admin
router.post(
  "/",
  authorize("SUPER_ADMIN", "BRANCH_ADMIN"),
  createLeadSource
)

// PUT /api/lead-sources/:id
router.put(
  "/:id",
  authorize("SUPER_ADMIN", "BRANCH_ADMIN"),
  updateLeadSource
)


export default router