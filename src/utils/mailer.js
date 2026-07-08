import nodemailer from "nodemailer"
import dotenv from "dotenv"

dotenv.config()

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: parseInt(process.env.SMTP_PORT || "587", 10) === 465, // true for 465, false for others
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || ""
  }
})

/**
 * Send an OTP code to a user's email address
 * @param {string} to 
 * @param {string} otp 
 */
export const sendOTPEmail = async (to, otp) => {
  const mailOptions = {
    from: process.env.SMTP_FROM || `"StackDot CRM" <noreply@stackdot.com>`,
    to,
    subject: "Reset Your Password - OTP Verification",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #F86F03; text-align: center;">StackDot CRM</h2>
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
    `
  }

  // Handle case where credentials aren't set yet (for development/testing)
  if (!process.env.SMTP_USER || process.env.SMTP_USER.includes("placeholder")) {
    console.warn(`[MAILER] SMTP credentials are placeholders. OTP would be sent to: ${to} - OTP: ${otp}`)
    return { mock: true, otp }
  }

  return transporter.sendMail(mailOptions)
}
