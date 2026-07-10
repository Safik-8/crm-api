// src/modules/user/user.services.js

import {
  checkUserDuplicates,
  createUserTransaction,
  updateUserTransaction,
  findUserById,
  findUsers,
  countUsers,
  updateUserPassword,
  createAuditLog,
  findAssignableRoles
} from "./user.repository.js"
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError
} from "../../utils/AppError.js"
import { hashPassword } from "../../utils/passwordUtils.js"
import prisma from "../../config/db.js"
import crypto from "crypto"

// Helper to assert company-level multitenancy
const assertCompanyScope = (actor, targetCompanyId) => {
  if (actor.primaryRole === "SUPER_ADMIN") return
  if (actor.companyId !== targetCompanyId) {
    throw new ForbiddenError("You cannot access data from another company")
  }
}

// Recursive helper to check if selecting a manager would create a circular loop
const checkCircularReporting = async (userId, managerId) => {
  if (userId === managerId) {
    throw new ValidationError("Circular hierarchy", [
      { field: "reportingManagerId", message: "A user cannot be their own manager" }
    ])
  }

  let currentId = managerId
  let depth = 0
  const maxDepth = 15 // prevent infinite loops

  while (currentId && depth < maxDepth) {
    const parent = await prisma.user.findUnique({
      where: { id: currentId },
      select: { reportingManagerId: true }
    })

    if (!parent) break

    if (parent.reportingManagerId === userId) {
      throw new ValidationError("Circular hierarchy", [
        { field: "reportingManagerId", message: "Circular reporting loop detected: Selected manager reports back to this user" }
      ])
    }

    currentId = parent.reportingManagerId
    depth++
  }
}

// Helper to extract the rank of a user from their userRoles array
const getUserRank = (user) => {
  const primaryRole = user.userRoles?.find(ur => ur.isPrimary) || user.userRoles?.[0]
  return primaryRole?.role?.rank ?? 0
}

