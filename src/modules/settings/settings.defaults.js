// crm-api/src/modules/settings/settings.defaults.js

export const DEFAULT_COMPANY_SETTINGS = {
  // 1. General Settings
  companyName: "My Company",
  companyLogo: null,
  website: "",
  timeZone: "Asia/Kolkata",
  currency: "INR",
  currencySymbol: "₹",
  dateFormat: "DD/MM/YYYY",
  timeFormat: "24H",
  language: "en",

  // 2. Company Details (Task 3.4)
  registeredBusinessName: "",
  gstTaxNumber: "",
  businessAddress: "",
  industryType: "Education / EdTech",
  businessHours: {
    monday: { open: "09:00", close: "18:00", active: true },
    tuesday: { open: "09:00", close: "18:00", active: true },
    wednesday: { open: "09:00", close: "18:00", active: true },
    thursday: { open: "09:00", close: "18:00", active: true },
    friday: { open: "09:00", close: "18:00", active: true },
    saturday: { open: "09:00", close: "14:00", active: false },
    sunday: { open: "00:00", close: "00:00", active: false },
  },

  // 3. CRM Settings
  defaultLeadStatusId: null,
  autoAssignmentEnabled: false,
  defaultAssignmentAlgorithm: "ROUND_ROBIN",
  defaultPipelineId: null,
  defaultOpportunityStageId: null,
  defaultOpportunityWinProb: 50,
  opportunityDefaults: {},
  pipelineDefaults: {},
  defaultFollowupTime: "09:00",
  leadNumberFormat: "LD-{YYYY}-{0000}",
  opportunityNumberFormat: "OPP-{YYYY}-{0000}",
  dealNumberFormat: "DEAL-{YYYY}-{0000}",

  // 4. Notification Settings
  reminderTimingMinutes: 15,
  enableEmailNotifications: true,
  enableInAppNotifications: true,
  enablePushNotifications: false,
  dailySummaryEnabled: true,
  dailySummaryTime: "08:00",

  // 5. Security Settings
  sessionTimeoutMinutes: 60,
  maxLoginAttempts: 5,
  lockoutDurationMinutes: 15,
  passwordExpiryDays: 90,
  minPasswordLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true,
  preventPasswordReuseCount: 5,
  requireMfa: false,
  ipWhitelisting: [],

  // 6. Email Settings (SMTP)
  smtpHost: "",
  smtpPort: 587,
  smtpUser: "",
  smtpPasswordEncrypted: null,
  smtpSenderName: "CRM System",
  smtpSenderEmail: "noreply@crm.internal",
  smtpEncryption: "TLS",
  emailSignatureTemplate: "<p>Best regards,<br/><strong>Team</strong></p>",

  // 7. Branding Settings
  primaryColor: "#3B82F6",
  secondaryColor: "#1E40AF",
  accentColor: "#10B981",
  themeMode: "LIGHT",
  loginBackgroundUrl: null,
  customDomain: null,
  faviconUrl: null,
  emailTemplateBranding: {
    headerColor: "#3B82F6",
    footerText: "Sent via CRM System",
  },
}

export const SETTINGS_CATEGORIES = [
  "general",
  "company",
  "crm",
  "notification",
  "security",
  "email",
  "branding",
]
