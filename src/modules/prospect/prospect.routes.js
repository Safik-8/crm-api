import { Router }        from "express"
import {
  createProspect,
  getProspects,
  getProspectById,
  updateProspect,
  transitionStage,
  getLeadSources
} from "./prospect.controller.js"
import { authenticate }  from "../../middleware/authenticate.js"
import { hasPermission } from "../../middleware/hasPermission.js"

const router = Router()

router.use(authenticate)

// GET /api/prospects/lead-sources
router.get("/lead-sources"  , hasPermission("PROSPECT" , "canView") ,getLeadSources)

// POST /api/prospects
router.post("/" , hasPermission("PROSPECT" , "canCreate") , createProspect)

// GET /api/prospects
router.get("/" , hasPermission("PROSPECT" , "canView") , getProspects)

// GET /api/prospects/:id
router.get("/:id"   , hasPermission("PROSPECT" , "canView") , getProspectById)

// PUT /api/prospects/:id
router.put("/:id" , hasPermission("PROSPECT" , "canUpdate") , updateProspect)

// PUT /api/prospects/:id/stage
router.post("/:id/stage" , hasPermission("PROSPECT" , "canUpdate") , transitionStage)

export default router