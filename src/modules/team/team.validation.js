// src/modules/team/team.validation.js

import { z } from "zod";
import { ValidationError } from "../../utils/AppError.js";

/**
 * Schema for creating a new Team
 */
export const createTeamSchema = z.object({
  name: z.string({
    required_error: "Team name is required"
  }).trim().min(1, "Team name cannot be empty"),

  code: z.string({
    required_error: "Team code is required"
  }).trim().toUpperCase().min(1, "Team code cannot be empty"),

  branchId: z.number({
    required_error: "Branch ID is required"
  }).int().positive(),

  bdeId: z.number({
    required_error: "BDE ID is required"
  }).int().positive(),

  companyId: z.number().int().positive().optional(),

  iseIds: z.array(z.number().int().positive()).optional().default([]),

  status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE")
});

/**
 * Schema for updating an existing Team
 */
export const updateTeamSchema = z.object({
  name: z.string({
    required_error: "Team name is required"
  }).trim().min(1, "Team name cannot be empty"),

  bdeId: z.number({
    required_error: "BDE ID is required"
  }).int().positive(),

  status: z.enum(["ACTIVE", "INACTIVE"], {
    required_error: "Status is required"
  }),

  iseIds: z.array(z.number().int().positive()).optional().default([])
});

/**
 * Schema for toggling team status only
 */
export const toggleTeamStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"], {
    required_error: "Status is required"
  })
});

/**
 * Schema for replacing team owner
 */
export const replaceTeamOwnerSchema = z.object({
  bdeId: z.number({
    required_error: "BDE ID is required"
  }).int().positive()
});


/**
 * Middleware factory to validate Express request bodies against a Zod schema.
 */
export const validateBody = (schema) => {
  return async (req, res, next) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.errors || error.issues || [];
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
