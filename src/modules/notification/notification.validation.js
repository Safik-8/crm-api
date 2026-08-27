import { z } from "zod";
import { ValidationError } from "../../utils/AppError.js";

export const getNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  daysLimit: z.coerce.number().int().min(0).default(3),
  status: z.enum(["ALL", "UNREAD", "READ"]).optional(),
  priority: z.enum(["URGENT", "HIGH", "MEDIUM", "LOW"]).optional(),
  moduleName: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  scope: z.enum(["personal", "company", "branch"]).default("personal"),
});

export const updateNotificationConfigSchema = z.object({
  isEnabled: z.boolean().optional(),
  channels: z
    .object({
      inApp: z.boolean().optional(),
      email: z.boolean().optional(),
      push: z.boolean().optional(),
    })
    .optional(),
  rolesToNotify: z.array(z.string()).optional(),
  templateTitle: z.string().optional(),
  templateBody: z.string().optional(),
});

export const validateQuery = (schema) => async (req, res, next) => {
  try {
    const parsed = await schema.parseAsync(req.query);
    Object.assign(req.query, parsed);
    next();
  } catch (error) {
    if (error?.issues || error?.errors) {
      const issues = error.issues || error.errors || [];
      const formattedErrors = issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return next(new ValidationError("Validation failed", formattedErrors));
    }
    next(error);
  }
};

export const validateBody = (schema) => async (req, res, next) => {
  try {
    req.body = await schema.parseAsync(req.body);
    next();
  } catch (error) {
    if (error?.issues || error?.errors) {
      const issues = error.issues || error.errors || [];
      const formattedErrors = issues.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      return next(new ValidationError("Validation failed", formattedErrors));
    }
    next(error);
  }
};