// Service to onboard a new user
export const createUserService = async (data, actor) => {
  const { companyId, branchId, roleId, reportingManagerId, email, mobileNumber, employeeId } = data

  // 1. Multitenancy guard: Company Admins and Branch Managers can only onboard in their own company
  assertCompanyScope(actor, Number(companyId))

  // 2. Branch manager scope guard: Branch Managers can only onboard users within their own branch
  if (actor.primaryRole === "BRANCH_MANAGER" && Number(branchId) !== actor.branchId) {
    throw new ForbiddenError("You can only onboard users within your assigned branch")
  }

  // 3. Resolve and validate target role and rank
  const role = await prisma.role.findUnique({
    where: { id: Number(roleId) }
  })
  if (!role) throw new NotFoundError("Role")
  if (role.status !== "ACTIVE") throw new ValidationError("Role is inactive")

  // Target role must belong to same company (or be global role)
  if (role.companyId !== null && role.companyId !== Number(companyId)) {
    throw new ValidationError("Role assignment mismatch", [
      { field: "roleId", message: "Selected role does not belong to this company" }
    ])
  }

  // Creator cannot assign roles equal or higher rank than their own
  if (actor.primaryRole !== "SUPER_ADMIN") {
    const actorRank = actor.primaryRoleRank ?? 0
    if (role.rank >= actorRank) {
      throw new ForbiddenError(`Cannot onboard a user with equal or higher authority rank (${role.rank}) than your own (${actorRank})`)
    }
  }

  // 4. Validate branch requirements
  const branch = await prisma.branch.findUnique({
    where: { id: Number(branchId) }
  })
  if (!branch) throw new NotFoundError("Branch")
  if (branch.companyId !== Number(companyId)) {
    throw new ValidationError("Branch mismatch", [
      { field: "branchId", message: "Selected branch does not belong to the selected company" }
    ])
  }
  if (branch.status !== "ACTIVE") throw new ValidationError("Selected branch is inactive")

  // 5. Verify reporting manager hierarchy
  if (reportingManagerId) {
    const manager = await findUserById(Number(reportingManagerId))
    if (!manager) throw new NotFoundError("Reporting Manager")
    if (manager.companyId !== Number(companyId)) {
      throw new ValidationError("Reporting manager mismatch", [
        { field: "reportingManagerId", message: "Reporting manager must belong to the same company" }
      ])
    }

    // Check manager status
    if (manager.status !== "ACTIVE") {
      throw new ValidationError("Inactive reporting manager", [
        { field: "reportingManagerId", message: "Reporting manager must be an active user" }
      ])
    }

    // Manager role rank must be strictly higher than subordinate role rank
    const managerRank = getUserRank(manager)
    if (managerRank <= role.rank) {
      throw new ValidationError("Invalid reporting structure", [
        { field: "reportingManagerId", message: `Manager role rank (${managerRank}) must be higher than employee role rank (${role.rank})` }
      ])
    }
  }

  // 6. Check unique constraints (email, mobile, employee ID)
  let finalEmployeeId = employeeId?.trim() || null
  if (!finalEmployeeId) {
    let isUnique = false
    let suffix = (await prisma.user.count()) + 1
    while (!isUnique) {
      finalEmployeeId = `EMP-${String(suffix).padStart(5, '0')}`
      const existing = await prisma.user.findUnique({
        where: { employeeId: finalEmployeeId }
      })
      if (!existing) {
        isUnique = true
      } else {
        suffix++
      }
    }
  }

  const duplicate = await checkUserDuplicates(email, mobileNumber, finalEmployeeId)
  if (duplicate) {
    throw new ConflictError(duplicate.message, duplicate.field)
  }

  // 7. Generate temporary password
  const tempPassword = crypto.randomBytes(6).toString("hex") // simple 12 character hex string
  const hashedPassword = await hashPassword(tempPassword)

  // 8. Create user in database transaction
  const user = await createUserTransaction({
    ...data,
    companyId: Number(companyId),
    branchId: Number(branchId),
    roleId: Number(roleId),
    employeeId: finalEmployeeId,
    reportingManagerId: reportingManagerId ? Number(reportingManagerId) : null,
    passwordHash: hashedPassword
  }, actor.id)

  // 9. Write audit log
  await createAuditLog({
    companyId: Number(companyId),
    entityType: "USER",
    entityId: user.id,
    action: "CREATE",
    newValue: {
      email: user.email,
      name: user.name,
      role: role.name,
      branchId: user.branchId,
      reportingManagerId: user.reportingManagerId
    },
    performedById: actor.id
  })

  // Return the created user along with the temporary password so the admin can copy it
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      employeeId: user.employeeId,
      mobileNumber: user.mobileNumber,
      status: user.status
    },
    tempPassword
  }
}

