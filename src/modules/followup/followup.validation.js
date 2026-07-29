// src/modules/followup/followup.validation.js
// Zod v4 (zod@4.4.3) — z.string().datetime() accepts Z and +HH:MM.

import { z } from "zod";
import { ValidationError } from "../../utils/AppError.js";

const FOLLOWUP_TYPES = ["CALL", "MEETING", "DEMO", "WHATSAPP", "EMAIL", "VISIT"];
const followupTypeEnum = z.enum(FOLLOWUP_TYPES);

export const createFollowupSchema = z.object({
  leadId: z.preprocess(
    (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
    z.number().int().positive("Lead ID must be a positive integer")
  ),
  followupType: followupTypeEnum,
  scheduledAt: z.string().datetime({ message: "scheduledAt must be a valid ISO 8601 datetime" }),
  notes: z.string().trim().max(2000).optional().nullable(),
  assignedToId: z.preprocess(
    (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
    z.number().int().positive().optional().nullable()
  ),
});

export const updateFollowupSchema = z
  .object({
    followupType: followupTypeEnum.optional(),
    scheduledAt:  z.string().datetime().optional(),
    notes:        z.string().trim().max(2000).optional().nullable(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: "At least one field must be provided for update" }
  );

export const completeFollowupSchema = z.object({
  completionNotes: z.string().trim().max(2000).optional().nullable(),
});

export const validateBody = (schema) => {
  return async (req, res, next) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      const issues = error?.issues || error?.errors || [];
      if (issues.length) {
        const formattedErrors = issues.map((err) => ({
          field: Array.isArray(err.path) ? err.path.join(".") : String(err.path || ""),
          message: err.message,
        }));
        return next(new ValidationError("Validation failed", formattedErrors));
      }
      next(error);
    }
  };
};
