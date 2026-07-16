// src/modules/leadsources/leadsources.validation.js

import { z } from "zod"
import { ValidationError } from "../../utils/AppError.js"

export const createLeadSourceSchema = z.object({
  name: z.string({
    required_error: "Lead source name is required"
  }).trim().min(1, "Lead source name cannot be empty").max(100, "Lead source name must be under 100 characters"),
  description: z.string().trim().max(500, "Description must be under 500 characters").optional().nullable(),
  isGlobal: z.boolean().optional().default(false)
})

const booleanCoerce = z.preprocess((val) => {
  if (typeof val === "string") {
    if (val.toLowerCase() === "true") return true
    if (val.toLowerCase() === "false") return false
  }
  return val
}, z.boolean())

export const updateLeadSourceSchema = z.object({
  name: z.string().trim().min(1, "Lead source name cannot be empty").max(100, "Lead source name must be under 100 characters").optional(),
  description: z.string().trim().max(500, "Description must be under 500 characters").optional().nullable(),
  isActive: booleanCoerce.optional()
})

export const validateBody = (schema) => {
  return async (req, res, next) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error?.issues || error?.errors) {
        const issues = error.issues || error.errors || [];
        const formattedErrors = issues.map((err) => ({
          field: err.path.join("."),
          message: err.message
        }));
        return next(new ValidationError("Validation failed", formattedErrors));
      }
      next(error);
    }
  };
};
