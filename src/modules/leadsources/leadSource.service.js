// src/modules/leadSource/leadSource.service.js

import prisma from "../../config/db.js"
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError
} from "../../utils/AppError.js"

// ══════════════════════════════════════════════════════════
// SCOPE GUARD
// Global lead sources (companyId = null) → only SUPER_ADMIN
// Company lead sources → scoped to actor's company
// ══════════════════════════════════════════════════════════

const assertLeadSourceScope = (actor, leadSource) => {
  // Global lead source — only super admin can modify
  if (!leadSource.companyId) {
    if (actor.companyId !== null && actor.companyId !== undefined) {
      throw new ForbiddenError("Only Super Admin can modify global lead sources")
    }
    return
  }

  // Company lead source — must match actor's company
  if (actor.companyId && actor.companyId !== leadSource.companyId) {
    throw new ForbiddenError("You cannot access lead sources from another company")
  }
}

// ══════════════════════════════════════════════════════════
// CREATE LEAD SOURCE
// Super Admin → global (companyId = null)
// Others      → company scoped (companyId = actor.companyId)
// ══════════════════════════════════════════════════════════

export const createLeadSourceService = async (data, actor) => {

  const { name, isGlobal = false } = data

  // Validate
  const errors = []
  if (!name || !name.trim()) {
    errors.push({ field: "name", message: "Lead source name is required" })
  }
  if (errors.length > 0) throw new ValidationError("Validation failed", errors)

  // Only Super Admin can create global lead sources
  const companyId = (!actor.companyId && isGlobal)
    ? null
    : actor.companyId

  if (isGlobal && actor.companyId) {
    throw new ForbiddenError("Only Super Admin can create global lead sources")
  }

  // Check duplicate name within same scope
  const existing = await prisma.leadSource.findFirst({
    where: {
      name     : { equals: name.trim(), mode: "insensitive" },
      companyId: companyId
    }
  })

  if (existing) {
    throw new ConflictError(
      `Lead source "${name}" already exists`,
      "name"
    )
  }

  const leadSource = await prisma.leadSource.create({
    data: {
      name     : name.trim(),
      companyId: companyId,
      isActive : true
    },
    include: {
      company: companyId
        ? { select: { id: true, name: true } }
        : false
    }
  })

  return leadSource
}

// ══════════════════════════════════════════════════════════
// GET ALL LEAD SOURCES
// Returns global + company specific lead sources
// ══════════════════════════════════════════════════════════

export const getLeadSourcesService = async (query, actor) => {

  const { search, isActive } = query

  // Build where:
  // Super Admin → all global + all company specific
  // Others → global + own company only
  let where = {}

  if (!actor.companyId) {
    // Super Admin → sees everything
    if (search) {
      where.name = { contains: search.trim(), mode: "insensitive" }
    }
    if (isActive !== undefined) {
      where.isActive = isActive === "true"
    }
  } else {
    // Others → global + own company
    where.OR = [
      { companyId: null },
      { companyId: actor.companyId }
    ]

    if (search) {
      where.AND = [{
        name: { contains: search.trim(), mode: "insensitive" }
      }]
    }

    if (isActive !== undefined) {
      where.isActive = isActive === "true"
    }
  }

  const leadSources = await prisma.leadSource.findMany({
    where,
    orderBy: [
      { companyId: "asc" },   // global first
      { name     : "asc" }
    ],
    select: {
      id: true,
      name: true
    }
  })

  // Label each as GLOBAL or COMPANY
  const formatted = leadSources.map(ls => ({
    id: ls.id,
    name: ls.name
  }))

  return formatted
}

// ══════════════════════════════════════════════════════════
// GET SINGLE LEAD SOURCE
// ══════════════════════════════════════════════════════════

export const getLeadSourceByIdService = async (id, actor) => {

  const leadSource = await prisma.leadSource.findUnique({
    where  : { id: Number(id) },
    select: {
      id: true,
      name: true
    }
  })

  if (!leadSource) throw new NotFoundError("Lead source")

  assertLeadSourceScope(actor, leadSource)

  return {
    ...leadSource,
    type: leadSource.companyId ? "COMPANY" : "GLOBAL"
  }
}

// ══════════════════════════════════════════════════════════
// UPDATE LEAD SOURCE
// ══════════════════════════════════════════════════════════

export const updateLeadSourceService = async (id, data, actor) => {

  const { name, isActive } = data

  const leadSource = await prisma.leadSource.findUnique({
    where: { id: Number(id) }
  })

  if (!leadSource) throw new NotFoundError("Lead source")

  // Scope check
  assertLeadSourceScope(actor, leadSource)

  // Check duplicate name if name is being changed
  if (name && name.trim() !== leadSource.name) {
    const existing = await prisma.leadSource.findFirst({
      where: {
        name     : { equals: name.trim(), mode: "insensitive" },
        companyId: leadSource.companyId,
        id       : { not: Number(id) }
      }
    })
    if (existing) {
      throw new ConflictError(`Lead source "${name}" already exists`, "name")
    }
  }

  const updated = await prisma.leadSource.update({
    where: { id: Number(id) },
    data : {
      ...(name     !== undefined && { name    : name.trim() }),
      ...(isActive !== undefined && { isActive: Boolean(isActive) })
    },
    include: {
      company: { select: { id: true, name: true } }
    }
  })

  return {
    ...updated,
    type: updated.companyId ? "COMPANY" : "GLOBAL"
  }
}
