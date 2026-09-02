// src/modules/role/role.controllers.js

import {
  getRolesService,
  getRoleByIdService,
  createRoleService,
  updateRoleService,
  deleteRoleService,
  toggleRoleStatusService,
  getRoleUsersService,
} from "./role.services.js"
import { sendSuccess } from "../../utils/response.js"

export const getRoles = async (req, res, next) => {
  try {
    const result = await getRolesService(req.query, req.user)
    return sendSuccess(res, result, "Roles fetched successfully")
  } catch (err) {
    next(err)
  }
}

export const getRoleById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    const role = await getRoleByIdService(id, req.user)
    return sendSuccess(res, { role }, "Role fetched successfully")
  } catch (err) {
    next(err)
  }
}

export const createRole = async (req, res, next) => {
  try {
    const role = await createRoleService(req.body, req.user, req)
    return sendSuccess(res, { role }, "Role created successfully", 201)
  } catch (err) {
    next(err)
  }
}

export const updateRole = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    const role = await updateRoleService(id, req.body, req.user, req)
    return sendSuccess(res, { role }, "Role updated successfully")
  } catch (err) {
    next(err)
  }
}

export const deleteRole = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    const reassignRoleId = req.query.reassignRoleId ? parseInt(req.query.reassignRoleId, 10) : (req.body.reassignRoleId ? parseInt(req.body.reassignRoleId, 10) : undefined)
    const result = await deleteRoleService(id, req.user, reassignRoleId, req)
    return sendSuccess(res, result, "Role deleted successfully")
  } catch (err) {
    next(err)
  }
}

export const toggleRoleStatus = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    const role = await toggleRoleStatusService(id, req.user, req)
    return sendSuccess(res, { role }, "Role status updated successfully")
  } catch (err) {
    next(err)
  }
}

export const getRoleUsers = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10)
    const result = await getRoleUsersService(id, req.user)
    return sendSuccess(res, result, "Role users fetched successfully")
  } catch (err) {
    next(err)
  }
}
