// crm-api/src/modules/salesPerformance/salesPerformance.validation.js

import { z } from "zod";
import { ValidationError } from "../../utils/AppError.js";

/**
 * Validation schema for Sales Performance Filter Queries
 */
export const performanceFilterQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  companyId: z.preprocess(
    (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
    z.number().int().positive().optional()
  ),
  branchId: z.preprocess(
    (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
    z.number().int().positive().optional()
  ),
  teamId: z.preprocess(
    (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
    z.number().int().positive().optional()
  ),
  employeeId: z.preprocess(
    (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
    z.number().int().positive().optional()
  ),
  rankingPeriod: z.enum(["MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM"]).default("MONTHLY"),
  year: z.preprocess(
    (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
    z.number().int().min(2020).max(2100).optional()
  ),
  quarter: z.preprocess(
    (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
    z.number().int().min(1).max(4).optional()
  ),
  page: z.preprocess(
    (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : 1),
    z.number().int().positive().default(1)
  ),
  limit: z.preprocess(
    (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : 20),
    z.number().int().positive().max(100).default(20)
  ),
  sortBy: z.enum(["revenue", "conversionRate", 'dealsWon', "leadsAssigned"]).default("revenue"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});

/**
 * Query Validation Middleware Factory
 */
export const validateQuery = (schema) => {
  return async (req, res, next) => {
    try {
      const parsed = await schema.parseAsync(req.query);
      Object.assign(req.query, parsed);
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
