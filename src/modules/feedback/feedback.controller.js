import {
  submitFeedbackService,
  listFeedbacksService,
  getFeedbackDetailsService,
  updateFeedbackStatusService,
  deleteFeedbackService
} from "./feedback.service.js"
import { sendSuccess } from "../../utils/response.js"

export const submitFeedback = async (req, res, next) => {
  try {
    const feedback = await submitFeedbackService(req.body, req.user)
    return sendSuccess(res, { feedback }, "Feedback submitted successfully", 201)
  } catch (err) {
    next(err)
  }
}

export const listFeedbacks = async (req, res, next) => {
  try {
    const feedbacks = await listFeedbacksService()
    return sendSuccess(res, { feedbacks }, "Feedbacks fetched successfully")
  } catch (err) {
    next(err)
  }
}

export const getFeedbackDetails = async (req, res, next) => {
  try {
    const feedback = await getFeedbackDetailsService(req.params.id)
    return sendSuccess(res, { feedback }, "Feedback fetched successfully")
  } catch (err) {
    next(err)
  }
}

export const updateFeedbackStatus = async (req, res, next) => {
  try {
    const feedback = await updateFeedbackStatusService(req.params.id, req.body.status)
    return sendSuccess(res, { feedback }, "Status updated successfully")
  } catch (err) {
    next(err)
  }
}

export const deleteFeedback = async (req, res, next) => {
  try {
    await deleteFeedbackService(req.params.id)
    return sendSuccess(res, null, "Feedback deleted successfully")
  } catch (err) {
    next(err)
  }
}
