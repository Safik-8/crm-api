// src/modules/leadstatuses/leadstatuses.repository.js
import prisma from "../../config/db.js"

// ── SELECT SHAPE (reused) ──────────────────────────────────────────────────────
const STATUS_SELECT = {
  id: true,
  companyId: true,
  name: true,
  code: true,
  displayColor: true,
  sequenceOrder: true,
  isDefault: true,
  isSystem: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
}

export const findLeadStatusById = (id, tx = prisma) =>
  tx.leadStatus.findUnique({ where: { id: Number(id) }, select: STATUS_SELECT })

// Checks code collision in same scope OR cross global/company (prevents ambiguity in future workflow)
export const findLeadStatusByCode = (code, companyId, excludeId = null, tx = prisma) =>
  tx.leadStatus.findFirst({
    where: {
      code,
      OR: [{ companyId: companyId ?? null }, { companyId: null }],
      ...(excludeId ? { id: { not: Number(excludeId) } } : {}),
    },
    select: { id: true, name: true, companyId: true },
  })

// Checks name collision within same company scope only
export const findDuplicateLeadStatusName = (name, companyId, excludeId = null, tx = prisma) =>
  tx.leadStatus.findFirst({
    where: {
      name: { equals: name.trim(), mode: "insensitive" },
      companyId: companyId ?? null,
      ...(excludeId ? { id: { not: Number(excludeId) } } : {}),
    },
    select: { id: true },
  })

export const findLeadStatuses = (where, tx = prisma) =>
  tx.leadStatus.findMany({ where, select: STATUS_SELECT, orderBy: { sequenceOrder: "asc" } })

export const createLeadStatus = (data, tx = prisma) =>
  tx.leadStatus.create({ data, select: STATUS_SELECT })

export const updateLeadStatus = (id, data, tx = prisma) =>
  tx.leadStatus.update({ where: { id: Number(id) }, data, select: STATUS_SELECT })

export const deleteLeadStatus = (id, tx = prisma) =>
  tx.leadStatus.delete({ where: { id: Number(id) } })

// Clears isDefault for ALL other statuses in the same scope atomically
export const unsetDefaultInScope = (companyId, excludeId, tx = prisma) =>
  tx.leadStatus.updateMany({
    where: {
      companyId: companyId ?? null,
      isDefault: true,
      id: { not: Number(excludeId) },
    },
    data: { isDefault: false },
  })

// Bulk update sequenceOrder — always runs as a transaction
export const bulkUpdateSequence = (items, tx = prisma) => {
  const client = tx ?? prisma
  return client.$transaction(
    items.map(({ id, sequenceOrder }) =>
      client.leadStatus.update({ where: { id: Number(id) }, data: { sequenceOrder } })
    )
  )
}

import { recordAuditLog } from "../auditLog/auditLog.service.js";

// Per-module createAuditLog — entityType hardcoded to "LEAD_STATUS"
export const createAuditLog = async (data, tx = prisma, req = null) => {
  const reqObj = data?.req || req;
  const actionCode = data?.action || "RECORD_UPDATED";
  let actionType = data?.actionType;

  if (!actionType) {
    const actUpper = String(actionCode).toUpperCase();
    if (actUpper.includes("CREATE")) actionType = "CREATE";
    else if (actUpper.includes("DELETE")) actionType = "DELETE";
    else actionType = "UPDATE";
  }

  return recordAuditLog({
    req: reqObj,
    tx,
    companyId: data?.companyId ?? null,
    moduleName: "LEAD_STATUS",
    entityType: data?.entityType || "LEAD_STATUS",
    entityId: data?.entityId,
    actionType,
    action: actionCode,
    oldValue: data?.oldValue ?? null,
    newValue: data?.newValue ?? null,
    performedById: data?.performedById ?? null,
  });
};
