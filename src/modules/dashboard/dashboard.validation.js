// crm-api/src/modules/dashboard/dashboard.validation.js
import { z } from "zod";
import { ValidationError } from "../../utils/AppError.js";

export const dashboardQuerySchema = z.object({
  companyId:     z.preprocess((v) => (v && v !== "" ? Number(v) : undefined), z.number().int().positive().optional()),
  branchId:      z.preprocess((v) => (v && v !== "" ? Number(v) : undefined), z.number().int().positive().optional()),
  rankingPeriod: z.enum(["MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM"]).default("MONTHLY"),
  startDate:     z.string().optional(),
  endDate:       z.string().optional(),
  year:          z.preprocess((v) => (v && v !== "" ? Number(v) : undefined), z.number().int().min(2020).max(2100).optional()),
  quarter:       z.preprocess((v) => (v && v !== "" ? Number(v) : undefined), z.number().int().min(1).max(4).optional()),
});

export const validateQuery = (schema) => async (req, res, next) => {
  try {
    const parsed = await schema.parseAsync(req.query);
    Object.assign(req.query, parsed);
    next();
  } catch (error) {
    const issues = error.issues || error.errors || [];
    const formatted = issues.map((e) => ({ field: e.path.join("."), message: e.message }));
    next(new ValidationError("Dashboard query validation failed", formatted));
  }
};