// Service to update an existing user
export const updateUserService = async (id, data, actor) => {
  const targetId = Number(id)
  const user = await findUserById(targetId)
  if (!user) throw new NotFoundError("User")

  // Multitenancy Scope Checks
  assertCompanyScope(actor, user.companyId)

  // Branch Manager Scope check
  if (actor.primaryRole === "BRANCH_MANAGER") {
    if (user.branchId !== actor.branchId) {
      throw new ForbiddenError("You can only edit users within your assigned branch")
    }
    // Cannot change the employee's branch to a different one
    if (branchId && Number(branchId) !== actor.branchId) {
      throw new ForbiddenError("You cannot change an employee's branch assignment")
    }
  }

  const { firstName, lastName, mobileNumber, branchId, roleId, reportingManagerId, status } = data

  // Rank Guard: Actor cannot update a user who has equal or higher rank than the actor
  const currentRank = getUserRank(user)

  if (actor.primaryRole !== "SUPER_ADMIN") {
    const actorRank = actor.primaryRoleRank ?? 0

    if (currentRank >= actorRank) {
      throw new ForbiddenError(`You do not have permission to edit users with equal or higher rank than yourself`)
    }

    // If changing role, check the new role's rank as well
    if (roleId) {
      const targetRole = await prisma.role.findUnique({ where: { id: Number(roleId) } })
      if (!targetRole) throw new NotFoundError("Role")
      if (targetRole.rank >= actorRank) {
        throw new ForbiddenError(`Cannot assign a role with equal or higher authority rank (${targetRole.rank}) than your own (${actorRank})`)
      }
    }
  }

  // Verify unique mobile number if changed
  if (mobileNumber && mobileNumber.trim() !== user.mobileNumber) {
    const duplicate = await checkUserDuplicates(user.email, mobileNumber, user.employeeId, targetId)
    if (duplicate) {
      throw new ConflictError(duplicate.message, duplicate.field)
    }
  }

  // Validate branch mapping
  if (branchId && Number(branchId) !== user.branchId) {
    const branch = await prisma.branch.findUnique({ where: { id: Number(branchId) } })
    if (!branch) throw new NotFoundError("Branch")
    if (branch.companyId !== user.companyId) {
      throw new ValidationError("Branch mismatch", [{ field: "branchId", message: "Branch does not belong to user's company" }])
    }
    if (branch.status !== "ACTIVE") throw new ValidationError("Branch is inactive")
  }

  // Verify reporting structures
  const finalRoleId = roleId ? Number(roleId) : (currentRole?.id || null)
  const finalRole = roleId
    ? await prisma.role.findUnique({ where: { id: finalRoleId } })
    : currentRole

  if (reportingManagerId) {
    await checkCircularReporting(targetId, Number(reportingManagerId))

    const manager = await findUserById(Number(reportingManagerId))
    if (!manager) throw new NotFoundError("Reporting Manager")
    if (manager.companyId !== user.companyId) {
      throw new ValidationError("Reporting manager mismatch", [{ field: "reportingManagerId", message: "Manager must belong to same company" }])
    }

    const managerRank = getUserRank(manager)
    if (finalRole && managerRank <= finalRole.rank) {
      throw new ValidationError("Invalid reporting structure", [
        { field: "reportingManagerId", message: `Manager role rank (${managerRank}) must be higher than employee role rank (${finalRole.rank})` }
      ])
    }
  }

  // Update in transaction
  const updatedUser = await updateUserTransaction(targetId, {
    ...data,
    branchId: branchId ? Number(branchId) : undefined,
    reportingManagerId: reportingManagerId ? Number(reportingManagerId) : undefined
  })

  // Write Audit Logs
  await createAuditLog({
    companyId: user.companyId,
    entityType: "USER",
    entityId: targetId,
    action: "UPDATE",
    oldValue: {
      name: user.name,
      mobileNumber: user.mobileNumber,
      branchId: user.branchId,
      reportingManagerId: user.reportingManagerId,
      status: user.status
    },
    newValue: {
      name: updatedUser.name,
      mobileNumber: updatedUser.mobileNumber,
      branchId: updatedUser.branchId,
      reportingManagerId: updatedUser.reportingManagerId,
      status: updatedUser.status
    },
    performedById: actor.id
  })

  return findUserById(targetId)
}

// Service to query paginated users with filters
export const getUsersService = async (query, actor) => {
  const {
    companyId,
    branchId,
    roleId,
    status,
    search,
    page = 1,
    limit = 10
  } = query

  // Scopes resolving
  const scopedCompanyId = actor.primaryRole === "SUPER_ADMIN"
    ? (companyId ? Number(companyId) : null)
    : actor.companyId

  const where = {}

  if (scopedCompanyId) {
    where.companyId = scopedCompanyId
  }

  // Branch Manager & BDE visibility lockdown: Lock views to their own branch
  if (actor.primaryRole !== "SUPER_ADMIN" && actor.primaryRole !== "COMPANY_ADMIN") {
    where.branchId = actor.branchId
  } else if (branchId) {
    where.branchId = Number(branchId)
  }

  // Status and Role filter mapping
  if (status) where.status = status
  if (roleId) {
    where.userRoles = {
      some: { roleId: Number(roleId) }
    }
  }

  // Search keyword parsing
  if (search?.trim()) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { employeeId: { contains: search, mode: "insensitive" } },
      { mobileNumber: { contains: search, mode: "insensitive" } }
    ]
  }

  // Pagination parameters
  const parsedPage = Math.max(1, Number(page))
  const parsedLimit = Math.max(1, Number(limit))
  const skip = (parsedPage - 1) * parsedLimit

  const [users, total] = await Promise.all([
    findUsers({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
        reportingManager: { select: { id: true, name: true } },
        profile: true,
        userRoles: {
          where: { isPrimary: true },
          include: {
            role: { select: { id: true, name: true, rank: true } }
          }
        }
      },
      skip,
      take: parsedLimit
    }),
    countUsers(where)
  ])

  return {
    users,
    total,
    page: parsedPage,
    limit: parsedLimit,
    totalPages: Math.ceil(total / parsedLimit),
    hasNext: parsedPage < Math.ceil(total / parsedLimit),
    hasPrev: parsedPage > 1
  }
}

