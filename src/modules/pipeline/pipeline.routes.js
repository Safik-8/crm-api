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
import {
  assignStagesSchema,
  createPipelineSchema,
  updatePipelineSchema,
  updatePipelineStageOrderSchema,
  validateBody
} from "./pipeline.validation.js"

const router = Router()

router.use(authenticate)

router.post("/", hasPermission("PIPELINE", "canCreate"), validateBody(createPipelineSchema), createPipeline)
router.get("/", hasPermission("PIPELINE", "canView"), listPipelines)
router.get("/:id", hasPermission("PIPELINE", "canView"), getPipelineDetails)
router.put("/:id", hasPermission("PIPELINE", "canEdit"), validateBody(updatePipelineSchema), updatePipeline)
router.delete("/:id", hasPermission("PIPELINE", "canDelete"), deletePipeline)

// core logic: assign stages and ordering
router.post("/:id/stages", hasPermission("PIPELINE", "canEdit"), validateBody(assignStagesSchema), assignStagesToPipeline)
router.put("/:id/stages/order", hasPermission("PIPELINE", "canEdit"), validateBody(updatePipelineStageOrderSchema), updatePipelineStageOrder)

export default router
