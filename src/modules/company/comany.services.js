// src/modules/company/company.service.js

import prisma from "../../config/db.js"
import {
    ValidationError,
    NotFoundError,
    ConflictError,
    ForbiddenError
} from "../../utils/AppError.js"

// ══════════════════════════════════════
// CREATE COMPANY
// ══════════════════════════════════════
export const createCompanyService = async (data, actor) => {

    const { name, code, status = "ACTIVE" } = data

    // Validate
    const errors = []
    if (!name) errors.push({ field: "name", message: "Company name is required" })
    if (!code) errors.push({ field: "code", message: "Company code is required" })
    if (errors.length > 0) throw new ValidationError("Validation failed", errors)

    // Check code unique
    const existing = await prisma.company.findUnique({ where: { code } })
    if (existing) throw new ConflictError("Company code already exists", "code")

    const company = await prisma.company.create({
        data: { name, code: code.toUpperCase(), status }
    })

    return company
}

// ══════════════════════════════════════
// GET ALL COMPANIES
// ══════════════════════════════════════
export const getAllCompaniesService = async () => {
  return await prisma.company.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { branches: true, users: true }
      }
    }
  })
}

// ══════════════════════════════════════
// GET SINGLE COMPANY
// ══════════════════════════════════════
export const getCompanyByIdService = async (id) => {

    const company = await prisma.company.findUnique({
        where: { id: Number(id) },
        include: {
            branches: {
                select: { id: true, name: true, code: true, status: true }
            },
            _count: {
                select: { branches: true, users: true }
            }
        }
    })

    if (!company) throw new NotFoundError("Company")

    return company
}

// ══════════════════════════════════════
// UPDATE COMPANY
// ══════════════════════════════════════
export const updateCompanyService = async (id, data) => {

    const { name, status } = data

    // Check exists
    const company = await prisma.company.findUnique({
        where: { id: Number(id) }
    })
    if (!company) throw new NotFoundError("Company")

    const updated = await prisma.company.update({
        where: { id: Number(id) },
        data: {
            ...(name && { name }),
            ...(status && { status })
        }
    })

    return updated
}