// src/modules/leadSource/leadSource.routes.js

import { Router }        from "express"
import {
  createLeadSource,
  getLeadSources,
  updateLeadSource,
} from "./leadSource.controller.js"
import { authenticate }  from "../../middleware/Authenticate.js"
import { authorize }     from "../../middleware/authorize.js"

const router = Router()

router.use(authenticate)

// GET /api/lead-sources — all authenticated users
router.get("/",    getLeadSources)

// POST /api/lead-sources — Super Admin or Branch Manager
router.post(
  "/",
  authorize("SUPER_ADMIN", "BRANCH_MANAGER"),
  createLeadSource
)

// PUT /api/lead-sources/:id
router.put(
  "/:id",
  authorize("SUPER_ADMIN", "BRANCH_MANAGER"),
  updateLeadSource
)


export default router
