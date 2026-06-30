// src/modules/company/company.services.js

import {
  createCompany,
  findCompanyByCode,
  findCompanyById,
  findCompanies,
  countCompanies,
  updateCompany
} from "./company.repository.js"
import {
  NotFoundError,
  ConflictError
} from "../../utils/AppError.js"

/**
 * Business logic to onboard a new company.
 * @param {object} data - { name, code, status }
 * @returns {Promise<object>} Created company
 */
export const createCompanyService = async (data) => {
  const { name, code, status } = data
  const formattedCode = code.toUpperCase().trim()

  // Business Rule: Check for code conflict
  const existing = await findCompanyByCode(formattedCode)
  if (existing) {
    throw new ConflictError("Company code already exists", "code")
  }

  return createCompany({
    name: name.trim(),
    code: formattedCode,
    status
  })
}

/**
 * Business logic to fetch all companies ordered by creation date.
 * @returns {Promise<object[]>} List of all companies
 */
export const getAllCompaniesService = async () => {
  return findCompanies({
    orderBy: { createdAt: "desc" }
  })
}

/**
 * Business logic to search, sort, filter, and paginate company listings.
 * @param {object} query - Express request query parameters
 * @returns {Promise<object>} Companies and pagination data
 */
export const getCompaniesWithPaginationService = async (query) => {
  const {
    search,
    status,
    page = 1,
    limit = 10,
    sort = "newest"
  } = query

  // 1. Build dynamic filters
  const where = {}
  if (status) {
    where.status = status
  }
  if (search) {
    where.OR = [
      { name: { contains: search.trim(), mode: "insensitive" } },
      { code: { contains: search.trim(), mode: "insensitive" } }
    ]
  }

  // 2. Build sorting criteria
  const orderBy = sort === "oldest"
    ? { createdAt: "asc" }
    : sort === "name_asc"
    ? { name: "asc" }
    : sort === "name_desc"
    ? { name: "desc" }
    : { createdAt: "desc" } // default

  // 3. Compute offset pagination bounds
  const parsedPage = Math.max(1, Number(page))
  const parsedLimit = Math.max(1, Number(limit))
  const skip = (parsedPage - 1) * parsedLimit

  // 4. Query DB via Repository
  const [companies, total] = await Promise.all([
    findCompanies({
      where,
      orderBy,
      skip,
      take: parsedLimit
    }),
    countCompanies(where)
  ])

  const totalPages = Math.ceil(total / parsedLimit)

  return {
    companies,
    pagination: {
      total,
      page: parsedPage,
      limit: parsedLimit,
      pages: totalPages,
      hasNext: parsedPage < totalPages,
      hasPrev: parsedPage > 1
    }
  }
}

/**
 * Business logic to fetch details of a specific company by ID.
 * @param {string|number} id 
 * @returns {Promise<object>} Company info
 */
export const getCompanyByIdService = async (id) => {
  const companyId = Number(id)
  const company = await findCompanyById(companyId)
  if (!company) {
    throw new NotFoundError("Company")
  }
  return company
}

/**
 * Business logic to update an existing company.
 * @param {string|number} id 
 * @param {object} data - { name, status }
 * @returns {Promise<object>} Updated company
 */
export const updateCompanyService = async (id, data) => {
  const companyId = Number(id)

  // Verify existence first
  const company = await findCompanyById(companyId)
  if (!company) {
    throw new NotFoundError("Company")
  }

  const { name, status } = data
  return updateCompany(companyId, {
    ...(name && { name: name.trim() }),
    ...(status && { status })
  })
}
