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
  ConflictError,
  ForbiddenError
} from "../../utils/AppError.js"
import { hashPassword } from "../../utils/passwordUtils.js"
import prisma from "../../config/db.js"

/**
 * Onboards a new company and creates its default Company Admin user atomically within a transaction.
 * @param {object} data - Payload containing Company details + Company Admin details
 * @param {object} actor - Currently authenticated user triggering creation
 * @returns {Promise<object>} Created company details
 */
export const createCompanyService = async (data, actor) => {
  // Only Super Admins can register new company tenants
  if (actor?.primaryRole !== "SUPER_ADMIN") {
    throw new ForbiddenError("Access denied: Only Super Admins can onboard new companies")
  }

  const {
    name,
    code,
    logo,
    industry,
    website,
    address,
    status = "ACTIVE",
    adminName,
    adminEmail,
    adminPassword
  } = data

  const formattedCode = code.toUpperCase().trim()
  const formattedEmail = adminEmail.toLowerCase().trim()

  // 1. Verify Company Code is unique
  const existingCompany = await findCompanyByCode(formattedCode)
  if (existingCompany) {
    throw new ConflictError("Company code already exists", "code")
  }

  // 2. Verify Admin Email is unique
  const existingUser = await prisma.user.findUnique({
    where: { email: formattedEmail }
  })
  if (existingUser) {
    throw new ConflictError("Admin email is already registered", "adminEmail")
  }

  // 3. Verify COMPANY_ADMIN role exists
  const companyAdminRole = await prisma.role.findFirst({
    where: { name: "COMPANY_ADMIN" }
  })
  if (!companyAdminRole) {
    throw new NotFoundError("COMPANY_ADMIN role not found in system")
  }

  // 4. Hash the admin's password
  const hashedPassword = await hashPassword(adminPassword)

  // 5. Execute atomic transaction
  return prisma.$transaction(async (tx) => {
    // A. Create Company record
    const company = await createCompany({
      name: name.trim(),
      code: formattedCode,
      logo: logo?.trim() || null,
      industry: industry?.trim() || null,
      website: website?.trim() || null,
      address: address?.trim() || null,
      status
    }, tx)

    // B. Create Admin User mapped to the company scope
    const user = await tx.user.create({
      data: {
        name: adminName.trim(),
        email: formattedEmail,
        passwordHash: hashedPassword,
        companyId: company.id,
        branchId: null, // Global scope for the company
        status: "ACTIVE"
      }
    })

    // C. Assign UserRole mapping to COMPANY_ADMIN
    await tx.userRole.create({
      data: {
        userId: user.id,
        roleId: companyAdminRole.id,
        companyId: company.id,
        branchId: null,
        isPrimary: true,
        assignedBy: actor?.id || null
      }
    })

    return company
  })
}

/**
 * Business logic to fetch all companies ordered by creation date.
 * Scoped: Non-super-admins can only retrieve their own company.
 * @returns {Promise<object[]>} List of allowed companies
 */
export const getAllCompaniesService = async (actor) => {
  if (actor?.primaryRole !== "SUPER_ADMIN") {
    return findCompanies({
      where: { id: actor?.companyId }
    })
  }
  return findCompanies({
    orderBy: { createdAt: "desc" }
  })
}

/**
 * Business logic to search, sort, filter, and paginate company listings.
 * Scoped: Only Super Admins can list all companies in the registry.
 * @param {object} query - Express request query parameters
 * @param {object} actor - Express req.user auth object
 * @returns {Promise<object>} Companies and pagination data
 */
export const getCompaniesWithPaginationService = async (query, actor) => {
  if (actor?.primaryRole !== "SUPER_ADMIN") {
    throw new ForbiddenError("Access denied: Only Super Admins can access the company setup registry")
  }

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
      { code: { contains: search.trim(), mode: "insensitive" } },
      { industry: { contains: search.trim(), mode: "insensitive" } }
    ]
  }

  // 2. Build sorting criteria
  const orderBy = sort === "oldest"
    ? { createdAt: "asc" }
    : sort === "name_asc"
    ? { name: "asc" }
    : sort === "name_desc"
    ? { name: "desc" }
    : { createdAt: "desc" } // default newest

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
 * Scoped: Users can only view details of their own company.
 * @param {string|number} id 
 * @param {object} actor - Express req.user auth object
 * @returns {Promise<object>} Company info
 */
export const getCompanyByIdService = async (id, actor) => {
  const companyId = Number(id)
  if (actor?.primaryRole !== "SUPER_ADMIN" && actor?.companyId !== companyId) {
    throw new ForbiddenError("Access denied: You cannot view details for another company")
  }

  const company = await findCompanyById(companyId)
  if (!company) {
    throw new NotFoundError("Company")
  }
  return company
}

/**
 * Business logic to update an existing company.
 * Scoped: Users can only modify details of their own company.
 * @param {string|number} id 
 * @param {object} data - Updated company fields
 * @param {object} actor - Express req.user auth object
 * @returns {Promise<object>} Updated company details
 */
export const updateCompanyService = async (id, data, actor) => {
  const companyId = Number(id)
  if (actor?.primaryRole !== "SUPER_ADMIN" && actor?.companyId !== companyId) {
    throw new ForbiddenError("Access denied: You cannot update details for another company")
  }

  // Verify existence first
  const company = await findCompanyById(companyId)
  if (!company) {
    throw new NotFoundError("Company")
  }

  const { name, logo, industry, website, address, status } = data
  return updateCompany(companyId, {
    ...(name && { name: name.trim() }),
    ...(logo !== undefined && { logo: logo?.trim() || null }),
    ...(industry !== undefined && { industry: industry?.trim() || null }),
    ...(website !== undefined && { website: website?.trim() || null }),
    ...(address !== undefined && { address: address?.trim() || null }),
    ...(status && { status })
  })
}
