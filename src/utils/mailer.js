// crm-api/src/utils/mailer.js

import nodemailer from "nodemailer"
import dotenv from "dotenv"
import { settingsCache } from "../services/settingsCache.service.js"
import { decryptText } from "./cryptoUtils.js"
import prisma from "../config/db.js"

dotenv.config()

/**
 * Creates or retrieves active nodemailer transport for a specific company or falls back to system .env.
 * @param {number|null} companyId 
 * @returns {Promise<{ transporter: nodemailer.Transporter, senderName: string, senderEmail: string }>}
 */
export const getTenantTransporter = async (companyId = null) => {
  let smtpConfig = null

  if (companyId) {
    // Check in-memory cache first
    smtpConfig = settingsCache.get(companyId)
    if (!smtpConfig) {
      // Fallback to database lookup
      smtpConfig = await prisma.companySettings.findUnique({
        where: { companyId },
      }).catch(() => null)

      if (smtpConfig) {
        settingsCache.set(companyId, smtpConfig)
      }
    }
  }

  // If company settings have valid host & user, build dynamic transport
  if (smtpConfig && smtpConfig.smtpHost && smtpConfig.smtpUser) {
    const decryptedPass = decryptText(smtpConfig.smtpPasswordEncrypted) || smtpConfig.smtpPasswordEncrypted || ""

    const transporter = nodemailer.createTransport({
      host: smtpConfig.smtpHost,
      port: smtpConfig.smtpPort || 587,
      secure: smtpConfig.smtpEncryption === "SSL" || smtpConfig.smtpPort === 465,
      auth: {
        user: smtpConfig.smtpUser,
        pass: decryptedPass,
      },
    })

    return {
      transporter,
      senderName: smtpConfig.smtpSenderName || "CRM System",
      senderEmail: smtpConfig.smtpSenderEmail || smtpConfig.smtpUser,
    }
  }

  // Fallback to environment variables
  const defaultTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: parseInt(process.env.SMTP_PORT || "587", 10) === 465,
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
  })

  return {
    transporter: defaultTransporter,
    senderName: process.env.SMTP_SENDER_NAME || "StackDot CRM",
    senderEmail: process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@stackdot.com",
  }
}

/**
 * Send an OTP code to a user's email address.
 * @param {string} to 
 * @param {string} otp 
 * @param {number|null} companyId 
 */
export const sendOTPEmail = async (to, otp, companyId = null) => {
  const { transporter, senderName, senderEmail } = await getTenantTransporter(companyId)

  const mailOptions = {
    from: `"${senderName}" <${senderEmail}>`,
    to,
    subject: "Reset Your Password - OTP Verification",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #F86F03; text-align: center;">${senderName}</h2>
        <h3 style="color: #333333; text-align: center;">Password Reset Request</h3>
        <p style="color: #666666; font-size: 16px; line-height: 1.5;">
          We received a request to reset your password. Please use the following 6-digit One-Time Password (OTP) to complete the reset. This OTP is valid for 10 minutes.
        </p>
        <div style="background-color: #f9f9f9; border: 1px dashed #F86F03; padding: 15px; border-radius: 6px; text-align: center; margin: 25px 0;">
          <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #F86F03;">${otp}</span>
        </div>
        <p style="color: #999999; font-size: 12px; text-align: center; margin-top: 30px;">
          If you did not request this reset, please ignore this email or contact support if you have questions.
        </p>
      </div>
    `,
  }

  // Handle mock case for local dev if credentials unconfigured
  if (!process.env.SMTP_USER && (!transporter.options || !transporter.options.auth?.user)) {
    console.warn(`[MAILER] SMTP credentials unconfigured. OTP for ${to} is: ${otp}`)
    return { mock: true, otp }
  }

  return transporter.sendMail(mailOptions)
}
