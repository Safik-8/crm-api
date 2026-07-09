// src/modules/user/user.validation.js

import { z } from "zod"
import { ValidationError } from "../../utils/AppError.js"

// Schema for onboarding a new user
export const createUserSchema = z.object({
  firstName: z.string({
    required_error: "First name is required"
  }).trim().min(1, "First name cannot be empty"),
  lastName: z.string({
    required_error: "Last name is required"
  }).trim().min(1, "Last name cannot be empty"),
  email: z.string({
    required_error: "Email is required"
  }).trim().email("Enter a valid email address").toLowerCase(),
  mobileNumber: z.string({
    required_error: "Mobile number is required"
  }).trim().min(10, "Mobile number must be at least 10 digits"),
  employeeId: z.string().trim().optional().nullable(),
  joiningDate: z.coerce.date({
    required_error: "Joining date is required",
    invalid_type_error: "Invalid joining date format"
  }),
  companyId: z.number({
    required_error: "Company ID is required"
  }).int().positive(),
  branchId: z.number({
    required_error: "Branch ID is required"
  }).int().positive(),
  roleId: z.number({
    required_error: "Role ID is required"
  }).int().positive(),
  reportingManagerId: z.number().int().positive().nullable().optional(),
})

// Schema for editing an existing user
export const updateUserSchema = z.object({
  firstName: z.string().trim().min(1, "First name cannot be empty").optional(),
  lastName: z.string().trim().min(1, "Last name cannot be empty").optional(),
  mobileNumber: z.string().trim().min(10, "Mobile number must be at least 10 digits").optional(),
  branchId: z.number().int().positive().optional(),
  roleId: z.number().int().positive().optional(),
  reportingManagerId: z.number().int().positive().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional()
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update"
})

// Schema for changing status only
export const toggleStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"], {
    required_error: "Status is required"
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
