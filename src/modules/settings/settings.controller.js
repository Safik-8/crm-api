// crm-api/src/modules/settings/settings.controller.js

import { sendSuccess } from "../../utils/response.js"
import {
  getSettingsService,
  updateSettingsCategoryService,
  resetSettingsCategoryService,
  sendTestEmailService,
} from "./settings.service.js"

/**
 * Controller: Get company system settings.
 * GET /api/v1/settings
 */
export const getSettingsController = async (req, res, next) => {
  try {
    const settings = await getSettingsService(req.user, req.query.companyId)
    return sendSuccess(res, { settings }, "System settings fetched successfully")
  } catch (err) {
    next(err)
  }
}

/**
 * Controller: Update system settings for a category.
 * PUT /api/v1/settings/:category
 */
export const updateSettingsCategoryController = async (req, res, next) => {
  try {
    const { category } = req.params
    const updatedSettings = await updateSettingsCategoryService(req.user, category, req.body, req)
    return sendSuccess(res, { settings: updatedSettings }, `${category.toUpperCase()} settings updated successfully`)
  } catch (err) {
    next(err)
  }
}

/**
 * Controller: Reset settings for a category to defaults.
 * POST /api/v1/settings/reset/:category
 */
export const resetSettingsCategoryController = async (req, res, next) => {
  try {
    const category = req.params.category || "all"
    const resetSettings = await resetSettingsCategoryService(req.user, category, req)
    return sendSuccess(res, { settings: resetSettings }, `${category.toUpperCase()} settings reset to defaults successfully`)
  } catch (err) {
    next(err)
  }
}

/**
 * Controller: Send test email with active SMTP settings.
 * POST /api/v1/settings/test-email
 */
export const sendTestEmailController = async (req, res, next) => {
  try {
    const { recipient } = req.body
    const result = await sendTestEmailService(req.user, recipient, req)
    return sendSuccess(res, result, "SMTP test email sent successfully")
  } catch (err) {
    next(err)
  }
}
