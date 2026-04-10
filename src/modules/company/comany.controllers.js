// src/modules/company/company.controller.js

import {
  createCompanyService,
  getAllCompaniesService,
  getCompanyByIdService,
  updateCompanyService
} from "./comany.services.js"
import { sendSuccess } from "../../utils/response.js"

export const createCompany = async (req, res, next) => {
  try {
    const company = await createCompanyService(req.body, req.user)
    return sendSuccess(res, { company }, "Company created successfully", 201)
  } catch (err) { next(err) }
}

export const getAllCompanies = async (req, res, next) => {
  try {
    const companies = await getAllCompaniesService()
    return sendSuccess(res, companies, "Companies fetched")
  } catch (err) {
    next(err)
  }
}

export const getCompanyById = async (req, res, next) => {
  try {
    const company = await getCompanyByIdService(req.params.id)
    return sendSuccess(res, { company }, "Company fetched")
  } catch (err) { next(err) }
}

export const updateCompany = async (req, res, next) => {
  try {
    const company = await updateCompanyService(req.params.id, req.body)
    return sendSuccess(res, { company }, "Company updated successfully")
  } catch (err) { next(err) }
}