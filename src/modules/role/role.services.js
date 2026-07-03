// src/modules/role/role.services.js

import {
  findRoleByNameAndCompany,
  findRoleById,
  findRoles,
  countRoles,
  createRole,
  updateRole,
  deleteRole,
  upsertRolePermission,
  deleteRolePermissions,
} from "./role.repository.js"
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
  ValidationError,
} from "../../utils/AppError.js"
import prisma from "../../config/db.js"
import { MODULES } from "../../config/roleConstants.js"

/**
 * Asserts that the actor is authorized to create/edit custom roles
 */
const assertRoleManagementAuthority = (actor) => {
  if (actor.primaryRole !== "SUPER_ADMIN" && actor.primaryRole !== "COMPANY_ADMIN") {
    throw new ForbiddenError("Access denied: Only Super Admins and Company Admins can manage roles")
  }
}

/**
 * Lists roles with filtering, pagination, and company scoping.
 */
export const getRolesService = async (query, actor) => {
  const { page = 1, limit = 10, search = "", status } = query
  const skip = (page - 1) * limit
  const take = parseInt(limit, 10)

  // Scope filtering: COMPANY_ADMIN can only see their own company's roles and global system roles.
  // SUPER_ADMIN can optionally filter by query.companyId.
  let where = {}
  if (actor.primaryRole !== "SUPER_ADMIN") {
    where = {
      OR: [
        { companyId: actor.companyId },
        { companyId: null } // Include global system roles
      ],
      rank: { lte: actor.primaryRoleRank } // Hide roles above their rank (like SUPER_ADMIN)
    }
  } else if (query.companyId) {
    const targetCompanyId = parseInt(query.companyId, 10)
    where = {
      OR: [
        { companyId: targetCompanyId },
        { companyId: null } // Include global system roles
      ]
    }
  }

  if (status) {
    where.status = status
  }

  if (search) {
    where.name = {
      contains: search,
      mode: "insensitive"
    }
  }

  const [roles, total] = await Promise.all([
    findRoles({
      where,
      orderBy: { rank: "desc" },
      skip,
      take
    }),
    countRoles(where)
  ])

  return {
    roles,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: take,
      totalPages: Math.ceil(total / take)
    }
  }
}

/**
 * Gets details of a single role
 */
export const getRoleByIdService = async (id, actor) => {
  const role = await findRoleById(id)
  if (!role) {
    throw new NotFoundError("Role not found")
  }

  // Scope check
  if (actor.primaryRole !== "SUPER_ADMIN" && role.companyId !== actor.companyId && role.companyId !== null) {
    throw new ForbiddenError("You do not have permission to view this role")
  }

  return role
}

/**
 * Creates a new custom role with its associated permissions.
 */
export const createRoleService = async (data, actor) => {
  assertRoleManagementAuthority(actor)

  const { name, description, permissions = [] } = data

  // 1. Company scope: Custom roles are scoped to the actor's company
  // If SUPER_ADMIN creates it, we read companyId from input payload (or default to null)
  const companyId = actor.primaryRole === "SUPER_ADMIN" ? (data.companyId !== undefined ? data.companyId : null) : actor.companyId

  // 2. Rank calculation: automatically calculate based on scope:
  // - If company-scoped: rank is 79 (below Company Admin rank of 80)
  // - If global system-scoped: rank is 99 (below Super Admin rank of 100)
  const rank = companyId !== null ? 79 : 99

  // 3. Name uniqueness in company scope
  const formattedName = name.trim()
  const existingRole = await findRoleByNameAndCompany(formattedName, companyId)
  if (existingRole) {
    throw new ConflictError("Role name already exists within this company", "name")
  }

  // 4. Create Role and associate permissions inside transaction
  return prisma.$transaction(async (tx) => {
    const role = await createRole({
      name: formattedName,
      description: description?.trim() || null,
      rank,
      companyId,
      isSystem: false,
      status: "ACTIVE",
      createdBy: actor.id
    }, tx)

    // Setup permission records for the new role
    // Default all MODULES to false, and override with requested permissions
    const permissionMap = new Map()
    MODULES.forEach(mod => {
      permissionMap.set(mod, {
        canView: false,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canArchive: false
      })
    })

    permissions.forEach(p => {
      if (MODULES.includes(p.module)) {
        permissionMap.set(p.module, {
          canView: p.canView ?? false,
          canCreate: p.canCreate ?? false,
          canEdit: p.canEdit ?? false,
          canDelete: p.canDelete ?? false,
          canArchive: p.canArchive ?? false
        })
      }
    })

    // Create permission entries
    for (const [moduleName, perm] of permissionMap.entries()) {
      await upsertRolePermission(role.id, moduleName, perm, tx)
    }

    return findRoleById(role.id, tx)
  })
}

/**
 * Updates a custom role and its permissions.
 */
