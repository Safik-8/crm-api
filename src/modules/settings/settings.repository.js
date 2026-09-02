// crm-api/src/modules/settings/settings.repository.js

import prisma from "../../config/db.js"
import { DEFAULT_COMPANY_SETTINGS } from "./settings.defaults.js"

/**
 * Schema-safe subset of DEFAULT_COMPANY_SETTINGS for Prisma upsert create.
 *
 * We destructure explicitly to avoid Prisma validation errors caused by extra
 * fields in DEFAULT_COMPANY_SETTINGS (e.g. smtpPasswordEncrypted, opportunityDefaults,
 * pipelineDefaults which have different or missing Prisma model field names).
 * Only fields that exist as named Prisma model fields are included here.
 */
const PRISMA_SAFE_DEFAULTS = {
  // General
  companyName:           DEFAULT_COMPANY_SETTINGS.companyName,
  companyLogo:           DEFAULT_COMPANY_SETTINGS.companyLogo,
  website:               DEFAULT_COMPANY_SETTINGS.website,
  timeZone:              DEFAULT_COMPANY_SETTINGS.timeZone,
  currency:              DEFAULT_COMPANY_SETTINGS.currency,
  currencySymbol:        DEFAULT_COMPANY_SETTINGS.currencySymbol,
  dateFormat:            DEFAULT_COMPANY_SETTINGS.dateFormat,
  timeFormat:            DEFAULT_COMPANY_SETTINGS.timeFormat,
  language:              DEFAULT_COMPANY_SETTINGS.language,
  // Company Details
  registeredBusinessName: DEFAULT_COMPANY_SETTINGS.registeredBusinessName,
  gstTaxNumber:           DEFAULT_COMPANY_SETTINGS.gstTaxNumber,
  businessAddress:        DEFAULT_COMPANY_SETTINGS.businessAddress,
  industryType:           DEFAULT_COMPANY_SETTINGS.industryType,
  businessHours:          DEFAULT_COMPANY_SETTINGS.businessHours,
  // CRM Settings
  defaultLeadStatusId:        DEFAULT_COMPANY_SETTINGS.defaultLeadStatusId,
  autoAssignmentEnabled:      DEFAULT_COMPANY_SETTINGS.autoAssignmentEnabled,
  defaultAssignmentAlgorithm: DEFAULT_COMPANY_SETTINGS.defaultAssignmentAlgorithm,
  defaultPipelineId:          DEFAULT_COMPANY_SETTINGS.defaultPipelineId,
  defaultOpportunityStageId:  DEFAULT_COMPANY_SETTINGS.defaultOpportunityStageId,
  defaultOpportunityWinProb:  DEFAULT_COMPANY_SETTINGS.defaultOpportunityWinProb,
  opportunityDefaults:        DEFAULT_COMPANY_SETTINGS.opportunityDefaults,
  pipelineDefaults:           DEFAULT_COMPANY_SETTINGS.pipelineDefaults,
  defaultFollowupTime:        DEFAULT_COMPANY_SETTINGS.defaultFollowupTime,
  leadNumberFormat:           DEFAULT_COMPANY_SETTINGS.leadNumberFormat,
  opportunityNumberFormat:    DEFAULT_COMPANY_SETTINGS.opportunityNumberFormat,
  dealNumberFormat:           DEFAULT_COMPANY_SETTINGS.dealNumberFormat,
  // Notification Settings
  reminderTimingMinutes:    DEFAULT_COMPANY_SETTINGS.reminderTimingMinutes,
  enableEmailNotifications: DEFAULT_COMPANY_SETTINGS.enableEmailNotifications,
  enableInAppNotifications: DEFAULT_COMPANY_SETTINGS.enableInAppNotifications,
  enablePushNotifications:  DEFAULT_COMPANY_SETTINGS.enablePushNotifications,
  dailySummaryEnabled:      DEFAULT_COMPANY_SETTINGS.dailySummaryEnabled,
  dailySummaryTime:         DEFAULT_COMPANY_SETTINGS.dailySummaryTime,
  // Security Settings
  sessionTimeoutMinutes:     DEFAULT_COMPANY_SETTINGS.sessionTimeoutMinutes,
  maxLoginAttempts:          DEFAULT_COMPANY_SETTINGS.maxLoginAttempts,
  lockoutDurationMinutes:    DEFAULT_COMPANY_SETTINGS.lockoutDurationMinutes,
  passwordExpiryDays:        DEFAULT_COMPANY_SETTINGS.passwordExpiryDays,
  minPasswordLength:         DEFAULT_COMPANY_SETTINGS.minPasswordLength,
  requireUppercase:          DEFAULT_COMPANY_SETTINGS.requireUppercase,
  requireLowercase:          DEFAULT_COMPANY_SETTINGS.requireLowercase,
  requireNumber:             DEFAULT_COMPANY_SETTINGS.requireNumber,
  requireSpecialChar:        DEFAULT_COMPANY_SETTINGS.requireSpecialChar,
  preventPasswordReuseCount: DEFAULT_COMPANY_SETTINGS.preventPasswordReuseCount,
  requireMfa:                DEFAULT_COMPANY_SETTINGS.requireMfa,
  ipWhitelisting:            DEFAULT_COMPANY_SETTINGS.ipWhitelisting,
  // Email/SMTP Settings (no smtpPasswordEncrypted — never set a null encrypted password on init)
  smtpHost:              DEFAULT_COMPANY_SETTINGS.smtpHost,
  smtpPort:              DEFAULT_COMPANY_SETTINGS.smtpPort,
  smtpUser:              DEFAULT_COMPANY_SETTINGS.smtpUser,
  smtpSenderName:        DEFAULT_COMPANY_SETTINGS.smtpSenderName,
  smtpSenderEmail:       DEFAULT_COMPANY_SETTINGS.smtpSenderEmail,
  smtpEncryption:        DEFAULT_COMPANY_SETTINGS.smtpEncryption,
  emailSignatureTemplate: DEFAULT_COMPANY_SETTINGS.emailSignatureTemplate,
  // Branding Settings
  primaryColor:          DEFAULT_COMPANY_SETTINGS.primaryColor,
  secondaryColor:        DEFAULT_COMPANY_SETTINGS.secondaryColor,
  accentColor:           DEFAULT_COMPANY_SETTINGS.accentColor,
  themeMode:             DEFAULT_COMPANY_SETTINGS.themeMode,
  loginBackgroundUrl:    DEFAULT_COMPANY_SETTINGS.loginBackgroundUrl,
  customDomain:          DEFAULT_COMPANY_SETTINGS.customDomain,
  faviconUrl:            DEFAULT_COMPANY_SETTINGS.faviconUrl,
  emailTemplateBranding: DEFAULT_COMPANY_SETTINGS.emailTemplateBranding,
}

