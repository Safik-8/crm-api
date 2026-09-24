import {
  createFeedbackRecord,
  findAllFeedbacks,
  findFeedbackById,
  updateFeedbackById,
  deleteFeedbackById
} from "./feedback.repository.js"
import { NotFoundError } from "../../utils/AppError.js"

export const submitFeedbackService = async (data, user) => {
  const payload = {
    title: data.title,
    description: data.description,
    category: data.category || "BUG",
    priority: data.priority || "NORMAL",
    status: "NEW",
    pageUrl: data.pageUrl || null,
    attachmentUrl: data.attachmentUrl || null,
    userId: user.id,
    companyId: user.companyId || user.company?.id || null,
    branchId: user.branchId || user.branch?.id || null
  }

  return createFeedbackRecord(payload)
}

export const listFeedbacksService = async () => {
  return findAllFeedbacks()
}

export const getFeedbackDetailsService = async (id) => {
  const feedback = await findFeedbackById(id)
  if (!feedback) {
    throw new NotFoundError("Feedback")
  }
  return feedback
}

export const updateFeedbackStatusService = async (id, status) => {
  const existing = await findFeedbackById(id)
  if (!existing) {
    throw new NotFoundError("Feedback")
  }

  return updateFeedbackById(id, { status })
}

export const deleteFeedbackService = async (id) => {
  const existing = await findFeedbackById(id)
  if (!existing) {
    throw new NotFoundError("Feedback")
  }

  return deleteFeedbackById(id)
}
