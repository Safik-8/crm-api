// src/modules/role/role.repository.js

import prisma from "../../config/db.js"

export const findRoleByNameAndCompany = async (name, companyId, tx = prisma) => {
  return tx.role.findFirst({
    where: {
      name,
      companyId: companyId || null,
    },
  })
}

export const findRoleById = async (id, tx = prisma) => {
  return tx.role.findUnique({
    where: { id },
    include: {
      rolePermissions: true,
    },
  })
}

export const findRoles = async ({ where, orderBy, skip, take }, tx = prisma) => {
  return tx.role.findMany({
    where,
    orderBy,
    skip,
    take,
    include: {
      rolePermissions: true,
      _count: {
        select: { userRoles: true },
      },
    },
  })
}

export const countRoles = async (where, tx = prisma) => {
  return tx.role.count({
    where,
  })
}

export const createRole = async (data, tx = prisma) => {
  return tx.role.create({
    data,
  })
}

export const updateRole = async (id, data, tx = prisma) => {
  return tx.role.update({
    where: { id },
    data,
  })
}

export const deleteRole = async (id, tx = prisma) => {
  return tx.role.delete({
    where: { id },
  })
}

export const upsertRolePermission = async (roleId, module, permissionData, tx = prisma) => {
  return tx.permission.upsert({
    where: {
      roleId_module: {
        roleId,
        module,
      },
    },
    update: {
      canView: permissionData.canView,
      canCreate: permissionData.canCreate,
      canEdit: permissionData.canEdit,
      canDelete: permissionData.canDelete,
      canArchive: permissionData.canArchive,
    },
    create: {
      roleId,
      module,
      canView: permissionData.canView ?? false,
      canCreate: permissionData.canCreate ?? false,
      canEdit: permissionData.canEdit ?? false,
      canDelete: permissionData.canDelete ?? false,
      canArchive: permissionData.canArchive ?? false,
    },
  })
}

export const deleteRolePermissions = async (roleId, tx = prisma) => {
  return tx.permission.deleteMany({
    where: { roleId },
  })
}
