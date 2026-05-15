import { Router } from "express"
import { authenticate } from "../../middleware/Authenticate.js"
import { hasPermission } from "../../middleware/hasPermission.js"
import {
  addLeadComment,
  createLead,
  getBranchUsersForLead,
  getLeadComments,
  getLeads,
  updateLeadStage
} from "./lead.controller.js"

const router = Router()

router.use(authenticate)

// Dropdown — must be before /:id routes to avoid param conflict
router.get("/branch-users", hasPermission("LEAD", "canCreate"), getBranchUsersForLead)

router.post("/", hasPermission("LEAD", "canCreate"), createLead)
router.get("/", hasPermission("LEAD", "canView"), getLeads)

// stage updates
router.patch("/:id/stage", hasPermission("LEAD", "canEdit"), updateLeadStage)

// comments
router.post("/:id/comments", hasPermission("ACTIVITY", "canCreate"), addLeadComment)
router.get("/:id/comments", hasPermission("ACTIVITY", "canView"), getLeadComments)

export default router

