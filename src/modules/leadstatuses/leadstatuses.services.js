// src/modules/leadstatuses/leadstatuses.services.js
import prisma from "../../config/db.js"
import {
  ForbiddenError, NotFoundError, ConflictError, BadRequestError,
} from "../../utils/AppError.js"
import {
  findLeadStatusById, findLeadStatusByCode, findDuplicateLeadStatusName,
  findLeadStatuses, createLeadStatus, updateLeadStatus, deleteLeadStatus,
  unsetDefaultInScope, bulkUpdateSequence, createAuditLog,
} from "./leadstatuses.repository.js"

// ── HELPERS ───────────────────────────────────────────────────────────────────

/** Auto-generate immutable status code from name. "New Lead" → "NEW_LEAD" */
const codeFromName = (name) =>
  name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "")

/** Scope guard — enforced before every mutating operation */
const assertLeadStatusScope = (actor, status) => {
  if (status.companyId === null) {
    // Global status — only SuperAdmin (actor.companyId = null) may mutate
    if (actor.companyId !== null && actor.companyId !== undefined) {
      throw new ForbiddenError("Only Super Admin can modify global lead statuses")
    }
    return
  }
  // Company status — actor must belong to same company
  if (actor.companyId && actor.companyId !== status.companyId) {
    throw new ForbiddenError("You cannot access lead statuses from another company")
  }
}

/** Returns a shape label for API response */
const toType = (status) => ({ ...status, type: status.companyId ? "COMPANY" : "GLOBAL" })

// ── CREATE ────────────────────────────────────────────────────────────────────

export const createLeadStatusService = async (data, actor) => {
  // Scope is derived from actor — never from client input
  const companyId = actor.companyId ?? null

  const code = codeFromName(data.name)

  // Code collision check (blocks "NEW_LEAD" existing in global scope shadowing company scope)
  const codeConflict = await findLeadStatusByCode(code, companyId)
  if (codeConflict) {
    throw new ConflictError(
      `Status code "${code}" already exists in this scope (from "${codeConflict.name}")`,
      "name"
    )
  }

  // Name collision check
  const nameConflict = await findDuplicateLeadStatusName(data.name, companyId)
  if (nameConflict) {
    throw new ConflictError(`Status name "${data.name}" already exists`, "name")
  }

  // Auto-assign sequenceOrder if not provided
  let sequenceOrder = data.sequenceOrder
  if (sequenceOrder === undefined || sequenceOrder === null) {
    const agg = await prisma.leadStatus.aggregate({
      _max: { sequenceOrder: true },
      where: { companyId: companyId ?? null },
    })
    sequenceOrder = (agg._max.sequenceOrder ?? 0) + 1
  }

  return prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await unsetDefaultInScope(companyId, 0, tx) // 0 = no excludeId (nothing yet)
    }

    const status = await createLeadStatus(
      {
        companyId,
        name: data.name.trim(),
        code,
        displayColor: data.displayColor,
        sequenceOrder,
        isDefault: data.isDefault ?? false,
        isSystem: false,   // only initSystem.js creates system statuses
        isActive: true,
      },
      tx
    )

    await createAuditLog(
      { companyId, entityId: status.id, action: "CREATE",
        newValue: JSON.stringify({ name: status.name, code, displayColor: status.displayColor }),
        performedById: actor.id },
      tx
    )

    return toType(status)
  }, { maxWait: 10000, timeout: 20000 })
}

// ── GET LIST ──────────────────────────────────────────────────────────────────

