import { sendSuccess } from "../../utils/response.js"
import {
  assignStagesToPipelineService,
  createPipelineService,
  deletePipelineService,
  getPipelineDetailsService,
  listPipelinesService,
  updatePipelineService,
  updatePipelineStageOrderService
} from "./pipeline.service.js"

export const createPipeline = async (req, res, next) => {
  try {
    const pipeline = await createPipelineService(req.body, req.user)
    return sendSuccess(res, { pipeline }, "Pipeline created successfully", 201)
  } catch (err) {
    next(err)
  }
}

export const listPipelines = async (req, res, next) => {
  try {
    const pipelines = await listPipelinesService(req.query, req.user)
    return sendSuccess(res, { pipelines }, "Pipelines fetched")
  } catch (err) {
    next(err)
  }
}

export const getPipelineDetails = async (req, res, next) => {
  try {
    const pipeline = await getPipelineDetailsService(req.params.id, req.query, req.user)
    return sendSuccess(res, { pipeline }, "Pipeline fetched")
  } catch (err) {
    next(err)
  }
}

export const updatePipeline = async (req, res, next) => {
  try {
    const pipeline = await updatePipelineService(req.params.id, req.body, req.user)
    return sendSuccess(res, { pipeline }, "Pipeline updated successfully")
  } catch (err) {
    next(err)
  }
}

export const deletePipeline = async (req, res, next) => {
  try {
    const pipeline = await deletePipelineService(req.params.id, req.user)
    return sendSuccess(res, { pipeline }, "Pipeline deleted successfully")
  } catch (err) {
    next(err)
  }
}

export const assignStagesToPipeline = async (req, res, next) => {
  try {
    const stages = await assignStagesToPipelineService(req.params.id, req.body, req.user)
    return sendSuccess(res, { stages }, "Stages assigned to pipeline")
  } catch (err) {
    next(err)
  }
}

export const updatePipelineStageOrder = async (req, res, next) => {
  try {
    const stages = await updatePipelineStageOrderService(req.params.id, req.body, req.user)
    return sendSuccess(res, { stages }, "Pipeline stage order updated")
  } catch (err) {
    next(err)
  }
}

