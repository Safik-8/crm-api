// crm-api/src/modules/revenueReport/revenueReport.validation.js

import { z } from "zod";
import { ValidationError } from "../../utils/AppError.js";

/**
 * Zod Schema for Revenue & Financial Reports Query Parameters
 */
export const revenueFilterQuerySchema = z.object({
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
  courseId: z.preprocess(
    (v) => (v !== undefined && v !== null && v !== "" ? Number(v) : undefined),
    z.number().int().positive().optional()
  ),
  rankingPeriod: z.enum(["ALL", "MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM"]).default("ALL"),
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
  )
});

/**
 * Zod Schema for Export Audit Log POST Body
 */
export const createExportLogSchema = z.object({
  reportName: z.string().min(1, "Report name is required"),
  exportType: z.enum(["EXCEL", "CSV", "PDF"]),
  fileName: z.string().min(1, "File name is required"),
  filtersUsed: z.record(z.any()).optional()
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

/**
 * Body Validation Middleware Factory
 */
export const validateBody = (schema) => {
  return async (req, res, next) => {
    try {
      const parsed = await schema.parseAsync(req.body);
      req.body = parsed;
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
