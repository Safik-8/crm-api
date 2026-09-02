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
import { recordAuditLog } from "../auditLog/auditLog.service.js"

// Core system role names that cannot be renamed, re-ranked, or deleted
const SYSTEM_ROLE_NAMES = ["SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER", "BDE", "ISE"]

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
  let companyIdFilter = null

  if (actor.primaryRole !== "SUPER_ADMIN") {
    companyIdFilter = actor.companyId
    where = {
      OR: [
        { companyId: actor.companyId },
        { companyId: null } // Include global system roles
      ],
      rank: { lte: actor.primaryRoleRank } // Hide roles above their rank (show assignable/equal roles)
    }
  } else {
    if (query.companyId) {
      companyIdFilter = parseInt(query.companyId, 10)
      where = {
        OR: [
          { companyId: companyIdFilter },
          { companyId: null } // Include global system roles
        ]
      }
    }
  }

  if (status) {
    where.status = status
  }

  if (search) {
    const searchString = search.trim()
    where.AND = [
      {
        OR: [
          { name: { contains: searchString, mode: "insensitive" } },
          { description: { contains: searchString, mode: "insensitive" } }
        ]
      }
    ]
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

  // Filter out global template roles if a company-scoped role with the same name exists for the company
  let filteredRoles = roles
  if (companyIdFilter !== null) {
    const companyScopedNames = new Set(
      roles.filter(r => r.companyId === companyIdFilter).map(r => r.name)
    )
    filteredRoles = roles.filter(r => {
      if (r.companyId === companyIdFilter) return true
      return !companyScopedNames.has(r.name)
    })

    const counts = await prisma.userRole.groupBy({
      by: ["roleId"],
      where: {
        companyId: companyIdFilter
      },
      _count: {
        id: true
      }
    })

    const countMap = {}
    counts.forEach(c => {
      countMap[c.roleId] = c._count.id
    })

    filteredRoles.forEach(role => {
      role._count = {
        userRoles: countMap[role.id] || 0
      }
    })
  }

  return {
    roles: filteredRoles,
    pagination: {
      total: filteredRoles.length,
      page: parseInt(page, 10),
      limit: take,
      totalPages: Math.ceil(filteredRoles.length / take)
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
 * Helper to compute next available sequential rank in selected hierarchy bracket for a company.
 * Brackets:
 * - COMPANY_ADMIN_TO_BRANCH_MANAGER: max 79, min 61 (Between Company Admin [80] & Branch Manager [60])
 * - BRANCH_MANAGER_TO_BDE: max 59, min 41 (Between Branch Manager [60] & BDE [40])
 * - BDE_TO_ISE: max 39, min 21 (Between BDE [40] & ISE [20])
 * - BELOW_ISE: max 19, min 1 (Below ISE [20])
 */
export const calculateCustomRoleRank = async (companyId, hierarchyBracket = 'COMPANY_ADMIN_TO_BRANCH_MANAGER') => {
  let maxRank = 79
  let minRank = 61

  if (hierarchyBracket === 'BRANCH_MANAGER_TO_BDE') {
    maxRank = 59
    minRank = 41
  } else if (hierarchyBracket === 'BDE_TO_ISE') {
    maxRank = 39
    minRank = 21
  } else if (hierarchyBracket === 'BELOW_ISE') {
    maxRank = 19
    minRank = 1
  }

  const existingRoles = await prisma.role.findMany({
    where: {
      companyId: companyId,
      isSystem: false,
      rank: { gte: minRank, lte: maxRank }
    },
    select: { rank: true },
    orderBy: { rank: 'asc' }
  })

  if (existingRoles.length === 0) {
    return maxRank
  }

  const lowestRankInUse = existingRoles[0].rank
  if (lowestRankInUse > minRank) {
    return lowestRankInUse - 1
  }

  return minRank
}

/**
 * Creates a new custom role with its associated permissions.
 */
export const createRoleService = async (data, actor, req = null) => {
  assertRoleManagementAuthority(actor)

  const { name, description, hierarchyBracket = "COMPANY_ADMIN_TO_BRANCH_MANAGER", permissions = [] } = data

  // 1. Company scope: Custom roles are scoped to the actor's company
  const companyId = actor.primaryRole === "SUPER_ADMIN" ? (data.companyId !== undefined ? data.companyId : null) : actor.companyId

  // 2. Dynamic Rank Calculation
  const rank = data.rank !== undefined
    ? Number(data.rank)
    : await calculateCustomRoleRank(companyId, hierarchyBracket)

  // Rank Guardrail: Cannot create a role with rank >= actor rank
  if (actor.primaryRole !== "SUPER_ADMIN" && rank >= actor.primaryRoleRank) {
    throw new ForbiddenError(`Cannot create a role with authority rank (${rank}) equal to or higher than your own (${actor.primaryRoleRank})`)
  }

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
        const canCreate = Boolean(p.canCreate);
        const canEdit = Boolean(p.canEdit);
        const canDelete = Boolean(p.canDelete);
        const canArchive = Boolean(p.canArchive);
        // Automatic view dependency: any action enables view
        const canView = Boolean(p.canView) || canCreate || canEdit || canDelete || canArchive;

        permissionMap.set(p.module, {
          canView,
          canCreate: canView ? canCreate : false,
          canEdit: canView ? canEdit : false,
          canDelete: canView ? canDelete : false,
          canArchive: canView ? canArchive : false
        })
      }
    })

    // Create permission entries
    for (const [moduleName, perm] of permissionMap.entries()) {
      await upsertRolePermission(role.id, moduleName, perm, tx)
    }

    const createdRole = await findRoleById(role.id, tx)

    // Record audit log
    await recordAuditLog({
      req,
      moduleName: "ROLE_PERMISSION",
      action: "ROLE_CREATED",
      entityType: "ROLE",
      entityId: role.id,
      performedById: actor.id,
      companyId: role.companyId || actor.companyId,
      details: { roleName: role.name, rank: role.rank },
      tx
    })

    return createdRole
  }, {
    maxWait: 15000,
    timeout: 30000
  })
}

