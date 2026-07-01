// src/modules/company/company.validation.js

import { z } from "zod"
import { ValidationError } from "../../utils/AppError.js"

// Schema to validate company onboarding/creation input (includes Company Details + Company Admin fields)
export const createCompanySchema = z.object({
  // Company Details
  name: z.string({ required_error: "Company name is required" })
    .trim()
    .nonempty("Company name is required"),
  code: z.string({ required_error: "Company code is required" })
    .trim()
    .nonempty("Company code is required")
    .regex(/^[A-Za-z0-9_-]+$/, "Company code must be alphanumeric and can only contain dashes or underscores"),
  logo: z.string().trim().optional(),
  industry: z.string().trim().optional(),
  website: z.string().trim().optional(),
  address: z.string().trim().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),

  // Company Admin User details
  adminName: z.string({ required_error: "Admin name is required" })
    .trim()
    .nonempty("Admin name is required"),
  adminEmail: z.string({ required_error: "Admin email is required" })
    .trim()
    .nonempty("Admin email is required")
    .email("Invalid admin email format"),
  adminPassword: z.string({ required_error: "Admin password is required" })
    .nonempty("Admin password is required")
    .min(6, "Admin password must be at least 6 characters")
})

// Schema to validate company updates (locks code from editing)
export const updateCompanySchema = z.object({
  name: z.string().trim().nonempty("Company name cannot be empty").optional(),
  logo: z.string().trim().optional(),
  industry: z.string().trim().optional(),
  website: z.string().trim().optional(),
  address: z.string().trim().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional()
})

/**
 * Express middleware to validate request body against a Zod schema.
 * Formats validation errors to match the project's native ValidationError format.
 * 
 * @param {z.ZodSchema} schema 
 * @returns {Function} Express middleware
 */
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
