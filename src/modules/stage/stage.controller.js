import { sendSuccess } from "../../utils/response.js"
import {
  createStageService,
  deleteStageService,
  getAllStagesService,
  getStagesForPipelineService,
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

