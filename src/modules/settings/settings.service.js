// crm-api/src/modules/settings/settings.service.js

import nodemailer from "nodemailer"
import * as settingsRepo from "./settings.repository.js"
import { DEFAULT_COMPANY_SETTINGS, SETTINGS_CATEGORIES } from "./settings.defaults.js"
import { encryptText, decryptText } from "../../utils/cryptoUtils.js"
import { settingsCache } from "../../services/settingsCache.service.js"
import { recordAuditLog } from "../auditLog/auditLog.service.js"
import { ForbiddenError, ValidationError, NotFoundError } from "../../utils/AppError.js"

/**
 * Helper to mask sensitive password string.
 */
const MASKED_PASSWORD = "********"

/**
 * Sanitizes CompanySettings record for API response (masks encrypted secrets).
 */
export const sanitizeSettingsForResponse = (settings) => {
  if (!settings) return null
  const { smtpPasswordEncrypted, ...rest } = settings
  return {
    ...rest,
    smtpPassword: smtpPasswordEncrypted ? MASKED_PASSWORD : null,
    hasSmtpPassword: Boolean(smtpPasswordEncrypted),
  }
}

/**
 * Determines target company ID based on actor role and request context.
 */
const resolveCompanyId = (actor, requestedCompanyId) => {
  const isSuperAdmin = (actor.primaryRole || "").toUpperCase() === "SUPER_ADMIN"

  if (isSuperAdmin && requestedCompanyId) {
    return Number(requestedCompanyId)
  }

  if (!actor.companyId) {
    throw new ForbiddenError("User is not associated with any company")
  }

  return actor.companyId
}

/**
 * Category level RBAC check per 3.12 Access Control Matrix.
 */
const verifyCategoryPermission = (actor, category, action = "canEdit") => {
  const role = (actor.primaryRole || "").toUpperCase()
  const isSuperAdmin = role === "SUPER_ADMIN"
  const isCompanyAdmin = role === "COMPANY_ADMIN"

  // SUPER_ADMIN has unconditional platform-wide access
  if (isSuperAdmin) return true

  // Allow Company Admin or any custom role with explicit SYSTEM_SETTINGS permission
  const hasModulePerm = Boolean(actor.permissions?.["SYSTEM_SETTINGS"]?.[action])

  if (!isCompanyAdmin && !hasModulePerm) {
    throw new ForbiddenError(
      "Access Denied: You do not have permission to configure system settings"
    )
  }

  return true
}

/**
 * Service: Retrieves company system settings.
 */
export const getSettingsService = async (actor, requestedCompanyId) => {
  const companyId = resolveCompanyId(actor, requestedCompanyId)

  // 1. Check in-memory cache
  const cachedData = settingsCache.get(companyId)
  if (cachedData) {
    return sanitizeSettingsForResponse(cachedData)
  }

  // 2. Fetch or initialize default DB record
  const settings = await settingsRepo.findOrCreateCompanySettings(companyId)
  if (!settings) {
    throw new NotFoundError("Company settings record not found")
  }

  // 3. Cache and return sanitized response
  settingsCache.set(companyId, settings)
  return sanitizeSettingsForResponse(settings)
}

/**
 * Service: Updates settings for a specific category.
 */
export const updateSettingsCategoryService = async (actor, category, updatePayload, req) => {
  const normCategory = (category || "").toLowerCase()
  if (!SETTINGS_CATEGORIES.includes(normCategory)) {
    throw new ValidationError(`Invalid category '${category}'`)
  }

  // verifyCategoryPermission runs BEFORE resolveCompanyId so unauthorised callers
  // are rejected without us leaking whether a companyId exists.
  verifyCategoryPermission(actor, normCategory, "canEdit")

  // SUPER_ADMIN may target any company via ?companyId=N query param.
  // COMPANY_ADMIN always operates on their own companyId.
  // We read ONLY from req.query because Zod validation strips unknown body fields,
  // so req.body.companyId is always undefined after category validation runs.
  const companyId = resolveCompanyId(actor, req?.query?.companyId)

  // 1. Get existing settings
  const existingSettings = await settingsRepo.findOrCreateCompanySettings(companyId)

  // 2. Process payload and handle sensitive password preservation
  const processedData = { ...updatePayload }

  if (normCategory === "email") {
    const newPassword = updatePayload.smtpPassword

    if (!newPassword || newPassword === MASKED_PASSWORD || newPassword.trim() === "") {
      // Preserve existing encrypted password
      delete processedData.smtpPassword
    } else {
      // Encrypt new password using AES-256-GCM
      processedData.smtpPasswordEncrypted = encryptText(newPassword)
      delete processedData.smtpPassword
    }
  }

  // Remove helper keys if passed
  delete processedData.companyId
  delete processedData.id

  // 3. Update database
  const updatedSettings = await settingsRepo.updateCompanySettingsRecord(companyId, processedData)

  // 4. Invalidate tenant cache
  settingsCache.invalidate(companyId)
  settingsCache.set(companyId, updatedSettings)

  // 5. Record enterprise security audit log
  await recordAuditLog({
    req,
    moduleName: "SYSTEM_SETTINGS",
    actionType: "SETTINGS_CHANGE",
    action: `UPDATE_${normCategory.toUpperCase()}_SETTINGS`,
    companyId,
    performedById: actor.id,
    oldValue: sanitizeSettingsForResponse(existingSettings),
    newValue: sanitizeSettingsForResponse(updatedSettings),
  })

  return sanitizeSettingsForResponse(updatedSettings)
}

