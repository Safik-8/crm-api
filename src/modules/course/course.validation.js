// src/modules/course/course.validation.js

import { z } from "zod";
import { ValidationError } from "../../utils/AppError.js";

/**
 * Schema for onboarding/creating a new Course
 */
export const createCourseSchema = z.object({
  name: z.string({
    required_error: "Course name is required"
  }).trim().min(1, "Course name cannot be empty"),
  
  code: z.string().trim().toUpperCase().optional(), // Normalize course codes to uppercase
  
  description: z.string().trim().optional().nullable(),
  
  category: z.string({
    required_error: "Category is required"
  }).trim().min(1, "Category cannot be empty"),
  
  parentCategory: z.string().trim().optional().nullable(),
  
  price: z.preprocess(
    (val) => {
      // Coerce input into numeric value if passed as string (e.g. from FormData)
      if (typeof val === "string") return parseFloat(val);
      return val;
    },
    z.number({
      required_error: "Price is required",
      invalid_type_error: "Price must be a valid number"
    }).nonnegative("Price cannot be negative")
  ),
  
  duration: z.string().trim().optional().nullable(),
  
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  
  companyId: z.number({
    required_error: "Company ID is required"
  }).int().positive(),
});

/**
 * Schema for updating an existing Course
 * All fields are optional but must meet rules if provided.
 */
export const updateCourseSchema = z.object({
  name: z.string().trim().min(1, "Course name cannot be empty").optional(),
  
  // Note: code is typically immutable to prevent integrity issues.
  // We keep it optional here in case admins are allowed to correct typo during creation.
  code: z.string().trim().min(1, "Course code cannot be empty").toUpperCase().optional(),
  
  description: z.string().trim().optional().nullable(),
  
  category: z.string().trim().min(1, "Category cannot be empty").optional(),
  
  parentCategory: z.string().trim().optional().nullable(),
  
  price: z.preprocess(
    (val) => {
      if (typeof val === "string") return parseFloat(val);
      return val;
    },
    z.number({
      invalid_type_error: "Price must be a number"
    }).nonnegative("Price cannot be negative")
  ).optional(),
  
  duration: z.string().trim().optional().nullable(),
  
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field must be provided for update" }
);

/**
 * Schema for toggling active/inactive status only
 */
export const toggleCourseStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"], {
    required_error: "Status is required"
  })
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
