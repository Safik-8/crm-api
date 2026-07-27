// src/modules/lead/lead.validation.js

import { z } from "zod";
import { ValidationError } from "../../utils/AppError.js";

// ─── Reusable field definitions ───────────────────────────────────────────────

const mobileField = z
  .string({ required_error: "Mobile number is required" })
  .trim()
  .regex(/^\d{10}$/, "Mobile number must be exactly 10 digits");

const priorityField = z
  .enum(["HIGH", "MEDIUM", "LOW"], {
    errorMap: () => ({ message: "Priority must be HIGH, MEDIUM, or LOW" })
  })
  .default("MEDIUM");

// ─── Create Lead Schema ───────────────────────────────────────────────────────

export const createLeadSchema = z.object({
  name: z
    .string({ required_error: "Lead name is required" })
    .trim()
    .min(1, "Lead name cannot be empty")
    .max(100, "Lead name must be 100 characters or less")
    .refine((v) => !/\d/.test(v), "Lead name must not contain numbers"),

  mobile: mobileField,

  sourceId: z.preprocess(
    (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
    z
      .number({ required_error: "Lead source is required" })
      .int()
      .positive("Lead source is required")
  ),

  courseId: z.preprocess(
    (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
    z
      .number({ required_error: "Interested course is required" })
      .int()
      .positive("Interested course is required")
  ),

  statusId: z.preprocess(
    (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
    z.number().int().positive().optional().nullable()
  ),

  priority: priorityField,

  email: z
    .string()
    .trim()
    .email("Must be a valid email address")
    .optional()
    .nullable()
    .or(z.literal("")),

  alternateMobile: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "Alternate mobile must be exactly 10 digits")
    .optional()
    .nullable()
    .or(z.literal("")),

  budget: z.preprocess(
    (v) => (v !== undefined && v !== null && v !== "" ? parseFloat(v) : undefined),
    z
      .number()
      .nonnegative("Budget cannot be negative")
      .optional()
      .nullable()
  ),

  city:    z.string().trim().optional().nullable(),
  state:   z.string().trim().optional().nullable(),
  country: z.string().trim().optional().nullable(),
  notes:   z.string().trim().optional().nullable(),

  assignedToId: z.preprocess(
    (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
    z.number().int().positive().optional().nullable()
  ),

  // Optional — Kanban flow still passes pipelineId
  pipelineId: z.preprocess(
    (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
    z.number().int().positive().optional().nullable()
  ),

  // Backward compat — Kanban form uses interestedFor
  interestedFor: z.string().trim().optional().nullable(),
  interested_for: z.string().trim().optional().nullable(),

  companyId: z.preprocess(
    (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
    z.number().int().positive().optional().nullable()
  ),
  branchId: z.preprocess(
    (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
    z.number().int().positive().optional().nullable()
  ),
  overrideDuplicate: z.boolean().optional(),
});

// ─── Update Lead Schema ───────────────────────────────────────────────────────

export const updateLeadSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Lead name cannot be empty")
      .max(100, "Lead name must be 100 characters or less")
      .refine((v) => !/\d/.test(v), "Lead name must not contain numbers")
      .optional(),

    mobile: z
      .string()
      .trim()
      .regex(/^\d{10}$/, "Mobile number must be exactly 10 digits")
      .optional(),

    email: z
      .string()
      .trim()
      .email("Must be a valid email address")
      .optional()
      .nullable()
      .or(z.literal("")),

    alternateMobile: z
      .string()
      .trim()
      .regex(/^\d{10}$/, "Alternate mobile must be exactly 10 digits")
      .optional()
      .nullable()
      .or(z.literal("")),

    sourceId: z.preprocess(
      (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
      z.number().int().positive().optional()
    ),

    courseId: z.preprocess(
      (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
      z.number().int().positive().optional()
    ),

    statusId: z.preprocess(
      (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
      z.number().int().positive().optional().nullable()
    ),

    priority: z
      .enum(["HIGH", "MEDIUM", "LOW"], {
        errorMap: () => ({ message: "Priority must be HIGH, MEDIUM, or LOW" })
      })
      .optional(),

    budget: z.preprocess(
      (v) => (v !== undefined && v !== null && v !== "" ? parseFloat(v) : undefined),
      z.number().nonnegative("Budget cannot be negative").optional().nullable()
    ),

    city:    z.string().trim().optional().nullable(),
    state:   z.string().trim().optional().nullable(),
    country: z.string().trim().optional().nullable(),
    notes:   z.string().trim().optional().nullable(),

    assignedToId: z.preprocess(
      (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
      z.number().int().positive().optional().nullable()
    ),

    // Kanban backward compat
    interestedFor:  z.string().trim().optional().nullable(),
    interested_for: z.string().trim().optional().nullable(),

    companyId: z.preprocess(
      (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
      z.number().int().positive().optional().nullable()
    ),
    branchId: z.preprocess(
      (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
      z.number().int().positive().optional().nullable()
    ),
    overrideDuplicate: z.boolean().optional(),
  })
  .refine(
    (data) => Object.keys(data).filter((k) => data[k] !== undefined).length > 0,
    { message: "At least one field must be provided for update" }
  );

// ─── Stage Update Schema ──────────────────────────────────────────────────────

export const updateLeadStageSchema = z.object({
  stageId: z.preprocess(
    (v) => Number(v),
    z
      .number({ required_error: "stageId is required" })
      .int()
      .positive("stageId must be a valid stage id")
  )
});

// ─── Add Comment Schema ───────────────────────────────────────────────────────

export const addCommentSchema = z.object({
  comment: z
    .string({ required_error: "Comment is required" })
    .trim()
    .min(1, "Comment cannot be empty")
    .max(2000, "Comment must be 2000 characters or less")
});

export const assignLeadsSchema = z.object({
  leadIds: z
    .array(z.number().int().positive("Lead ID must be a positive integer"))
    .min(1, "At least one lead ID must be provided"),
  teamId: z.preprocess(
    (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
    z.number().int().positive().optional().nullable()
  ),
  assignedToId: z.preprocess(
    (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
    z.number().int().positive().optional().nullable()
  ),
  notes: z.string().trim().max(1000).optional().nullable(),
  reason: z.string().trim().max(1000).optional().nullable(),
}).refine(
  (data) => (data.teamId !== undefined && data.teamId !== null) || (data.assignedToId !== undefined && data.assignedToId !== null),
  {
    message: "Either a team or a user must be selected for assignment",
    path: ["teamId"]
  }
);

// ─── Middleware factory ───────────────────────────────────────────────────────

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