// Service to reset user password
export const resetUserPasswordService = async (id, actor) => {
  const targetId = Number(id)
  const user = await findUserById(targetId)
  if (!user) throw new NotFoundError("User")

  // Scope and Rank Guards
  assertCompanyScope(actor, user.companyId)

  if (actor.primaryRole === "BRANCH_MANAGER" && user.branchId !== actor.branchId) {
    throw new ForbiddenError("You do not have permission to reset passwords in other branches")
  }

  const currentRank = getUserRank(user)

  if (actor.primaryRole !== "SUPER_ADMIN") {
    const actorRank = actor.primaryRoleRank ?? 0
    if (currentRank >= actorRank) {
      throw new ForbiddenError("You cannot reset credentials for a user with equal or higher rank than yourself")
    }
  }

  // Generate new temp credentials
  const tempPassword = crypto.randomBytes(6).toString("hex")
  const hashedPassword = await hashPassword(tempPassword)

  await updateUserPassword(targetId, hashedPassword, true)

  // Write audit trail
  await createAuditLog({
    companyId: user.companyId,
    entityType: "USER",
    entityId: targetId,
    action: "PASSWORD_RESET",
    performedById: actor.id
  })

  return {
    email: user.email,
    tempPassword
  }
}

// Service to toggle status (ACTIVE/INACTIVE)
export const toggleUserStatusService = async (id, status, actor) => {
  const targetId = Number(id)
  const user = await findUserById(targetId)
  if (!user) throw new NotFoundError("User")

  // Scope and Rank Guards
  assertCompanyScope(actor, user.companyId)

  if (actor.primaryRole === "BRANCH_MANAGER" && user.branchId !== actor.branchId) {
    throw new ForbiddenError("You can only toggle status of users inside your assigned branch")
  }

  const currentRank = getUserRank(user)

  if (actor.primaryRole !== "SUPER_ADMIN") {
    const actorRank = actor.primaryRoleRank ?? 0
    if (currentRank >= actorRank) {
      throw new ForbiddenError("You cannot modify status for a user with equal or higher rank than yourself")
    }
  }

  // Prevent self-deactivation
  if (targetId === actor.id) {
    throw new ValidationError("Self modification denied", [{ field: "status", message: "You cannot deactivate your own user account" }])
  }

  // Update record in transaction
  const updatedUser = await updateUserTransaction(targetId, { status })

  // Write audit trail
  await createAuditLog({
    companyId: user.companyId,
    entityType: "USER",
    entityId: targetId,
    action: "STATUS_CHANGE",
    oldValue: { status: user.status },
    newValue: { status },
    performedById: actor.id
  })

  // If set to INACTIVE, revoke any active refresh tokens to force-log them out immediately
  if (status === "INACTIVE") {
    await prisma.refreshToken.deleteMany({
      where: { userId: targetId }
    })
  }

  return updatedUser
}

/**
 * Returns the list of roles the actor is permitted to assign when creating a new user.
 * Enforces rank hierarchy: the actor can only assign roles with a strictly lower rank.
 * Company-scoped: returns system-wide roles + roles specific to the actor's company.
 */
export const getAssignableRolesService = async (actor) => {
  return findAssignableRoles(actor.primaryRoleRank, actor.companyId)
}
