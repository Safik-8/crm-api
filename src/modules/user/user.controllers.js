import {
  createUserService,
  updateUserService,
  getUsersService,
  resetUserPasswordService,
  toggleUserStatusService,
  getAssignableRolesService,
  getEligibleReplacementsService,
  deleteUserService
} from "./user.services.js"
import { findUserById } from "./user.repository.js"
import { NotFoundError } from "../../utils/AppError.js"
import { sendSuccess } from "../../utils/response.js"

export const createUser = async (req, res, next) => {
  try {
    const result = await createUserService(req.body, req.user, req)
    return sendSuccess(res, result, "User created successfully", 201)
  } catch (err) { next(err) }
}

export const getUsers = async (req, res, next) => {
  try {
    const result = await getUsersService(req.query, req.user)
    return sendSuccess(res, result, "Users fetched successfully")
  } catch (err) { next(err) }
}

export const getUserById = async (req, res, next) => {
  try {
    const user = await findUserById(Number(req.params.id))
    if (!user) throw new NotFoundError("User")
    return sendSuccess(res, { user }, "User details fetched successfully")
  } catch (err) { next(err) }
}

export const updateUser = async (req, res, next) => {
  try {
    const user = await updateUserService(req.params.id, req.body, req.user, req)
    return sendSuccess(res, { user }, "User updated successfully")
  } catch (err) { next(err) }
}

export const toggleUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body
    const user = await toggleUserStatusService(req.params.id, status, req.user, req)
    return sendSuccess(res, { user }, `User status set to ${status} successfully`)
  } catch (err) { next(err) }
}

export const resetUserPassword = async (req, res, next) => {
  try {
    const result = await resetUserPasswordService(req.params.id, req.user, req)
    return sendSuccess(res, result, "Password reset successfully. Please share the temporary password.")
  } catch (err) { next(err) }
}

/**
 * GET /api/users/assignable-roles
 * Returns roles the current actor is allowed to assign when onboarding a user.
 * Requires USER:canCreate permission (accessible to Branch Managers).
 */
export const getAssignableRoles = async (req, res, next) => {
  try {
    const roles = await getAssignableRolesService(req.user)
    return sendSuccess(res, { roles }, "Assignable roles fetched successfully")
  } catch (err) { next(err) }
}

export const getEligibleReplacements = async (req, res, next) => {
  try {
    const result = await getEligibleReplacementsService(req.params.id, req.user)
    return sendSuccess(res, result, "Eligible replacement candidates fetched successfully")
  } catch (err) { next(err) }
}

export const deleteUser = async (req, res, next) => {
  try {
    const { replacementUserId } = req.body || {}
    const result = await deleteUserService(req.params.id, replacementUserId, req.user, req)
    return sendSuccess(res, result, "User hard deleted successfully")
  } catch (err) { next(err) }
}
