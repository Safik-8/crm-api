// crm-api/src/modules/settings/settings.validation.js

import { z } from "zod"

const optionalUrlSchema = z
  .string()
  .trim()
  .refine(
    (val) => {
      if (!val || val === "") return true
      try {
        const parsed = new URL(val)
        return parsed.protocol === "http:" || parsed.protocol === "https:"
      } catch {
        return false
      }
    },
    { message: "Must be a valid URL starting with http:// or https:// (e.g. https://example.com)" }
  )
  .nullable()
  .optional()

const optionalDomainSchema = z
  .string()
  .trim()
  .refine(
    (val) => {
      if (!val || val === "") return true
      return /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(val)
    },
    { message: "Must be a valid domain format (e.g. crm.example.com)" }
  )
  .nullable()
  .optional()

export const generalSettingsSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required").optional(),
  companyLogo: optionalUrlSchema,
  website: optionalUrlSchema,
  timeZone: z.string().trim().default("Asia/Kolkata"),
  currency: z.string().trim().default("INR"),
  currencySymbol: z.string().trim().default("₹"),
  dateFormat: z.string().trim().default("DD/MM/YYYY"),
  timeFormat: z.string().trim().default("24H"),
  language: z.string().trim().default("en"),
}).partial()

export const companySettingsSchema = z.object({
  registeredBusinessName: z.string().trim().optional().nullable(),
  gstTaxNumber: z.string().trim().optional().nullable(),
  businessAddress: z.string().trim().optional().nullable(),
  industryType: z.string().trim().optional().nullable(),
  businessHours: z.record(z.any()).optional().nullable(),
}).partial()

export const crmSettingsSchema = z.object({
  defaultLeadStatusId: z.number().int().positive().nullable().optional(),
  autoAssignmentEnabled: z.boolean().optional(),
  defaultAssignmentAlgorithm: z.enum(["ROUND_ROBIN", "LOAD_BALANCED"]).optional(),
  defaultPipelineId: z.number().int().positive().nullable().optional(),
  defaultOpportunityStageId: z.number().int().positive().nullable().optional(),
  defaultOpportunityWinProb: z.number().int().min(0).max(100).optional(),
  defaultFollowupTime: z.string().trim().optional(),
  leadNumberFormat: z.string().trim().optional(),
  opportunityNumberFormat: z.string().trim().optional(),
  dealNumberFormat: z.string().trim().optional(),
}).partial()

export const notificationSettingsSchema = z.object({
  reminderTimingMinutes: z.number().int().min(0).optional(),
  enableEmailNotifications: z.boolean().optional(),
  enableInAppNotifications: z.boolean().optional(),
  enablePushNotifications: z.boolean().optional(),
  dailySummaryEnabled: z.boolean().optional(),
  dailySummaryTime: z.string().trim().optional(),
}).partial()

export const securitySettingsSchema = z.object({
  sessionTimeoutMinutes: z.number().int().min(5).max(1440).optional(),
  maxLoginAttempts: z.number().int().min(1).max(20).optional(),
  lockoutDurationMinutes: z.number().int().min(1).max(1440).optional(),
  passwordExpiryDays: z.number().int().min(0).max(365).optional(),
  minPasswordLength: z.number().int().min(6).max(64).optional(),
  requireUppercase: z.boolean().optional(),
  requireLowercase: z.boolean().optional(),
  requireNumber: z.boolean().optional(),
  requireSpecialChar: z.boolean().optional(),
  preventPasswordReuseCount: z.number().int().min(0).max(24).optional(),
  requireMfa: z.boolean().optional(),
  ipWhitelisting: z.array(z.string()).optional().nullable(),
}).partial()

export const emailSettingsSchema = z.object({
  smtpHost: z.string().trim().optional().nullable(),
  smtpPort: z.number().int().min(1).max(65535).optional().nullable(),
  smtpUser: z.string().trim().optional().nullable(),
  smtpPassword: z.string().optional().nullable(),
  smtpSenderName: z.string().trim().optional().nullable(),
  smtpSenderEmail: z.string().email("Invalid sender email").optional().nullable().or(z.literal("")),
  smtpEncryption: z.enum(["TLS", "SSL", "NONE"]).optional(),
  emailSignatureTemplate: z.string().optional().nullable(),
}).partial()

export const brandingSettingsSchema = z.object({
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid primary hex color").optional().nullable().or(z.literal("")),
  secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid secondary hex color").optional().nullable().or(z.literal("")),
  accentColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, "Invalid accent hex color").optional().nullable().or(z.literal("")),
  themeMode: z.enum(["LIGHT", "DARK", "SYSTEM"]).optional(),
  loginBackgroundUrl: optionalUrlSchema,
  customDomain: optionalDomainSchema,
  faviconUrl: optionalUrlSchema,
  emailTemplateBranding: z.record(z.any()).optional().nullable(),
}).partial()

export const CATEGORY_SCHEMAS = {
  general: generalSettingsSchema,
  company: companySettingsSchema,
  crm: crmSettingsSchema,
  notification: notificationSettingsSchema,
  security: securitySettingsSchema,
  email: emailSettingsSchema,
  branding: brandingSettingsSchema,
}

/**
 * Middleware factory for validating settings category payload.
 */
export const validateSettingsCategory = (req, res, next) => {
  const category = (req.params.category || "").toLowerCase()
  const schema = CATEGORY_SCHEMAS[category]

  if (!schema) {
    const error = new Error(`Invalid settings category: '${category}'. Allowed categories: ${Object.keys(CATEGORY_SCHEMAS).join(", ")}`)
    error.statusCode = 400
    return next(error)
  }

  const result = schema.safeParse(req.body)

  if (!result.success) {
    const formattedError = result.error.errors.map(err => `${err.path.join(".")}: ${err.message}`).join(", ")
    const error = new Error(`Validation Error: ${formattedError}`)
    error.statusCode = 400
    return next(error)
  }

  req.body = result.data
  next()
}
