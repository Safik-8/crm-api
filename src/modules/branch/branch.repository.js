// src/modules/branch/branch.repository.js

import prisma from "../../config/db.js"

/**
 * Creates a new branch record.
 * Supports running within an active transaction boundary.
 */
export const createBranch = async (data, tx = prisma) => {
  return tx.branch.create({
    data: {
      companyId: data.companyId,
      name: data.name,
      code: data.code.toUpperCase(),
      status: data.status
    },
    include: {
      company: { select: { id: true, name: true } }
    }
  })
}

/**
 * Finds a branch by its unique code within a specific company.
 */
export const findBranchByCodeInCompany = async (companyId, code, tx = prisma) => {
  return tx.branch.findFirst({
    where: { companyId, code: code.toUpperCase() }
  })
}

/**
 * Finds a single branch by its primary key ID.
 */
export const findBranchById = async (id, tx = prisma) => {
  return tx.branch.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true } },
      _count: { select: { users: true } }
    }
  })
}

/**
 * Fetches branches matching dynamic query criteria.
 */
export const findBranches = async (params, tx = prisma) => {
  return tx.branch.findMany({
    where: params.where,
    orderBy: params.orderBy,
    include: params.include,
    skip: params.skip,
    take: params.take
  })
}

/**
 * Counts total branches matching dynamic search criteria.
 */
export const countBranches = async (where, tx = prisma) => {
  return tx.branch.count({ where })
}

/**
 * Updates an existing branch's fields.
 */
export const updateBranch = async (id, data, tx = prisma) => {
  return tx.branch.update({
    where: { id },
    data,
    include: {
      company: { select: { id: true, name: true } }
    }
  })
}
