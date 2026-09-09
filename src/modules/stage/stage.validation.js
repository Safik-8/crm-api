// src/modules/stage/stage.validation.js

import { z } from "zod"
import { ValidationError } from "../../utils/AppError.js"

// ─── Create Stage Schema ──────────────────────────────────────────────────────

export const createStageSchema = z.object({
  name: z
    .string({ required_error: "Stage name is required" })
    .trim()
    .min(1, "Stage name cannot be empty")
    .max(100, "Stage name must be 100 characters or less"),

  code: z
    .string()
    .trim()
    .max(30, "Code must be 30 characters or less")
    .transform((v) => (v ? v.toUpperCase() : null))
    .optional()
    .nullable()
    .or(z.literal("")),

  colorCode: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "colorCode must be a valid 6-digit hex color (e.g. #22c55e)")
    .optional()
    .nullable()
    .or(z.literal("")),

  displayOrder: z.preprocess(
    (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
    z.number().int().nonnegative("displayOrder must be a non-negative integer").optional()
  ),

  stageType: z
    .enum(["REGULAR", "PROSPECT", "CLOSURE", "WON", "LOST"], {
      errorMap: () => ({ message: "stageType must be one of: REGULAR, PROSPECT, CLOSURE, WON, LOST" })
    })
    .optional()
    .default("REGULAR")
})

// ─── Update Stage Schema ──────────────────────────────────────────────────────

export const updateStageSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Stage name cannot be empty")
      .max(100, "Stage name must be 100 characters or less")
      .optional(),

    code: z
      .string()
      .trim()
      .max(30, "Code must be 30 characters or less")
      .transform((v) => (v ? v.toUpperCase() : null))
      .optional()
      .nullable()
      .or(z.literal("")),

    colorCode: z
      .string()
      .trim()
      .regex(/^#[0-9A-Fa-f]{6}$/, "colorCode must be a valid 6-digit hex color (e.g. #22c55e)")
      .optional()
      .nullable()
      .or(z.literal("")),

    displayOrder: z.preprocess(
      (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
      z.number().int().nonnegative("displayOrder must be a non-negative integer").optional()
    ),

    stageType: z
      .enum(["REGULAR", "PROSPECT", "CLOSURE", "WON", "LOST"], {
        errorMap: () => ({ message: "stageType must be one of: REGULAR, PROSPECT, CLOSURE, WON, LOST" })
      })
      .optional()
  })
  .refine(
    (data) => Object.keys(data).filter((k) => data[k] !== undefined).length > 0,
    { message: "At least one field must be provided for update" }
  )

// ─── Toggle Stage Status Schema ───────────────────────────────────────────────

export const toggleStageStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"], {
    required_error: "status is required",
    errorMap: () => ({ message: "status must be either ACTIVE or INACTIVE" })
  })
})

// ─── Validation Middleware Factory ────────────────────────────────────────────

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
