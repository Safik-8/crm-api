// src/modules/role/role.routes.js

import { Router } from "express"
import {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  toggleRoleStatus,
  getRoleUsers
} from "./role.controllers.js"
import {
  createRoleSchema,
  updateRoleSchema,
  validateBody
} from "./role.validation.js"
import { authenticate } from "../../middleware/Authenticate.js"
import { hasPermission } from "../../middleware/hasPermission.js"

const router = Router()

// All routes require authentication
router.use(authenticate)

// Get all roles (with query pagination/filters)
router.get(
  "/",
  hasPermission("ROLE_PERMISSION", "canView"),
  getRoles
)

// Get single role details
router.get(
  "/:id",
  hasPermission("ROLE_PERMISSION", "canView"),
  getRoleById
)

// Get users assigned to a role
router.get(
  "/:id/users",
  hasPermission("ROLE_PERMISSION", "canView"),
  getRoleUsers
)

// Create a new custom role
router.post(
  "/",
  hasPermission("ROLE_PERMISSION", "canCreate"),
  validateBody(createRoleSchema),
  createRole
)

// Update custom role details + permissions
router.put(
  "/:id",
  hasPermission("ROLE_PERMISSION", "canEdit"),
  validateBody(updateRoleSchema),
  updateRole
)

// Delete a custom role
router.delete(
  "/:id",
  hasPermission("ROLE_PERMISSION", "canDelete"),
  deleteRole
)

// Toggle role status (ACTIVE/INACTIVE)
router.patch(
  "/:id/status",
  hasPermission("ROLE_PERMISSION", "canEdit"),
  toggleRoleStatus
)

export default router
