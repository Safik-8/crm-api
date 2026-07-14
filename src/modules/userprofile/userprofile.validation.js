// src/modules/userprofile/userprofile.validation.js

import { z } from "zod"
import { ValidationError } from "../../utils/AppError.js"

export const updateUserProfileSchema = z.object({
  firstName: z.string().trim().max(100, "First name must be under 100 characters").optional().nullable(),
  lastName: z.string().trim().max(100, "Last name must be under 100 characters").optional().nullable(),
  mobileNumber: z.string().trim()
    .regex(/^$|^[+0-9\s-]{8,20}$/, "Invalid mobile number format")
    .optional().nullable(),
  profilePhoto: z.string().trim().optional().nullable(),
  address: z.string().trim().max(500, "Address must be under 500 characters").optional().nullable(),
  city: z.string().trim().max(100, "City name must be under 100 characters").optional().nullable(),
  state: z.string().trim().max(100, "State name must be under 100 characters").optional().nullable(),
  country: z.string().trim().max(100, "Country name must be under 100 characters").optional().nullable(),
  pincode: z.string().trim().max(20, "Pincode must be under 20 characters").optional().nullable(),
  emergencyContact: z.string().trim().max(100, "Emergency contact must be under 100 characters").optional().nullable(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string({ required_error: "Current password is required" })
    .min(1, "Current password is required"),
  newPassword: z.string({ required_error: "New password is required" })
    .min(6, "New password must be at least 6 characters long"),
  confirmPassword: z.string({ required_error: "Confirm password is required" })
    .min(1, "Confirm password is required")
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New password and confirmation do not match",
  path: ["confirmPassword"]
})

export const validateBody = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)

    if (!result.success) {
      const fields = result.error.errors.map(err => ({
        field: err.path.join("."),
        message: err.message
      }))
      return next(new ValidationError("Validation failed", fields))
    }

    // Replace req.body with parsed/cleaned data
    req.body = result.data
    next()
  }
}
