import { z } from "zod"
import { ValidationError } from "../../utils/AppError.js"

export const createPipelineSchema = z.object({
  name: z.string({
    required_error: "name is required"
  }).trim().min(1, "name cannot be empty").max(100, "name must be under 100 characters"),
  companyId: z.number().int().positive("companyId must be a positive integer").optional().nullable(),
  branchId: z.number().int().positive("branchId must be a positive integer").optional().nullable()
})

export const updatePipelineSchema = z.object({
  name: z.string({
    required_error: "name is required"
  }).trim().min(1, "name cannot be empty").max(100, "name must be under 100 characters")
})

export const assignStagesSchema = z.object({
  stageIds: z.array(z.number().int().positive()).nullable().optional(),
  newStages: z.array(z.object({
    name: z.string().trim().min(1, "Stage name cannot be empty")
  })).nullable().optional(),
  orderedStageIds: z.array(z.number().int().positive()).optional().nullable()
})

export const updatePipelineStageOrderSchema = z.object({
  orderedStageIds: z.array(z.number().int().positive(), {
    required_error: "orderedStageIds is required"
  }).min(1, "orderedStageIds array cannot be empty")
})

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
          message: err.message
        }))
        return next(new ValidationError("Validation failed", formattedErrors))
      }
      next(error)
    }
  }
}
