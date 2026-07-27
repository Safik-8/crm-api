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
      _count: {
        select: {
          users: true,
          teams: { where: { isDeleted: false } }
        }
      }
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
        _count: {
          select: {
            users: true,
            teams: { where: { isDeleted: false } }
          }
        }
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
  const allowedRoles = ["SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER"]
  if (!allowedRoles.includes(actor.primaryRole)) {
    throw new ForbiddenError("You do not have permission to configure branch settings")
  }

  const {
    name,
    address,
    location,
    status,
    maxDailyLeadsPerUser,
    autoAssignmentEnabled,
    assignmentAlgorithm,
    assignmentResolutionLevel
  } = data

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
    ...(status && { status }),
    ...(maxDailyLeadsPerUser !== undefined && { maxDailyLeadsPerUser }),
    ...(autoAssignmentEnabled !== undefined && { autoAssignmentEnabled }),
    ...(assignmentAlgorithm !== undefined && { assignmentAlgorithm }),
    ...(assignmentResolutionLevel !== undefined && { assignmentResolutionLevel })
  })
}

/**
 * Registers a new user and assigns them to a branch.
 */
export const assignUserToBranchService = async (branchId, data, actor) => {
  const { name, email, password, primaryRole, secondaryRoles = [] } = data
  const formattedEmail = email.toLowerCase().trim()

  // ── 1. VERIFY TARGET BRANCH EXISTS
  const branch = await findBranchById(Number(branchId))
  if (!branch) throw new NotFoundError("Branch")

  // ── 2. ENFORCE MULTI-TENANCY SCOPING
  assertCompanyScope(actor, branch.companyId)

  // Non-administrators (like Branch Managers) can only onboard users within their own branch
  if (actor.primaryRole !== "SUPER_ADMIN" && actor.primaryRole !== "COMPANY_ADMIN") {
    if (branch.id !== actor.branchId) {
      throw new ForbiddenError("You can only onboard users within your assigned branch")
    }
  }

  // ── 3. DEDUPLICATE AND RESOLVE REQUESTED ROLES
  // Combine primary and secondary role selections to load them in one DB query
  const uniqueRoleNames = Array.from(new Set([primaryRole, ...secondaryRoles]))

  const rolesFromDb = await prisma.role.findMany({
    where: {
      name: { in: uniqueRoleNames },
      OR: [
        { companyId: null }, // Global/System roles
        { companyId: branch.companyId } // Tenant-scoped custom roles
      ]
    }
  })

  // Ensure all requested roles were found in the database
  if (rolesFromDb.length !== uniqueRoleNames.length) {
    const foundNames = rolesFromDb.map(r => r.name)
    const missing = uniqueRoleNames.filter(name => !foundNames.includes(name))
    throw new NotFoundError(`Roles not found: ${missing.join(", ")}`)
  }

  // Find the database record corresponding to the primary role
  const primaryRoleDb = rolesFromDb.find(r => r.name === primaryRole)

  // ── 4. RUN SECURITY & HIERARCHY GUARDS (RANK CHECK)
  // The creator cannot assign any role (primary or secondary) that has an equal or higher rank than their own
  for (const role of rolesFromDb) {
    if (role.rank >= actor.primaryRoleRank) {
      throw new ForbiddenError(
        `Cannot assign role "${role.name}" (rank ${role.rank}) with equal or higher rank than your own (${actor.primaryRoleRank})`
      )
    }
  }

  // ── 5. ENFORCE PRIMARY ROLE IS HIGHEST OR EQUAL RANK
  // The rank of the primary role must be greater than or equal to the rank of all secondary roles
  for (const role of rolesFromDb) {
    if (role.name !== primaryRole && role.rank > primaryRoleDb.rank) {
      throw new ValidationError(
        "Invalid secondary roles selection",
        [{ field: "secondaryRoles", message: `Secondary role "${role.name}" (rank ${role.rank}) cannot have a higher rank than the primary role "${primaryRole}" (rank ${primaryRoleDb.rank})` }]
      )
    }
  }

  // ── 6. ENFORCE BRANCH ELIGIBILITY
  // Roles with rank >= 80 (except COMPANY_ADMIN) cannot be assigned directly to a branch, as they are higher-level scopes
  for (const role of rolesFromDb) {
    if (role.rank >= 80 && role.name !== "COMPANY_ADMIN") {
      throw new ValidationError(
        `Role "${role.name}" cannot be assigned to a branch directly`,
        [{ field: "primaryRole", message: "Only roles with rank lower than Company Admin (rank 80) can be assigned to a branch" }]
      )
    }
  }

  // ── 6. VERIFY EMAIL UNIQUENESS
  const existingUser = await prisma.user.findUnique({
    where: { email: formattedEmail }
  })
  if (existingUser) throw new ConflictError("Email already registered", "email")

  // ── 7. ENCRYPT CREDENTIALS
  const hashedPassword = await hashPassword(password)

  // ── 8. EXECUTE ATOMIC TRANSACTION (ALL-OR-NOTHING WRITE)
  const result = await prisma.$transaction(async (tx) => {
    // A. Create the User profile
    // Scoped to the branch unless their primary role is Company Admin (which has company-wide scope)
    const user = await tx.user.create({
      data: {
        name: name.trim(),
        email: formattedEmail,
        passwordHash: hashedPassword,
        companyId: branch.companyId,
        branchId: primaryRole === "COMPANY_ADMIN" ? null : Number(branchId),
        status: "ACTIVE"
      }
    })

    // B. Build UserRole mapping entries for both primary and secondary roles
    const userRoleMappings = rolesFromDb.map(role => {
      const isPrimary = role.name === primaryRole
      // Scope role to branch if it is not a company-wide admin role
      const roleBranchId = role.name === "COMPANY_ADMIN" ? null : Number(branchId)
      
      return {
        userId: user.id,
        roleId: role.id,
        companyId: branch.companyId,
        branchId: roleBranchId,
        isPrimary,
        assignedBy: actor.id
      }
    })

    // C. Bulk write role associations
    await tx.userRole.createMany({
      data: userRoleMappings
    })

    return user
  }, {
    timeout: 30000 // 30s connection window limit
  })

  // ── 9. RETURN SANITIZED RESPONSE PAYLOAD
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