/**
 * Service: Resets a specific category or all settings to defaults.
 */
export const resetSettingsCategoryService = async (actor, category, req) => {
  const normCategory = (category || "all").toLowerCase()
  const companyId = resolveCompanyId(actor, req?.query?.companyId)

  verifyCategoryPermission(actor, normCategory === "all" ? "general" : normCategory, "canEdit")

  const existingSettings = await settingsRepo.findOrCreateCompanySettings(companyId)
  let resetPayload = {}

  if (normCategory === "all") {
    resetPayload = { ...DEFAULT_COMPANY_SETTINGS }
  } else {
    // Reset category fields to defaults
    if (normCategory === "general") {
      resetPayload = {
        timeZone: DEFAULT_COMPANY_SETTINGS.timeZone,
        currency: DEFAULT_COMPANY_SETTINGS.currency,
        currencySymbol: DEFAULT_COMPANY_SETTINGS.currencySymbol,
        dateFormat: DEFAULT_COMPANY_SETTINGS.dateFormat,
        timeFormat: DEFAULT_COMPANY_SETTINGS.timeFormat,
        language: DEFAULT_COMPANY_SETTINGS.language,
      }
    } else if (normCategory === "company") {
      resetPayload = {
        registeredBusinessName: DEFAULT_COMPANY_SETTINGS.registeredBusinessName,
        gstTaxNumber: DEFAULT_COMPANY_SETTINGS.gstTaxNumber,
        businessAddress: DEFAULT_COMPANY_SETTINGS.businessAddress,
        industryType: DEFAULT_COMPANY_SETTINGS.industryType,
        businessHours: DEFAULT_COMPANY_SETTINGS.businessHours,
      }
    } else if (normCategory === "crm") {
      resetPayload = {
        defaultLeadStatusId: null,
        autoAssignmentEnabled: DEFAULT_COMPANY_SETTINGS.autoAssignmentEnabled,
        defaultAssignmentAlgorithm: DEFAULT_COMPANY_SETTINGS.defaultAssignmentAlgorithm,
        defaultPipelineId: null,
        defaultOpportunityStageId: null,
        defaultOpportunityWinProb: DEFAULT_COMPANY_SETTINGS.defaultOpportunityWinProb,
        defaultFollowupTime: DEFAULT_COMPANY_SETTINGS.defaultFollowupTime,
        leadNumberFormat: DEFAULT_COMPANY_SETTINGS.leadNumberFormat,
        opportunityNumberFormat: DEFAULT_COMPANY_SETTINGS.opportunityNumberFormat,
        dealNumberFormat: DEFAULT_COMPANY_SETTINGS.dealNumberFormat,
      }
    } else if (normCategory === "notification") {
      resetPayload = {
        reminderTimingMinutes: DEFAULT_COMPANY_SETTINGS.reminderTimingMinutes,
        enableEmailNotifications: DEFAULT_COMPANY_SETTINGS.enableEmailNotifications,
        enableInAppNotifications: DEFAULT_COMPANY_SETTINGS.enableInAppNotifications,
        enablePushNotifications: DEFAULT_COMPANY_SETTINGS.enablePushNotifications,
        dailySummaryEnabled: DEFAULT_COMPANY_SETTINGS.dailySummaryEnabled,
        dailySummaryTime: DEFAULT_COMPANY_SETTINGS.dailySummaryTime,
      }
    } else if (normCategory === "security") {
      resetPayload = {
        sessionTimeoutMinutes: DEFAULT_COMPANY_SETTINGS.sessionTimeoutMinutes,
        maxLoginAttempts: DEFAULT_COMPANY_SETTINGS.maxLoginAttempts,
        lockoutDurationMinutes: DEFAULT_COMPANY_SETTINGS.lockoutDurationMinutes,
        passwordExpiryDays: DEFAULT_COMPANY_SETTINGS.passwordExpiryDays,
        minPasswordLength: DEFAULT_COMPANY_SETTINGS.minPasswordLength,
        requireUppercase: DEFAULT_COMPANY_SETTINGS.requireUppercase,
        requireLowercase: DEFAULT_COMPANY_SETTINGS.requireLowercase,
        requireNumber: DEFAULT_COMPANY_SETTINGS.requireNumber,
        requireSpecialChar: DEFAULT_COMPANY_SETTINGS.requireSpecialChar,
        preventPasswordReuseCount: DEFAULT_COMPANY_SETTINGS.preventPasswordReuseCount,
        requireMfa: DEFAULT_COMPANY_SETTINGS.requireMfa,
        ipWhitelisting: DEFAULT_COMPANY_SETTINGS.ipWhitelisting,
      }
    } else if (normCategory === "email") {
      resetPayload = {
        smtpHost: null,
        smtpPort: 587,
        smtpUser: null,
        smtpPasswordEncrypted: null,
        smtpSenderName: DEFAULT_COMPANY_SETTINGS.smtpSenderName,
        smtpSenderEmail: DEFAULT_COMPANY_SETTINGS.smtpSenderEmail,
        smtpEncryption: DEFAULT_COMPANY_SETTINGS.smtpEncryption,
        emailSignatureTemplate: DEFAULT_COMPANY_SETTINGS.emailSignatureTemplate,
      }
    } else if (normCategory === "branding") {
      resetPayload = {
        primaryColor: DEFAULT_COMPANY_SETTINGS.primaryColor,
        secondaryColor: DEFAULT_COMPANY_SETTINGS.secondaryColor,
        accentColor: DEFAULT_COMPANY_SETTINGS.accentColor,
        themeMode: DEFAULT_COMPANY_SETTINGS.themeMode,
        loginBackgroundUrl: null,
        faviconUrl: null,
        emailTemplateBranding: DEFAULT_COMPANY_SETTINGS.emailTemplateBranding,
      }
    }
  }

  const resetSettings = await settingsRepo.resetCompanySettingsRecord(companyId, resetPayload)
  settingsCache.invalidate(companyId)

  await recordAuditLog({
    req,
    moduleName: "SYSTEM_SETTINGS",
    actionType: "SETTINGS_CHANGE",
    action: `RESET_${normCategory.toUpperCase()}_SETTINGS`,
    companyId,
    performedById: actor.id,
    oldValue: sanitizeSettingsForResponse(existingSettings),
    newValue: sanitizeSettingsForResponse(resetSettings),
  })

  return sanitizeSettingsForResponse(resetSettings)
}