export const getLeadStatusesService = async (query, actor) => {
  const where = {}

  if (actor.companyId === null) {
    // SuperAdmin — sees all (global + all company) or filters by companyId
    if (query.companyId) {
      where.OR = [{ companyId: null }, { companyId: parseInt(query.companyId) }]
    }
  } else {
    // Others — global + own company only
    where.OR = [{ companyId: null }, { companyId: actor.companyId }]
  }

  if (query.search) {
    const searchFilter = { name: { contains: query.search.trim(), mode: "insensitive" } }
    if (where.OR) {
      // Merge search with existing OR (must satisfy both constraints)
      where.AND = [searchFilter]
    } else {
      Object.assign(where, searchFilter)
    }
  }

  if (query.isActive !== undefined) {
    where.isActive = query.isActive === "true"
  }

  const statuses = await findLeadStatuses(where)
  const mapped = statuses.map(toType)

  // If scoped to a company, override global default if a custom company default is defined
  if (actor.companyId) {
    const hasCompanyDefault = mapped.some(
      (s) => s.companyId === actor.companyId && s.isDefault
    )
    if (hasCompanyDefault) {
      mapped.forEach((s) => {
        if (s.companyId === null) {
          s.isDefault = false
        }
      })
    }
  }

  return mapped
}

// ── UPDATE ────────────────────────────────────────────────────────────────────

export const updateLeadStatusService = async (id, data, actor) => {
  const status = await findLeadStatusById(id)
  if (!status) throw new NotFoundError("Lead status")

  assertLeadStatusScope(actor, status)

  // Block deactivating the default status
  if (data.isActive === false && status.isDefault) {
    throw new ForbiddenError("Cannot deactivate the default status. Set another status as default first.")
  }

  // Block removing isDefault without assigning a new one
  if (data.isDefault === false && status.isDefault) {
    throw new ForbiddenError("Cannot remove default status. Set another status as default first.")
  }

  // Name conflict check (only if name is changing)
  if (data.name && data.name.trim().toLowerCase() !== status.name.toLowerCase()) {
    const conflict = await findDuplicateLeadStatusName(data.name, status.companyId, status.id)
    if (conflict) throw new ConflictError(`Status name "${data.name}" already exists`, "name")
  }

  // Build clean update payload — code is immutable, always strip it
  const { code: _stripped, ...safeData } = data
  const updatePayload = {}
  if (safeData.name         !== undefined) updatePayload.name         = safeData.name.trim()
  if (safeData.displayColor !== undefined) updatePayload.displayColor = safeData.displayColor
  if (safeData.sequenceOrder !== undefined) updatePayload.sequenceOrder = safeData.sequenceOrder
  if (safeData.isActive     !== undefined) updatePayload.isActive     = safeData.isActive
  if (safeData.isDefault    !== undefined) updatePayload.isDefault    = safeData.isDefault

  return prisma.$transaction(async (tx) => {
    if (updatePayload.isDefault === true && !status.isDefault) {
      await unsetDefaultInScope(status.companyId, status.id, tx)
    }

    const updated = await updateLeadStatus(id, updatePayload, tx)

    await createAuditLog(
      { companyId: status.companyId, entityId: status.id, action: "UPDATE",
        oldValue: JSON.stringify({ name: status.name, displayColor: status.displayColor, isActive: status.isActive, isDefault: status.isDefault }),
        newValue: JSON.stringify(updatePayload), performedById: actor.id },
      tx
    )

    return toType(updated)
  }, { maxWait: 10000, timeout: 20000 })
}

// ── TOGGLE STATUS ─────────────────────────────────────────────────────────────

