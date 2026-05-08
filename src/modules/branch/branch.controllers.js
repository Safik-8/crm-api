// src/modules/branch/branch.controller.js

import {
  createBranchService,
  getBranchesService,
  getBranchByIdService,
  updateBranchService,
  assignUserToBranchService,
  getBranchesPaginatedService
} from "./branch.services.js"
import { sendSuccess } from "../../utils/response.js"

export const createBranch = async (req, res, next) => {
  try {
    const branch = await createBranchService(req.body, req.user)
    return sendSuccess(res, { branch }, "Branch created successfully", 201)
  } catch (err) { next(err) }
}

export const getBranches = async (req, res, next) => {
  try {
    const result = await getBranchesService(req.query, req.user)
    return sendSuccess(res, result, "Branches fetched")
  } catch (err) { next(err) }
}

export const getBranchesPaginated = async (req, res, next) => {
  try {
    const result = await getBranchesPaginatedService(req.query, req.user)
    return sendSuccess(res, result, "Branches fetched successfully")
  } catch (err) { next(err) }
}

export const getBranchById = async (req, res, next) => {
  try {
    const branch = await getBranchByIdService(req.params.id, req.user)
    return sendSuccess(res, { branch }, "Branch fetched")
  } catch (err) { next(err) }
}

export const updateBranch = async (req, res, next) => {
  try {
    const branch = await updateBranchService(req.params.id, req.body, req.user)
    return sendSuccess(res, { branch }, "Branch updated successfully")
  } catch (err) { next(err) }
}

export const assignUserToBranch = async (req, res, next) => {
  try {
    const user = await assignUserToBranchService(req.params.id, req.body, req.user)
    return sendSuccess(res, { user }, "User assigned to branch successfully")
  } catch (err) { next(err) }
}