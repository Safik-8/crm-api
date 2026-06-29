import { Router } from "express"
import { authenticate } from "../../middleware/Authenticate.js"
import { hasPermission } from "../../middleware/hasPermission.js"
import { createStage, deleteStage, getStages, getStagesForPipeline, updateStage } from "./stage.controller.js"

const router = Router()

router.use(authenticate)

// stage master (stages are part of pipeline module permissions)
router.post("/", hasPermission("PIPELINE", "canCreate"), createStage)
router.get("/", hasPermission("PIPELINE", "canView"), getStages)
router.put("/:id", hasPermission("PIPELINE", "canEdit"), updateStage)
router.delete("/:id", hasPermission("PIPELINE", "canDelete"), deleteStage)

// frontend reusable: get assigned stages for a pipeline (ordered)
router.get("/pipeline/:pipelineId", hasPermission("PIPELINE", "canView"), getStagesForPipeline)

export default router