export const toggleLeadStatusService = async (id, actor) => {
  const status = await findLeadStatusById(id)
  if (!status) throw new NotFoundError("Lead status")

  assertLeadStatusScope(actor, status)

  if (status.isDefault && status.isActive) {
    throw new ForbiddenError("Cannot deactivate the default status. Set another status as default first.")
  }

  return prisma.$transaction(async (tx) => {
    const updated = await updateLeadStatus(id, { isActive: !status.isActive }, tx)

    await createAuditLog(
      { companyId: status.companyId, entityId: status.id,
        action: "TOGGLE_STATUS",
        oldValue: JSON.stringify({ isActive: status.isActive }),
        newValue: JSON.stringify({ isActive: updated.isActive }),
        performedById: actor.id },
      tx
    )

    return toType(updated)
  }, { maxWait: 10000, timeout: 20000 })
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export const deleteLeadStatusService = async (id, actor) => {
  const status = await findLeadStatusById(id)
  if (!status) throw new NotFoundError("Lead status")

  assertLeadStatusScope(actor, status)

  if (status.isSystem) {
    throw new ForbiddenError("System statuses cannot be deleted")
  }
  if (status.isDefault) {
    throw new ForbiddenError("Cannot delete the default status. Assign another status as default first.")
  }

  // FK safety guard — prevents orphaning leads
  const leadsCount = await prisma.lead.count({
    where: { statusId: Number(id), isDeleted: false },
  })
  if (leadsCount > 0) {
    throw new ForbiddenError(
      `${leadsCount} active lead(s) are using this status. Reassign them before deleting.`
    )
  }

  return prisma.$transaction(async (tx) => {
    await createAuditLog(
      { companyId: status.companyId, entityId: status.id, action: "DELETE",
        oldValue: JSON.stringify({ name: status.name, code: status.code }),
        newValue: null, performedById: actor.id },
      tx
    )
    await deleteLeadStatus(id, tx)
  }, { maxWait: 10000, timeout: 20000 })
}

// ── REORDER ───────────────────────────────────────────────────────────────────

export const reorderLeadStatusesService = async (items, actor) => {
  const ids = items.map((i) => Number(i.id))
  const statuses = await prisma.leadStatus.findMany({
    where: { id: { in: ids } },
    select: { id: true, companyId: true, sequenceOrder: true },
  })

  if (statuses.length !== ids.length) {
    throw new BadRequestError("One or more status IDs not found or do not belong to your scope")
  }

  // Build a map of status by ID
  const statusMap = new Map(statuses.map(s => [s.id, s]))

  // Order them exactly as requested by the client
  const orderedStatuses = ids.map(id => statusMap.get(id))

  // If Super Admin: update all sequence orders directly (spaced by 1000)
  if (actor.companyId === null) {
    const directUpdates = orderedStatuses.map((s, index) => ({
      id: s.id,
      sequenceOrder: (index + 1) * 1000
    }))
    await bulkUpdateSequence(directUpdates)
    return { reordered: directUpdates.length }
  }

  // If Company Admin: perform Gap Interpolation
  const updates = []
  let i = 0
  while (i < orderedStatuses.length) {
    const status = orderedStatuses[i]
    if (status.companyId === null) {
      // It's a global status. We are not allowed to update its sequenceOrder.
      i++
      continue
    }

    // Assert that the company status belongs to the caller's company scope
    if (status.companyId !== actor.companyId) {
      throw new ForbiddenError("You cannot access lead statuses from another company")
    }

    // We found a block of company-scoped statuses starting at index `i`
    const blockStart = i
    while (i < orderedStatuses.length && orderedStatuses[i].companyId !== null) {
      // Assert that any custom status in the block belongs to the caller's company scope
      if (orderedStatuses[i].companyId !== actor.companyId) {
        throw new ForbiddenError("You cannot access lead statuses from another company")
      }
      i++
    }
    const blockEnd = i // index of the next global status, or orderedStatuses.length

    // Find the sequence order of the global status before this block (if any)
    let prevSequence = 0
    if (blockStart > 0) {
      prevSequence = orderedStatuses[blockStart - 1].sequenceOrder
    }

    // Find the sequence order of the global status after this block (if any)
    let nextSequence = prevSequence + 1000
    if (blockEnd < orderedStatuses.length) {
      nextSequence = orderedStatuses[blockEnd].sequenceOrder
    }

    // Interpolate sequence orders for the block
    const blockLength = blockEnd - blockStart
    const step = (nextSequence - prevSequence) / (blockLength + 1)

    for (let k = 0; k < blockLength; k++) {
      const targetStatus = orderedStatuses[blockStart + k]
      const newSequence = Math.floor(prevSequence + (k + 1) * step)
      updates.push({ id: targetStatus.id, sequenceOrder: newSequence })
    }
  }

  if (updates.length > 0) {
    await bulkUpdateSequence(updates)
  }
  return { reordered: updates.length }
}
