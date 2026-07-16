// src/modules/leadsources/leadsources.controllers.js

import {
  createLeadSourceService,
  getLeadSourcesService,
  updateLeadSourceService,
  toggleLeadSourceStatusService,
} from "./leadsources.services.js"
import { sendSuccess } from "../../utils/response.js"

export const createLeadSource = async (req, res, next) => {
  try {
    const leadSource = await createLeadSourceService(req.body, req.user)
    return sendSuccess(res, { leadSource }, "Lead source created successfully", 201)
  } catch (err) { next(err) }
}

export const getLeadSources = async (req, res, next) => {
  try {
    const result = await getLeadSourcesService(req.query, req.user)
    return sendSuccess(res, result, "Lead sources fetched")
  } catch (err) { next(err) }
}

export const updateLeadSource = async (req, res, next) => {
  try {
    const leadSource = await updateLeadSourceService(req.params.id, req.body, req.user)
    return sendSuccess(res, { leadSource }, "Lead source updated successfully")
  } catch (err) { next(err) }
}

export const toggleLeadSourceStatus = async (req, res, next) => {
  try {
    const result = await toggleLeadSourceStatusService(req.params.id, req.user)
    return sendSuccess(res, { leadSource: result }, "Lead source status updated successfully")
  } catch (err) { next(err) }
}
