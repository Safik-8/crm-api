// src/modules/leadsources/leadsources.repository.js
import prisma from "../../config/db.js"

export const findLeadSourceById = async (id, tx = prisma) => {
  return tx.leadSource.findUnique({
    where: { id: Number(id) }
  })
}

export const findDuplicateLeadSource = async (name, companyId, excludeId = null, tx = prisma) => {
  return tx.leadSource.findFirst({
    where: {
      name: { equals: name.trim(), mode: "insensitive" },
      ...(excludeId ? { id: { not: Number(excludeId) } } : {}),
      OR: [
        { companyId: companyId },
        { companyId: null }
      ]
    }
  })
}

export const createLeadSource = async (data, tx = prisma) => {
  return tx.leadSource.create({
    data: {
      name: data.name.trim(),
      description: data.description?.trim() || null,
      companyId: data.companyId,
      isActive: data.isActive ?? true
    },
    include: {
      company: data.companyId
        ? { select: { id: true, name: true } }
        : false
    }
  })
}

export const findLeadSources = async (where, tx = prisma) => {
  return tx.leadSource.findMany({
    where,
    orderBy: [
      { companyId: "asc" },
      { name: "asc" }
    ],
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      companyId: true
    }
  })
}

export const updateLeadSource = async (id, data, tx = prisma) => {
  return tx.leadSource.update({
    where: { id: Number(id) },
    data: {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.description !== undefined && { description: data.description?.trim() || null }),
      ...(data.isActive !== undefined && { isActive: Boolean(data.isActive) })
    },
    include: {
      company: { select: { id: true, name: true } }
    }
  })
}
