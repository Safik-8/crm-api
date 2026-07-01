// src/modules/branch/branch.validation.js

import { z } from "zod"
import { ValidationError } from "../../utils/AppError.js"

// Validation schema for creating a new branch
export const createBranchSchema = z.object({
  companyId: z.number({
    required_error: "Company ID is required",
    invalid_type_error: "Company ID must be a number"
  }).int().positive(),
  name: z.string({
    required_error: "Branch name is required"
  }).trim().min(1, "Branch name cannot be empty"),
  code: z.string({
    required_error: "Branch code is required"
  }).trim().min(1, "Branch code cannot be empty").toUpperCase(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional()
})

// Validation schema for updating an existing branch
export const updateBranchSchema = z.object({
  name: z.string().trim().min(1, "Branch name cannot be empty").optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional()
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field (name or status) must be provided for update"
})

// Validation schema for onboarding and assigning a user to a branch
export const assignUserSchema = z.object({
  name: z.string({
    required_error: "Full name is required"
  }).trim().min(1, "Full name cannot be empty"),
  email: z.string({
    required_error: "Email address is required"
  }).trim().email("Enter a valid email address").toLowerCase(),
  password: z.string({
    required_error: "Password is required"
  }).min(6, "Password must be at least 6 characters"),
  roleName: z.enum(["BRANCH_MANAGER", "BDE", "ISE"], {
    required_error: "Assign Role is required",
    invalid_type_error: "Role must be one of: BRANCH_MANAGER, BDE, ISE"
  })
})

/**
 * Express middleware to validate request bodies against a Zod schema.
 */
export const validateBody = (schema) => {
  return async (req, res, next) => {
    try {
      req.body = await schema.parseAsync(req.body)
      next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = error.errors.map(err => ({
          field: err.path.join("."),
          message: err.message
        }))
        return next(new ValidationError("Validation failed", formattedErrors))
      }
      next(error)
    }
  }
}
