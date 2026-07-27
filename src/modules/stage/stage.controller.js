import { sendSuccess } from "../../utils/response.js"
import {
  createStageService,
  deleteStageService,
  getAllStagesService,
  getAllStagesAdminService,
  getStagesForPipelineService,
  toggleStageStatusService,
  updateStageService
} from "./stage.service.js"


export const createStage = async (req, res, next) => {
  try {
    const stage = await createStageService(req.body, req.user)
    return sendSuccess(res, { stage }, "Stage created successfully", 201)
  } catch (err) {
    next(err)
  }
}

export const getStages = async (req, res, next) => {
  try {
    const stages = await getAllStagesService()
    return sendSuccess(res, { stages }, "Stages fetched")
  } catch (err) {
    next(err)
  }
}

export const updateStage = async (req, res, next) => {
  try {
    const stage = await updateStageService(req.params.id, req.body, req.user)
    return sendSuccess(res, { stage }, "Stage updated successfully")
  } catch (err) {
    next(err)
  }
}

export const deleteStage = async (req, res, next) => {
  try {
    const stage = await deleteStageService(req.params.id, req.user)
    return sendSuccess(res, { stage }, "Stage deleted successfully")
  } catch (err) {
    next(err)
  }
}

// reusable frontend endpoint: returns ordered stages of a pipeline
export const getStagesForPipeline = async (req, res, next) => {
  try {
    const stages = await getStagesForPipelineService(req.params.pipelineId, req.user)
    return sendSuccess(res, { stages }, "Pipeline stages fetched")
  } catch (err) {
    next(err)
  }
}

// Admin view: returns ALL stages incl. INACTIVE (for Pipeline Builder UI)
export const getStagesAdmin = async (req, res, next) => {
  try {
    const stages = await getAllStagesAdminService()
    return sendSuccess(res, { stages }, "All stages fetched (admin)")
  } catch (err) {
    next(err)
  }
}

// Toggle a stage between ACTIVE and INACTIVE
export const toggleStageStatus = async (req, res, next) => {
  try {
    const stage = await toggleStageStatusService(req.params.id, req.body, req.user)
    return sendSuccess(res, { stage }, "Stage status updated")
  } catch (err) {
    next(err)
  }
}
