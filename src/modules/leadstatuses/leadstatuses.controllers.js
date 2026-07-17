// src/modules/leadstatuses/leadstatuses.controllers.js
import {
  createLeadStatusService, getLeadStatusesService, updateLeadStatusService,
  toggleLeadStatusService, deleteLeadStatusService, reorderLeadStatusesService,
} from "./leadstatuses.services.js"
import { sendSuccess } from "../../utils/response.js"

export const createLeadStatus = async (req, res, next) => {
  try {
    const status = await createLeadStatusService(req.body, req.user)
    return sendSuccess(res, { status }, "Lead status created successfully", 201)
  } catch (err) { next(err) }
}

export const getLeadStatuses = async (req, res, next) => {
  try {
    const statuses = await getLeadStatusesService(req.query, req.user)
    return sendSuccess(res, { statuses }, "Lead statuses fetched")
  } catch (err) { next(err) }
}

export const updateLeadStatus = async (req, res, next) => {
  try {
    const status = await updateLeadStatusService(req.params.id, req.body, req.user)
    return sendSuccess(res, { status }, "Lead status updated successfully")
  } catch (err) { next(err) }
}

export const toggleLeadStatus = async (req, res, next) => {
  try {
    const status = await toggleLeadStatusService(req.params.id, req.user)
    return sendSuccess(res, { status }, "Lead status toggled successfully")
  } catch (err) { next(err) }
}

export const deleteLeadStatus = async (req, res, next) => {
  try {
    await deleteLeadStatusService(req.params.id, req.user)
    return sendSuccess(res, null, "Lead status deleted successfully")
  } catch (err) { next(err) }
}

export const reorderLeadStatuses = async (req, res, next) => {
  try {
    const result = await reorderLeadStatusesService(req.body, req.user)
    return sendSuccess(res, result, "Lead statuses reordered successfully")
  } catch (err) { next(err) }
}
