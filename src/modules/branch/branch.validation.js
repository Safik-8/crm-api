// src/modules/branch/branch.validation.js

import { z } from "zod"
import { ValidationError } from "../../utils/AppError.js"
import { passwordSchema } from "../auth/auth.validation.js"

// Validation schema for creating a new branch
export const createBranchSchema = z.object({
  companyId: z.number({
    required_error: "Company ID is required",
    invalid_type_error: "Company ID must be a number"
  }).int().positive("Company ID must be a positive number"),
  name: z.string({
    required_error: "Branch name is required"
  }).trim().min(1, "Branch name cannot be empty"),
  code: z.string({
    required_error: "Branch code is required"
  }).trim().min(1, "Branch code cannot be empty").regex(/^[A-Za-z0-9_-]+$/, "Branch code must be alphanumeric and can only contain dashes or underscores").toUpperCase(),
  address: z.string().trim().optional().nullable(),
  location: z.string().trim().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional()
})

// Validation schema for updating an existing branch
export const updateBranchSchema = z.object({
  name: z.string().trim().min(1, "Branch name cannot be empty").optional(),
  address: z.string().trim().optional().nullable(),
  location: z.string().trim().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  maxDailyLeadsPerUser: z.number().int().min(50, "Daily lead limit must be at least 50").optional().nullable(),
  autoAssignmentEnabled: z.boolean().optional(),
  assignmentAlgorithm: z.enum(["ROUND_ROBIN", "LEAST_WORKLOAD", "PRIORITY_BASED"]).optional().nullable(),
  assignmentResolutionLevel: z.enum(["PERSON", "TEAM"]).optional()
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update"
})

// Validation schema for onboarding and assigning a user to a branch
export const assignUserSchema = z.object({
  name: z.string({
    required_error: "Full name is required"
  }).trim().min(1, "Full name cannot be empty"),
  email: z.string({
    required_error: "Email address is required"
  }).trim().email("Enter a valid email address").toLowerCase(),
  password: passwordSchema,
  primaryRole: z.string({
    required_error: "Primary Role is required"
  }).trim().min(1, "Primary Role is required"),
  secondaryRoles: z.array(z.string().trim()).optional().default([])
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
        const issues = error.errors || error.issues || []
        const formattedErrors = issues.map(err => ({
          field: err.path.join("."),
          message: err.message
        }))
        return next(new ValidationError("Validation failed", formattedErrors))
      }
      next(error)
    }
  }
}
