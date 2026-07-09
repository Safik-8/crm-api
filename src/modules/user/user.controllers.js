// src/modules/user/user.controllers.js

import {
  createUserService,
  updateUserService,
  getUsersService,
  resetUserPasswordService,
  toggleUserStatusService
} from "./user.services.js"
import { findUserById } from "./user.repository.js"
import { NotFoundError } from "../../utils/AppError.js"
import { sendSuccess } from "../../utils/response.js"

export const createUser = async (req, res, next) => {
  try {
    const result = await createUserService(req.body, req.user)
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
    const user = await updateUserService(req.params.id, req.body, req.user)
    return sendSuccess(res, { user }, "User updated successfully")
  } catch (err) { next(err) }
}

export const toggleUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body
    const user = await toggleUserStatusService(req.params.id, status, req.user)
    return sendSuccess(res, { user }, `User status set to ${status} successfully`)
  } catch (err) { next(err) }
}

export const resetUserPassword = async (req, res, next) => {
  try {
    const result = await resetUserPasswordService(req.params.id, req.user)
    return sendSuccess(res, result, "Password reset successfully. Please share the temporary password.")
  } catch (err) { next(err) }
}
