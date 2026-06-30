// src/modules/company/company.validation.js

import { z } from "zod"
import { ValidationError } from "../../utils/AppError.js"

// Schema to validate company onboarding/creation input
export const createCompanySchema = z.object({
  name: z.string({ required_error: "Company name is required" })
    .trim()
    .nonempty("Company name is required"),
  code: z.string({ required_error: "Company code is required" })
    .trim()
    .nonempty("Company code is required")
    .regex(/^[A-Za-z0-9_-]+$/, "Company code must be alphanumeric and can only contain dashes or underscores"),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE")
})

// Schema to validate company updates
export const updateCompanySchema = z.object({
  name: z.string().trim().nonempty("Company name cannot be empty").optional(),
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
