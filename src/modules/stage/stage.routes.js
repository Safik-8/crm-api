import { Router } from "express"
import { authenticate } from "../../middleware/Authenticate.js"
import { hasPermission } from "../../middleware/hasPermission.js"
import {
  createStage,
  deleteStage,
  getStages,
  getStagesAdmin,
  getStagesForPipeline,
  toggleStageStatus,
  updateStage
} from "./stage.controller.js"
import {
  createStageSchema,
  updateStageSchema,
  toggleStageStatusSchema,
  validateBody
} from "./stage.validation.js"

const router = Router()

router.use(authenticate)

// ── CRITICAL: Static routes MUST come before /:id to prevent shadowing ────────

// Admin view: all stages incl. INACTIVE (for Pipeline Builder)
// MUST be registered before /:id or Express will match "admin" as id param
router.get("/admin/all", hasPermission("PIPELINE", "canView"), getStagesAdmin)

// frontend reusable: get assigned stages for a pipeline (ordered)
router.get("/pipeline/:pipelineId", hasPermission("PIPELINE", "canView"), getStagesForPipeline)

// ── Stage CRUD ─────────────────────────────────────────────────────────────────

router.post("/",    hasPermission("PIPELINE", "canCreate"), validateBody(createStageSchema), createStage)
router.get("/",     hasPermission("PIPELINE", "canView"),   getStages)
router.put("/:id",  hasPermission("PIPELINE", "canEdit"),   validateBody(updateStageSchema), updateStage)
router.delete("/:id", hasPermission("PIPELINE", "canDelete"), deleteStage)

// Toggle stage ACTIVE / INACTIVE
router.patch("/:id/status", hasPermission("PIPELINE", "canEdit"), validateBody(toggleStageStatusSchema), toggleStageStatus)

export default router