/**
 * Updates a role and its permissions.
 */
export const updateRoleService = async (id, data, actor, req = null) => {
  assertRoleManagementAuthority(actor)

  const role = await findRoleById(id)
  if (!role) {
    throw new NotFoundError("Role not found")
  }

  // Scope check: cannot modify roles belonging to another company
  if (actor.primaryRole !== "SUPER_ADMIN" && role.companyId !== actor.companyId) {
    throw new ForbiddenError("You cannot modify roles belonging to another company")
  }

  // Rank guard: cannot modify a role with rank > own rank
  if (role.rank > actor.primaryRoleRank) {
    throw new ForbiddenError("Cannot modify a role with higher rank than your own")
  }

  const isCoreSystemRole = role.isSystem || SYSTEM_ROLE_NAMES.includes(role.name)

  // Core system role locks: block name and rank changes for core roles
  if (isCoreSystemRole) {
    if (data.name && data.name.trim() !== role.name) {
      throw new ForbiddenError("Cannot change name of system roles")
    }
    if (data.rank !== undefined && Number(data.rank) !== role.rank) {
      throw new ForbiddenError("Cannot change rank of system roles")
    }
    if (data.status && data.status !== role.status && role.isSystem) {
      throw new ForbiddenError("Cannot change status of master system roles")
    }
  }

  // Name uniqueness check if name is changing
  if (data.name && data.name.trim() !== role.name && !isCoreSystemRole) {
    const formattedName = data.name.trim()
    const existingRole = await findRoleByNameAndCompany(formattedName, role.companyId)
    if (existingRole && existingRole.id !== role.id) {
      throw new ConflictError("Role name already exists within this company", "name")
    }
  }

  return prisma.$transaction(async (tx) => {
    // Update role parameters
    const updatedRoleData = {}
    if (data.name && !isCoreSystemRole) updatedRoleData.name = data.name.trim()
    if (data.description !== undefined) updatedRoleData.description = data.description?.trim() || null
    if (data.rank !== undefined && !isCoreSystemRole) updatedRoleData.rank = Number(data.rank)
    if (data.status && role.companyId !== null) updatedRoleData.status = data.status

    let updatedRole = role
    if (Object.keys(updatedRoleData).length > 0) {
      updatedRole = await updateRole(id, updatedRoleData, tx)
    }

    // Update permissions if supplied
    if (data.permissions) {
      for (const p of data.permissions) {
        if (MODULES.includes(p.module)) {
          const canCreate = Boolean(p.canCreate);
          const canEdit = Boolean(p.canEdit);
          const canDelete = Boolean(p.canDelete);
          const canArchive = Boolean(p.canArchive);
          const canView = Boolean(p.canView) || canCreate || canEdit || canDelete || canArchive;

          const permPayload = {
            canView,
            canCreate: canView ? canCreate : false,
            canEdit: canView ? canEdit : false,
            canDelete: canView ? canDelete : false,
            canArchive: canView ? canArchive : false
          };
          await upsertRolePermission(role.id, p.module, permPayload, tx)
        }
      }
    }

    const resultRole = await findRoleById(role.id, tx)

    // Record audit log
    await recordAuditLog({
      req,
      moduleName: "ROLE_PERMISSION",
      action: "ROLE_UPDATED",
      entityType: "ROLE",
      entityId: role.id,
      performedById: actor.id,
      companyId: role.companyId || actor.companyId,
      details: { roleName: role.name, rank: role.rank },
      tx
    })

    return resultRole
  }, {
    maxWait: 15000,
    timeout: 30000
  })
}

/**
 * Deletes a custom role
 */
export const deleteRoleService = async (id, actor, reassignRoleId, req = null) => {
  assertRoleManagementAuthority(actor)

  const role = await findRoleById(id)
  if (!role) {
    throw new NotFoundError("Role not found")
  }

  // Scope check
  if (actor.primaryRole !== "SUPER_ADMIN" && role.companyId !== actor.companyId) {
    throw new ForbiddenError("You cannot delete roles belonging to another company")
  }

  // Core system role protection
  if (role.isSystem || SYSTEM_ROLE_NAMES.includes(role.name)) {
    throw new ForbiddenError("Core system roles cannot be deleted")
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
      }, {
        maxWait: 15000,
        timeout: 30000
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
    // 3. Audit log
    await recordAuditLog({
      req,
      moduleName: "ROLE_PERMISSION",
      action: "ROLE_DELETED",
      entityType: "ROLE",
      entityId: role.id,
      performedById: actor.id,
      companyId: role.companyId || actor.companyId,
      details: { roleName: role.name },
      tx
    })
    return { success: true, message: "Role successfully deleted" }
  }, {
    maxWait: 15000,
    timeout: 30000
  })
}

/**
 * Toggles a custom role's status
 */
export const toggleRoleStatusService = async (id, actor, req = null) => {
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

  await recordAuditLog({
    req,
    moduleName: "ROLE_PERMISSION",
    action: "ROLE_STATUS_TOGGLED",
    entityType: "ROLE",
    entityId: role.id,
    performedById: actor.id,
    companyId: role.companyId || actor.companyId,
    details: { roleName: role.name, newStatus: nextStatus }
  })

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
