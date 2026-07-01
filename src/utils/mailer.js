import nodemailer from "nodemailer"
import dotenv from "dotenv"
import { AppError } from "./AppError.js"
dotenv.config()

let transporter = null

// Initialize SMTP transporter if configuration is present
const hasSmtpConfig =
  process.env.SMTP_HOST &&
  process.env.SMTP_PORT &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS &&
  !process.env.SMTP_USER.includes("CHANGE_ME") &&
  !process.env.SMTP_PASS.includes("CHANGE_ME")

if (hasSmtpConfig) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

/**
 * Send an email with SMTP, falling back to console logging in development.
 * @param {object} params
 * @param {string} params.to
 * @param {string} params.subject
 * @param {string} params.text
 * @param {string} [params.html]
 */
export const sendEmail = async ({ to, subject, text, html }) => {
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || `"StackDot CRM" <no-reply@stackdot.com>`,
        to,
        subject,
        text,
        html,
      })
      console.log(`Email sent successfully: ${info.messageId}`)
      return info
    } catch (error) {
      console.error("Failed to send email via SMTP:", error)
      throw new AppError("Failed to send email. Please check your SMTP settings.", 500, "EMAIL_SEND_FAILED")
    }
  }

  // Fallback: log to console in development
  console.log("\n==================================================")
  console.log("📨 EMAIL SENT (DEVELOPMENT MOCK FALLBACK)")
  console.log(`To:      ${to}`)
  console.log(`Subject: ${subject}`)
  console.log(`Content: ${text}`)
  console.log("==================================================\n")
  return { mock: true }
}
