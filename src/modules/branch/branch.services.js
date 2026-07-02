// src/modules/branch/branch.services.js

import {
  createBranch,
  findBranchByCodeInCompany,
  findBranchById,
  findBranches,
  countBranches,
  updateBranch
} from "./branch.repository.js"
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError
} from "../../utils/AppError.js"
import { hashPassword } from "../../utils/passwordUtils.js"
import prisma from "../../config/db.js"

// ══════════════════════════════════════
// SCOPE GUARD
// Every query must be scoped by companyId
// ══════════════════════════════════════
const assertCompanyScope = (actor, targetCompanyId) => {
  if (actor.primaryRole === "SUPER_ADMIN") return
  if (actor.companyId !== targetCompanyId) {
    throw new ForbiddenError("You cannot access data from another company")
  }
}

// ── ROLE CREATION RULES ───────────────────────────────────
const ROLE_CREATION_RULES = {
  SUPER_ADMIN: ["SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER", "BDE", "ISE"],
  COMPANY_ADMIN: ["BRANCH_MANAGER", "BDE", "ISE"],
  BRANCH_MANAGER: ["BDE", "ISE"],
  BDE: [],
  ISE: [],
}

// ── ROLES THAT NEED BRANCH ────────────────────────────────
const ROLES_NEED_BRANCH = ["BRANCH_MANAGER", "BDE", "ISE"]

/**
 * Creates and registers a new branch inside a company.
 */
export const createBranchService = async (data, actor) => {
  const { companyId, name, code, address, location, status = "ACTIVE" } = data
  const formattedCode = code.toUpperCase().trim()

  // Scope check — cannot create branch in another company
  assertCompanyScope(actor, Number(companyId))

  // Check company exists
  const company = await prisma.company.findUnique({
    where: { id: Number(companyId) }
  })
  if (!company) throw new NotFoundError("Company")
  if (company.status !== "ACTIVE") {
    throw new ValidationError("Company is inactive")
  }

  // Check code unique within company
  const existing = await findBranchByCodeInCompany(Number(companyId), formattedCode)
  if (existing) {
    throw new ConflictError("Branch code already exists in this company", "code")
  }

  return createBranch({
    companyId: Number(companyId),
    name: name.trim(),
    code: formattedCode,
    address: address?.trim() || null,
    location: location?.trim() || null,
    status
  })
}

/**
 * Fetches all branches in a company (raw list for dropdowns).
 */
export const getBranchesService = async (query, actor) => {
  const { company_id } = query

  // ── 1. DETERMINE COMPANY SCOPE ─────────────────────────
  const scopedCompanyId = actor.primaryRole === "SUPER_ADMIN"
    ? Number(company_id)
    : actor.companyId

  if (!scopedCompanyId) {
    throw new ValidationError("Validation failed", [
      { field: "company_id", message: "company_id is required" }
    ])
  }

  // ── 2. NON SUPER ADMIN CHECK ───────────────────────────
  if (actor.primaryRole !== "SUPER_ADMIN" && company_id) {
    assertCompanyScope(actor, Number(company_id))
  }

  // ── 3. CHECK COMPANY EXISTS
  const company = await prisma.company.findUnique({
    where: { id: scopedCompanyId }
  })
  if (!company) {
    throw new NotFoundError("Company")
  }

  // ── 4. FETCH ALL BRANCHES
  const where = { companyId: scopedCompanyId }

  // If the actor is not a system or company administrator, lock views to their own branch
  if (actor.primaryRole !== "SUPER_ADMIN" && actor.primaryRole !== "COMPANY_ADMIN") {
    where.id = actor.branchId
  }

  const branches = await findBranches({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      company: { select: { id: true, name: true } },
      _count: { select: { users: true } }
    }
  })

  return {
    branches,
    total: branches.length
  }
}

/**
 * Lists branches with pagination, search, and sorting.
 */
export const getBranchesPaginatedService = async (query, actor) => {
  const {
    company_id,
    status,
    search,
    page = 1,
    limit = 10,
  } = query

  // Determine company scope
  const scopedCompanyId = actor.primaryRole === "SUPER_ADMIN"
    ? Number(company_id)
    : actor.companyId

  if (!scopedCompanyId) {
    throw new ValidationError("Validation failed", [
      { field: "company_id", message: "company_id is required" }
    ])
  }

  // Non super admin scope check
  if (actor.primaryRole !== "SUPER_ADMIN" && company_id) {
    if (Number(company_id) !== actor.companyId) {
      throw new ForbiddenError("Access denied")
    }
  }

  // Company exists check
  const company = await prisma.company.findUnique({
    where: { id: scopedCompanyId }
  })
  if (!company) throw new NotFoundError("Company")

  // Build filters
  const where = { companyId: scopedCompanyId }
  if (status) where.status = status

  if (search?.trim()) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
      { address: { contains: search, mode: "insensitive" } },
      { location: { contains: search, mode: "insensitive" } },
    ]
  }

  // If the actor is not a system or company administrator, lock views to their own branch
  if (actor.primaryRole !== "SUPER_ADMIN" && actor.primaryRole !== "COMPANY_ADMIN") {
    where.id = actor.branchId
  }

  // Pagination parameters
  const parsedPage = Math.max(1, Number(page))
  const parsedLimit = Math.max(1, Number(limit))
  const skip = (parsedPage - 1) * parsedLimit

  // Fetch from Repository
  const [branches, total] = await Promise.all([
    findBranches({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { id: true, name: true } },
        _count: { select: { users: true } }
      },
      skip,
      take: parsedLimit,
    }),
    countBranches(where),
  ])

  return {
    branches,
    total,
    page: parsedPage,
    limit: parsedLimit,
    totalPages: Math.ceil(total / parsedLimit),
    hasNext: parsedPage < Math.ceil(total / parsedLimit),
    hasPrev: parsedPage > 1,
  }
}

