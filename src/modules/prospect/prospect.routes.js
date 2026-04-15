import { Router }        from "express"
import {
  createProspect,
  getProspects,
  getProspectById,
  updateProspect,
  transitionStage,
} from "./prospect.controller.js"
import { authenticate }  from "../../middleware/Authenticate.js"
import { hasPermission } from "../../middleware/hasPermission.js"

const router = Router()

router.use(authenticate)

// POST /api/prospects
router.post("/" , hasPermission("PROSPECT" , "canCreate") , createProspect)

// GET /api/prospects
router.get("/all" , hasPermission("PROSPECT" , "canView") , getProspects)

// GET /api/prospects/:id
router.get("/:id"   , hasPermission("PROSPECT" , "canView") , getProspectById)

// PUT /api/prospects/:id
router.put("/:id" , hasPermission("PROSPECT" , "canEdit") , updateProspect)

// POST /api/prospects/:id/stage
router.post("/:id/stage" , hasPermission("PROSPECT" , "canEdit") , transitionStage)

export default router