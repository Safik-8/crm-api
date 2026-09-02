// crm-api/src/modules/settings/settings.routes.js

import { Router } from "express"
import { authenticate } from "../../middleware/Authenticate.js"
import { hasPermission } from "../../middleware/hasPermission.js"
import { validateSettingsCategory } from "./settings.validation.js"
import {
  getSettingsController,
  updateSettingsCategoryController,
  resetSettingsCategoryController,
  sendTestEmailController,
} from "./settings.controller.js"

const router = Router()

// All settings routes require authentication
router.use(authenticate)

/**
 * @route GET /api/v1/settings
 * @desc Get company system settings
 * @access Private (System Administrators / Authorized Roles)
 */
router.get("/", hasPermission("SYSTEM_SETTINGS", "canView"), getSettingsController)

/**
 * @route POST /api/v1/settings/test-email
 * @desc Send a test email using active SMTP configuration
 * @access Private (System Administrators / Authorized Roles)
 */
router.post("/test-email", hasPermission("SYSTEM_SETTINGS", "canEdit"), sendTestEmailController)

/**
 * @route POST /api/v1/settings/reset/:category
 * @desc Reset settings category to default values
 * @access Private (System Administrators / Authorized Roles)
 */
router.post("/reset/:category", hasPermission("SYSTEM_SETTINGS", "canEdit"), resetSettingsCategoryController)

/**
 * @route PUT /api/v1/settings/:category
 * @desc Update system settings for a specific category
 * @access Private (System Administrators / Authorized Roles)
 */
router.put("/:category", hasPermission("SYSTEM_SETTINGS", "canEdit"), validateSettingsCategory, updateSettingsCategoryController)

export default router