/**
 * Fetches a single branch details by ID.
 */
export const getBranchByIdService = async (id, actor) => {
  const branch = await findBranchById(Number(id))
  if (!branch) throw new NotFoundError("Branch")

  // Scope check
  assertCompanyScope(actor, branch.companyId)

  // Branch level scope check
  if (actor.primaryRole !== "SUPER_ADMIN" && actor.primaryRole !== "COMPANY_ADMIN") {
    if (branch.id !== actor.branchId) {
      throw new ForbiddenError("You do not have access to view this branch")
    }
  }

  return branch
}

/**
 * Updates branch operational details.
 */
export const updateBranchService = async (id, data, actor) => {
  const { name, address, location, status } = data

  const branch = await findBranchById(Number(id))
  if (!branch) throw new NotFoundError("Branch")

  // Scope check
  assertCompanyScope(actor, branch.companyId)

  // Branch level scope check
  if (actor.primaryRole !== "SUPER_ADMIN" && actor.primaryRole !== "COMPANY_ADMIN") {
    if (branch.id !== actor.branchId) {
      throw new ForbiddenError("You do not have permission to modify this branch")
    }
  }

  return updateBranch(Number(id), {
    ...(name && { name: name.trim() }),
    ...(address !== undefined && { address: address?.trim() || null }),
    ...(location !== undefined && { location: location?.trim() || null }),
    ...(status && { status })
  })
}

/**
 * Registers a new user and assigns them to a branch.
 */
export const assignUserToBranchService = async (branchId, data, actor) => {
  const { name, email, password, roleName } = data
  const formattedEmail = email.toLowerCase().trim()

  // ── CHECK BRANCH EXISTS
  const branch = await findBranchById(Number(branchId))
  if (!branch) throw new NotFoundError("Branch")

  // ── SCOPE GUARD
  assertCompanyScope(actor, branch.companyId)

  // Branch level scope check
  if (actor.primaryRole !== "SUPER_ADMIN" && actor.primaryRole !== "COMPANY_ADMIN") {
    if (branch.id !== actor.branchId) {
      throw new ForbiddenError("You can only onboard users within your assigned branch")
    }
  }

  // ── ROLE CREATION GUARD
  const allowedToCreate = ROLE_CREATION_RULES[actor.primaryRole] ?? []
  if (!allowedToCreate.includes(roleName)) {
    throw new ForbiddenError(
      `${actor.primaryRole} cannot create user with role ${roleName}`
    )
  }

  // ── ROLE NEEDS BRANCH CHECK
  if (!ROLES_NEED_BRANCH.includes(roleName)) {
    throw new ValidationError(
      `Role ${roleName} cannot be assigned to a branch directly`,
      [{ field: "roleName", message: "Use BRANCH_MANAGER, BDE, or ISE" }]
    )
  }

  // ── CHECK ROLE EXISTS
  const role = await prisma.role.findFirst({
    where: {
      name: roleName,
      companyId: { in: [null, branch.companyId] }
    }
  })
  if (!role) throw new NotFoundError("Role")

  // ── CHECK EMAIL UNIQUE
  const existingUser = await prisma.user.findUnique({
    where: { email: formattedEmail }
  })
  if (existingUser) throw new ConflictError("Email already registered", "email")

  // ── HASH PASSWORD
  const hashedPassword = await hashPassword(password)

  // ── CREATE USER + ASSIGN ROLE IN TRANSACTION
  const result = await prisma.$transaction(async (tx) => {
    // Create user scoped to company and branch
    const user = await tx.user.create({
      data: {
        name: name.trim(),
        email: formattedEmail,
        passwordHash: hashedPassword,
        companyId: branch.companyId,
        branchId: Number(branchId),
        status: "ACTIVE"
      }
    })

    // Create user-role mapping
    await tx.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
        companyId: branch.companyId,
        branchId: Number(branchId),
        isPrimary: true,
        assignedBy: actor.id
      }
    })

    return user
  }, {
    timeout: 30000
  })

  // ── RETURN SAFE USER
  return prisma.user.findUnique({
    where: { id: result.id },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      createdAt: true,
      company: { select: { id: true, name: true } },
      branch: { select: { id: true, name: true } },
      userRoles: {
        select: {
          isPrimary: true,
          role: { select: { id: true, name: true } }
        }
      }
    }
  })
}
