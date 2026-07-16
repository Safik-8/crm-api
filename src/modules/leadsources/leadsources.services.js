// src/modules/leadsources/leadsources.services.js

import {
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError
} from "../../utils/AppError.js"
import {
  findLeadSourceById,
  findDuplicateLeadSource,
  createLeadSource,
  findLeadSources,
  updateLeadSource
} from "./leadsources.repository.js"

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
  const { name, isGlobal = false, description } = data

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

  // Check duplicate name within same company scope OR global scope
  const existing = await findDuplicateLeadSource(name, companyId)
  if (existing) {
    throw new ConflictError(
      `Lead source "${name}" already exists`,
      "name"
    )
  }

  return createLeadSource({
    name,
    description,
    companyId,
    isActive: true
  })
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

  const leadSources = await findLeadSources(where)

  // Label each as GLOBAL or COMPANY
  return leadSources.map(ls => ({
    id: ls.id,
    name: ls.name,
    description: ls.description,
    isActive: ls.isActive,
    companyId: ls.companyId,
    type: ls.companyId ? "COMPANY" : "GLOBAL"
  }))
}

// ══════════════════════════════════════════════════════════
// UPDATE LEAD SOURCE
// ══════════════════════════════════════════════════════════

export const updateLeadSourceService = async (id, data, actor) => {
  const { name, isActive, description } = data

  const leadSource = await findLeadSourceById(id)
  if (!leadSource) throw new NotFoundError("Lead source")

  // Scope check
  assertLeadSourceScope(actor, leadSource)

  // Check duplicate name if name is being changed
  if (name && name.trim() !== leadSource.name) {
    const existing = await findDuplicateLeadSource(name, leadSource.companyId, id)
    if (existing) {
      throw new ConflictError(`Lead source "${name}" already exists`, "name")
    }
  }

  const updated = await updateLeadSource(id, { name, isActive, description })

  return {
    ...updated,
    type: updated.companyId ? "COMPANY" : "GLOBAL"
  }
}

// ══════════════════════════════════════════════════════════
// TOGGLE LEAD SOURCE STATUS
// ══════════════════════════════════════════════════════════

export const toggleLeadSourceStatusService = async (id, actor) => {
  const leadSource = await findLeadSourceById(id)
  if (!leadSource) throw new NotFoundError("Lead source")

  // Scope check
  assertLeadSourceScope(actor, leadSource)

  const updated = await updateLeadSource(id, { isActive: !leadSource.isActive })

  return {
    ...updated,
    type: updated.companyId ? "COMPANY" : "GLOBAL"
  }
}
