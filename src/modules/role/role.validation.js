// src/modules/role/role.validation.js

import { z } from "zod"
import { ValidationError } from "../../utils/AppError.js"
import { MODULES } from "../../config/roleConstants.js"

const permissionSchema = z.object({
  module: z.enum(MODULES, { required_error: "Valid module is required" }),
  canView: z.boolean().default(false),
  canCreate: z.boolean().default(false),
  canEdit: z.boolean().default(false),
  canDelete: z.boolean().default(false),
  canArchive: z.boolean().default(false),
})

export const createRoleSchema = z.object({
  name: z.string({ required_error: "Role name is required" })
    .trim()
    .nonempty("Role name is required"),
  description: z.string().trim().optional(),
  rank: z.number().min(0).max(100).optional(),
  companyId: z.number().nullable().optional(),
  permissions: z.array(permissionSchema).optional().default([]),
})

export const updateRoleSchema = z.object({
  name: z.string().trim().nonempty("Role name cannot be empty").optional(),
  description: z.string().trim().optional(),
  rank: z.number().min(0).max(100).optional(),
  companyId: z.number().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  permissions: z.array(permissionSchema).optional(),
})

/**
 * Express middleware to validate request body against a Zod schema.
 */
export const validateBody = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)

    if (!result.success) {
      const fields = result.error.errors.map(err => ({
        field: err.path.join("."),
        message: err.message
      }))
      return next(new ValidationError("Validation failed", fields))
    }

    req.body = result.data
    next()
  }
}