/**
 * Service: Sends a test email using active company SMTP settings.
 */
export const sendTestEmailService = async (actor, testRecipient, req) => {
  // Authorization check FIRST — before resolving any companyId to prevent info-leak
  verifyCategoryPermission(actor, "email", "canEdit")
  const companyId = resolveCompanyId(actor, req?.body?.companyId)

  const settings = await settingsRepo.findOrCreateCompanySettings(companyId)
  if (!settings.smtpHost || !settings.smtpUser) {
    throw new ValidationError("SMTP configuration is incomplete. Host and Username are required.")
  }

  const decryptedPassword = decryptText(settings.smtpPasswordEncrypted) || settings.smtpPasswordEncrypted || ""

  const transporter = nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort || 587,
    secure: settings.smtpEncryption === "SSL" || settings.smtpPort === 465,
    auth: {
      user: settings.smtpUser,
      pass: decryptedPassword,
    },
    connectionTimeout: 8000, // 8 second timeout
  })

  const mailOptions = {
    from: `"${settings.smtpSenderName || "CRM System"}" <${settings.smtpSenderEmail || settings.smtpUser}>`,
    to: testRecipient || actor.email,
    subject: "CRM System Settings — SMTP Test Email",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: ${settings.primaryColor || "#3B82F6"};">SMTP Test Email Successful</h2>
        <p>This email confirms that your CRM system SMTP settings are correctly configured and operating normally.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;"/>
        <p><strong>Configured Host:</strong> ${settings.smtpHost}</p>
        <p><strong>Configured Port:</strong> ${settings.smtpPort}</p>
        <p><strong>Sender Email:</strong> ${settings.smtpSenderEmail || settings.smtpUser}</p>
        <p style="font-size: 12px; color: #888; margin-top: 30px;">Dispatched at ${new Date().toISOString()}</p>
      </div>
    `,
  }

  await transporter.sendMail(mailOptions)

  return {
    success: true,
    message: `Test email sent successfully to ${testRecipient || actor.email}`,
  }
}
