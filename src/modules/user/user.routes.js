// src/modules/user/user.routes.js

import { Router } from "express"
import {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  toggleUserStatus,
  resetUserPassword
} from "./user.controllers.js"
import {
  createUserSchema,
  updateUserSchema,
  toggleStatusSchema,
  validateBody
} from "./user.validation.js"
import { authenticate } from "../../middleware/Authenticate.js"
import { hasPermission } from "../../middleware/hasPermission.js"

const router = Router()

// All routes require JWT authentication
router.use(authenticate)

// POST /api/users — onboard/create a new employee
router.post(
  "/",
  hasPermission("USER", "canCreate"),
  validateBody(createUserSchema),
  createUser
)

// GET /api/users — search and paginate user list
router.get(
  "/",
  hasPermission("USER", "canView"),
  getUsers
)

// GET /api/users/:id — fetch complete details of a single user
router.get(
  "/:id",
  hasPermission("USER", "canView"),
  getUserById
)

// PUT /api/users/:id — edit/update profile fields
router.put(
  "/:id",
  hasPermission("USER", "canEdit"),
  validateBody(updateUserSchema),
  updateUser
)

// PATCH /api/users/:id/status — toggle active/inactive lifecycle state
router.patch(
  "/:id/status",
  hasPermission("USER", "canEdit"),
  validateBody(toggleStatusSchema),
  toggleUserStatus
)

// POST /api/users/:id/reset-password — administrative reset of user password
router.post(
  "/:id/reset-password",
  hasPermission("USER", "canEdit"),
  resetUserPassword
)

export default router
