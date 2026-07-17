// src/modules/leadstatuses/leadstatuses.validation.js
import { z } from "zod"
import { ValidationError } from "../../utils/AppError.js"

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/

const booleanCoerce = z.preprocess((val) => {
  if (typeof val === "string") {
    if (val.toLowerCase() === "true") return true
    if (val.toLowerCase() === "false") return false
  }
  return val
}, z.boolean())

export const createLeadStatusSchema = z.object({
  name:          z.string({ required_error: "Status name is required" })
                  .trim().min(1, "Name cannot be empty").max(80, "Name must be under 80 characters"),
  displayColor:  z.string({ required_error: "Display color is required" })
                  .regex(HEX_COLOR_REGEX, "Must be a valid 6-digit hex color (e.g. #3b82f6)"),
  sequenceOrder: z.number().int().min(0).optional(),
  isDefault:     booleanCoerce.optional().default(false),
})

export const updateLeadStatusSchema = z.object({
  name:          z.string().trim().min(1).max(80).optional(),
  displayColor:  z.string().regex(HEX_COLOR_REGEX).optional(),
  sequenceOrder: z.number().int().min(0).optional(),
  isActive:      booleanCoerce.optional(),
  isDefault:     booleanCoerce.optional(),
})

export const reorderLeadStatusesSchema = z.array(
  z.object({
    id:            z.number().int().positive("ID must be a positive integer"),
    sequenceOrder: z.number().int().min(0, "Sequence must be >= 0"),
  })
).min(1, "At least one item required").max(100, "Too many items in a single reorder")

// Shared middleware factory
export const validateBody = (schema) => {
  return async (req, res, next) => {
    try {
      req.body = await schema.parseAsync(req.body)
      next()
    } catch (error) {
      if (error?.issues || error?.errors) {
        const issues = error.issues || error.errors || []
        const formattedErrors = issues.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }))
        return next(new ValidationError("Validation failed", formattedErrors))
      }
      next(error)
    }
  }
}
