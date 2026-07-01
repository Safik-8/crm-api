// src/modules/auth/auth.validation.js

import { z } from "zod"
import { ValidationError } from "../../utils/AppError.js"

// Schema to validate user login input
export const loginSchema = z.object({
  email: z.string({ required_error: "Email is required" })
    .trim()
    .nonempty("Email is required")
    .email("Invalid email format"),
  password: z.string({ required_error: "Password is required" })
    .nonempty("Password is required")
})

// Schema to validate refresh token input
export const refreshSchema = z.object({
  refreshToken: z.string({ required_error: "Refresh token is required" })
    .nonempty("Refresh token is required")
})

// Schema for requesting password reset (forgot password)
export const forgotPasswordSchema = z.object({
  email: z.string({ required_error: "Email is required" })
    .trim()
    .nonempty("Email is required")
    .email("Invalid email format"),
})

// Schema for verifying password reset OTP
export const verifyOtpSchema = z.object({
  email: z.string({ required_error: "Email is required" })
    .trim()
    .nonempty("Email is required")
    .email("Invalid email format"),
  otp: z.string({ required_error: "OTP code is required" })
    .trim()
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d+$/, "OTP must contain only numbers"),
})

// Schema for resetting password with OTP
export const resetPasswordSchema = z.object({
  email: z.string({ required_error: "Email is required" })
    .trim()
    .nonempty("Email is required")
    .email("Invalid email format"),
  otp: z.string({ required_error: "OTP code is required" })
    .trim()
    .length(6, "OTP must be exactly 6 digits")
    .regex(/^\d+$/, "OTP must contain only numbers"),
  newPassword: z.string({ required_error: "New password is required" })
    .nonempty("New password is required")
    .min(6, "Password must be at least 6 characters long"),
})


/**
 * Express middleware to validate request body against a Zod schema.
 * Formats any validation errors to match the project's native ValidationError shape.
 * 
 * @param {z.ZodSchema} schema 
 * @returns {Function} Express middleware
 */
export const validateBody = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)

    if (!result.success) {
      const fields = result.error.issues.map(err => ({
        field: err.path.join("."),
        message: err.message
      }))
      return next(new ValidationError("Validation failed", fields))
    }

    // Replace req.body with parsed data to ensure clean/trimmed fields
    req.body = result.data
    next()
  }
}
