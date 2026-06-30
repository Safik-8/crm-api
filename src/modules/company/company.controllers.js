// src/modules/company/company.controllers.js

import {
  createCompanyService,
  getAllCompaniesService,
  getCompaniesWithPaginationService,
  getCompanyByIdService,
  updateCompanyService
} from "./company.services.js"
import { sendSuccess } from "../../utils/response.js"

/**
 * Endpoint to onboard a new company.
 * POST /api/companies
 */
export const createCompany = async (req, res, next) => {
  try {
    const company = await createCompanyService(req.body)
    return sendSuccess(res, { company }, "Company created successfully", 201)
  } catch (err) {
    next(err)
  }
}

/**
 * Endpoint to fetch all companies in the registry.
 * GET /api/companies
 */
export const getAllCompanies = async (req, res, next) => {
  try {
    const companies = await getAllCompaniesService()
    return sendSuccess(res, companies, "Companies fetched successfully")
  } catch (err) {
    next(err)
  }
}

/**
 * Endpoint to list companies with pagination, search, filter, and sorting.
 * GET /api/companies/paginated
 */
export const getCompaniesWithPagination = async (req, res, next) => {
  try {
    const result = await getCompaniesWithPaginationService(req.query)
    return sendSuccess(res, result, "Companies fetched successfully")
  } catch (err) {
    next(err)
  }
}

/**
 * Endpoint to fetch single company details by database ID.
 * GET /api/companies/:id
 */
export const getCompanyById = async (req, res, next) => {
  try {
    const company = await getCompanyByIdService(req.params.id)
    return sendSuccess(res, { company }, "Company fetched successfully")
  } catch (err) {
    next(err)
  }
}

/**
 * Endpoint to update company name and operational status.
 * PUT /api/companies/:id
 */
export const updateCompany = async (req, res, next) => {
  try {
    const company = await updateCompanyService(req.params.id, req.body)
    return sendSuccess(res, { company }, "Company updated successfully")
  } catch (err) {
    next(err)
  }
}
