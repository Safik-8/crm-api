import { Router } from "express"
import { authenticate } from "../../middleware/Authenticate.js"
import { hasPermission } from "../../middleware/hasPermission.js"
import { createStage, deleteStage, getStages, getStagesForPipeline, updateStage } from "./stage.controller.js"

const router = Router()

router.use(authenticate)

// stage master
router.post("/", hasPermission("STAGE", "canCreate"), createStage)
router.get("/", hasPermission("STAGE", "canView"), getStages)
router.put("/:id", hasPermission("STAGE", "canEdit"), updateStage)
router.delete("/:id", hasPermission("STAGE", "canDelete"), deleteStage)

// frontend reusable: get assigned stages for a pipeline (ordered)
router.get("/pipeline/:pipelineId", hasPermission("PIPELINE", "canView"), getStagesForPipeline)

export default router