export const updateRoleService = async (id, data, actor) => {
  assertRoleManagementAuthority(actor)

  const role = await findRoleById(id)
  if (!role) {
    throw new NotFoundError("Role not found")
  }

  // Scope check
  if (actor.primaryRole !== "SUPER_ADMIN" && role.companyId !== actor.companyId) {
    throw new ForbiddenError("You cannot modify roles belonging to another company")
  }

  // Rank guard: cannot modify a role with rank >= own rank
  if (role.rank >= actor.primaryRoleRank) {
    throw new ForbiddenError("Cannot modify a role with equal or higher rank than your own")
  }

  // System role locks
  if (role.isSystem) {
    // System role cannot change name, rank, isSystem, or companyId. Only description or permissions could be changed in some systems,
    // but the handoff guide specifies: "block changing name, rank, status"
    if (data.name && data.name !== role.name) {
      throw new ForbiddenError("Cannot change name of system roles")
    }
    if (data.rank !== undefined && data.rank !== role.rank) {
      throw new ForbiddenError("Cannot change rank of system roles")
    }
    if (data.status && data.status !== role.status) {
      throw new ForbiddenError("Cannot change status of system roles")
    }
  }

  // If rank is being updated, verify it doesn't exceed actor's rank
  if (data.rank !== undefined && data.rank >= actor.primaryRoleRank) {
    throw new ForbiddenError("Cannot assign a rank equal or higher than your own")
  }

  // Name uniqueness check if name is changing
  if (data.name && data.name.trim() !== role.name) {
    const formattedName = data.name.trim()
    const existingRole = await findRoleByNameAndCompany(formattedName, role.companyId)
    if (existingRole && existingRole.id !== role.id) {
      throw new ConflictError("Role name already exists within this company", "name")
    }
  }

  return prisma.$transaction(async (tx) => {
    // Update role parameters
    const updatedRoleData = {}
    if (data.name && !role.isSystem) updatedRoleData.name = data.name.trim()
    if (data.description !== undefined) updatedRoleData.description = data.description?.trim() || null
    if (data.rank !== undefined && !role.isSystem) updatedRoleData.rank = data.rank
    if (data.status && !role.isSystem) updatedRoleData.status = data.status

    let updatedRole = role
    if (Object.keys(updatedRoleData).length > 0) {
      updatedRole = await updateRole(id, updatedRoleData, tx)
    }

    // Update permissions if supplied
    if (data.permissions) {
      for (const p of data.permissions) {
        if (MODULES.includes(p.module)) {
          await upsertRolePermission(role.id, p.module, p, tx)
        }
      }
    }

    return findRoleById(role.id, tx)
  })
}

/**
 * Deletes a custom role
 */
export const deleteRoleService = async (id, actor, reassignRoleId) => {
  assertRoleManagementAuthority(actor)

  const role = await findRoleById(id)
  if (!role) {
    throw new NotFoundError("Role not found")
  }

  // Scope check
  if (actor.primaryRole !== "SUPER_ADMIN" && role.companyId !== actor.companyId) {
    throw new ForbiddenError("You cannot delete roles belonging to another company")
  }

  // System role protection
  if (role.isSystem) {
    throw new ForbiddenError("System roles cannot be deleted")
  }

  // Rank guard
  if (role.rank >= actor.primaryRoleRank) {
    throw new ForbiddenError("Cannot delete a role with equal or higher rank than your own")
  }

  // Query users with this role
  const usersWithRole = await prisma.userRole.findMany({
    where: { roleId: role.id },
    include: {
      user: {
        select: { id: true, name: true, email: true }
      }
    }
  })

  if (usersWithRole.length > 0) {
    if (reassignRoleId) {
      // Reassign users to a new role first
      const newRole = await findRoleById(reassignRoleId)
      if (!newRole) {
        throw new NotFoundError("Reassign role not found")
      }
      if (actor.primaryRole !== "SUPER_ADMIN" && newRole.companyId !== actor.companyId && newRole.companyId !== null) {
        throw new ForbiddenError("You cannot assign roles belonging to another company")
      }
      if (newRole.rank >= actor.primaryRoleRank) {
        throw new ForbiddenError(`Cannot assign users to role "${newRole.name}" with equal or higher rank than your own`)
      }

      return prisma.$transaction(async (tx) => {
        // 1. Update all userRole mappings
        await tx.userRole.updateMany({
          where: { roleId: role.id },
          data: { roleId: reassignRoleId }
        })
        // 2. Delete permissions
        await deleteRolePermissions(role.id, tx)
        // 3. Delete the role
        await deleteRole(role.id, tx)
        return { success: true, message: "Users reassigned and role successfully deleted" }
      })
    } else {
      // Return list of users having this role
      const formattedUsers = usersWithRole.map(ur => ur.user)
      return {
        success: false,
        code: "ROLE_HAS_USERS",
        message: "This role is currently assigned to users",
        users: formattedUsers
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    // 1. Delete associated permissions first
    await deleteRolePermissions(role.id, tx)
    // 2. Delete the role
    await deleteRole(role.id, tx)
    return { success: true, message: "Role successfully deleted" }
  })
}

/**
 * Toggles a custom role's status
 */
export const toggleRoleStatusService = async (id, actor) => {
  assertRoleManagementAuthority(actor)

  const role = await findRoleById(id)
  if (!role) {
    throw new NotFoundError("Role not found")
  }

  // Scope check
  if (actor.primaryRole !== "SUPER_ADMIN" && role.companyId !== actor.companyId) {
    throw new ForbiddenError("You cannot modify roles belonging to another company")
  }

  // System role protection
  if (role.isSystem) {
    throw new ForbiddenError("System role status cannot be modified")
  }

  // Rank guard
  if (role.rank >= actor.primaryRoleRank) {
    throw new ForbiddenError("Cannot modify a role with equal or higher rank than your own")
  }

  const nextStatus = role.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
  const updated = await updateRole(role.id, { status: nextStatus })
  return updated
}

/**
 * Fetches users assigned to a specific role
 */
export const getRoleUsersService = async (id, actor) => {
  assertRoleManagementAuthority(actor)

  const role = await findRoleById(id)
  if (!role) {
    throw new NotFoundError("Role not found")
  }

  // Scope check
  if (actor.primaryRole !== "SUPER_ADMIN" && role.companyId !== actor.companyId) {
    throw new ForbiddenError("You cannot query roles belonging to another company")
  }

  const usersWithRole = await prisma.userRole.findMany({
    where: { roleId: role.id },
    include: {
      user: {
        select: { id: true, name: true, email: true }
      }
    }
  })

  return {
    users: usersWithRole.map(ur => ur.user)
  }
}