/** Standard include clause reused across all repository functions */
const SETTINGS_INCLUDE = {
  defaultLeadStatus:       { select: { id: true, name: true, code: true, displayColor: true } },
  defaultPipeline:         { select: { id: true, name: true } },
  defaultOpportunityStage: { select: { id: true, name: true, code: true } },
}

/**
 * Retrieves settings record for a company.
 * Auto-initializes (upserts) with company profile and system defaults if missing.
 * @param {number} companyId 
 * @returns {Promise<Object>} CompanySettings DB record
 */
export const findOrCreateCompanySettings = async (companyId) => {
  if (!companyId) return null

  // Fetch company profile to inherit official name, logo, website, etc.
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, logo: true, website: true, address: true, industry: true },
  })

  const initialDefaults = {
    ...PRISMA_SAFE_DEFAULTS,
    companyName: company?.name || PRISMA_SAFE_DEFAULTS.companyName,
    companyLogo: company?.logo || PRISMA_SAFE_DEFAULTS.companyLogo,
    website: company?.website || PRISMA_SAFE_DEFAULTS.website,
    businessAddress: company?.address || PRISMA_SAFE_DEFAULTS.businessAddress,
    industryType: company?.industry || PRISMA_SAFE_DEFAULTS.industryType,
    registeredBusinessName: company?.name || PRISMA_SAFE_DEFAULTS.registeredBusinessName,
  }

  const existing = await prisma.companySettings.findUnique({
    where: { companyId },
    include: SETTINGS_INCLUDE,
  })

  if (existing) {
    // If companyName was initialized as placeholder 'My Company' but company has a real name, use real name
    if ((!existing.companyName || existing.companyName === "My Company") && company?.name) {
      return await prisma.companySettings.update({
        where: { companyId },
        data: {
          companyName: company.name,
          registeredBusinessName: existing.registeredBusinessName || company.name,
          website: existing.website || company.website,
          companyLogo: existing.companyLogo || company.logo,
        },
        include: SETTINGS_INCLUDE,
      })
    }
    return existing
  }

  return await prisma.companySettings.create({
    data: {
      companyId,
      ...initialDefaults,
    },
    include: SETTINGS_INCLUDE,
  })
}

/**
 * Updates company settings with new values.
 * @param {number} companyId 
 * @param {Object} updateData 
 * @returns {Promise<Object>} Updated CompanySettings DB record
 */
export const updateCompanySettingsRecord = async (companyId, updateData) => {
  // Synchronize with companies profile table if company branding or details were changed
  const companyProfileUpdates = {}
  if (updateData.companyName !== undefined && updateData.companyName !== null) {
    companyProfileUpdates.name = updateData.companyName.trim()
  }
  if (updateData.companyLogo !== undefined) {
    companyProfileUpdates.logo = updateData.companyLogo?.trim() || null
  }
  if (updateData.website !== undefined) {
    companyProfileUpdates.website = updateData.website?.trim() || null
  }
  if (updateData.businessAddress !== undefined) {
    companyProfileUpdates.address = updateData.businessAddress?.trim() || null
  }
  if (updateData.industryType !== undefined) {
    companyProfileUpdates.industry = updateData.industryType?.trim() || null
  }

  if (Object.keys(companyProfileUpdates).length > 0) {
    await prisma.company.update({
      where: { id: companyId },
      data: companyProfileUpdates,
    }).catch((err) => {
      console.error("[SettingsRepo] Failed to sync Company profile:", err)
    })
  }

  return await prisma.companySettings.update({
    where: { companyId },
    data: updateData,
    include: SETTINGS_INCLUDE,
  })
}

/**
 * Resets a specific setting category or all settings to defaults.
 * @param {number} companyId 
 * @param {Object} resetData 
 * @returns {Promise<Object>} Reset CompanySettings DB record
 */
export const resetCompanySettingsRecord = async (companyId, resetData) => {
  return await prisma.companySettings.update({
    where: { companyId },
    data: resetData,
    include: SETTINGS_INCLUDE,
  })
}
