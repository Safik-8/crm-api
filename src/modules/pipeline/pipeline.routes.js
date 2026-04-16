import { Router } from "express"
import { authenticate } from "../../middleware/Authenticate.js"
import { hasPermission } from "../../middleware/hasPermission.js"
import {
  assignStagesToPipeline,
  createPipeline,
  deletePipeline,
  getPipelineDetails,
  listPipelines,
  updatePipeline,
  updatePipelineStageOrder
} from "./pipeline.controller.js"

const router = Router()

router.use(authenticate)

router.post("/", hasPermission("PIPELINE", "canCreate"), createPipeline)
router.get("/", hasPermission("PIPELINE", "canView"), listPipelines)
router.get("/:id", hasPermission("PIPELINE", "canView"), getPipelineDetails)
router.put("/:id", hasPermission("PIPELINE", "canEdit"), updatePipeline)
router.delete("/:id", hasPermission("PIPELINE", "canDelete"), deletePipeline)

// core logic: assign stages (includes prospect) and ordering
router.post("/:id/stages", hasPermission("PIPELINE", "canEdit"), assignStagesToPipeline)
router.put("/:id/stages/order", hasPermission("PIPELINE", "canEdit"), updatePipelineStageOrder)

export default router

