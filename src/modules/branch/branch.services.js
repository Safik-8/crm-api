// src/modules/branch/branch.service.js

import prisma from "../../config/db.js"
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError
} from "../../utils/AppError.js"
import { hashPassword } from "../../utils/passwordUtils.js"

// ══════════════════════════════════════
// SCOPE GUARD
// Every query must be scoped by companyId
// ══════════════════════════════════════
const assertCompanyScope = (actor, targetCompanyId) => {
  if (actor.primaryRole === "SUPER_ADMIN") return
  if (actor.companyId !== targetCompanyId) {
    throw new ForbiddenError("You cannot access data from another company")
  }
}

// ── ROLE CREATION RULES ───────────────────────────────────
const ROLE_CREATION_RULES = {
  SUPER_ADMIN : ["SUPER_ADMIN", "CEO", "BRANCH_ADMIN", "MANAGER", "ISE"],
  BRANCH_ADMIN: ["MANAGER", "ISE"],
  MANAGER     : [],
  CEO         : [],
  ISE         : [],
}

// ── ROLES THAT NEED BRANCH ────────────────────────────────
const ROLES_NEED_BRANCH = ["BRANCH_ADMIN", "MANAGER", "ISE"]


// ══════════════════════════════════════
// CREATE BRANCH
// ══════════════════════════════════════
export const createBranchService = async (data, actor) => {

  const { companyId, name, code, status = "ACTIVE" } = data

  // Validate
  const errors = []
  if (!companyId) errors.push({ field: "companyId", message: "Company is required" })
  if (!name)      errors.push({ field: "name",      message: "Branch name is required" })
  if (!code)      errors.push({ field: "code",      message: "Branch code is required" })
  if (errors.length > 0) throw new ValidationError("Validation failed", errors)

  // Scope check — cannot create branch in another company
  assertCompanyScope(actor, Number(companyId))

  // Check company exists
  const company = await prisma.company.findUnique({
    where: { id: Number(companyId) }
  })
  if (!company) throw new NotFoundError("Company")
  if (company.status !== "ACTIVE") {
    throw new ValidationError("Company is inactive")
  }

  // Check code unique within company
  const existing = await prisma.branch.findFirst({
    where: { companyId: Number(companyId), code: code.toUpperCase() }
  })
  if (existing) throw new ConflictError("Branch code already exists in this company", "code")

  const branch = await prisma.branch.create({
    data: {
      companyId: Number(companyId),
      name,
      code  : code.toUpperCase(),
      status
    },
    include: {
      company: { select: { id: true, name: true } }
    }
  })

  return branch
}

// ══════════════════════════════════════
// GET BRANCHES BY COMPANY
// ══════════════════════════════════════
export const getBranchesService = async (query, actor) => {

  const { company_id } = query

  // ── 1. DETERMINE COMPANY SCOPE ─────────────────────────
  const scopedCompanyId = actor.primaryRole === "SUPER_ADMIN"
    ? Number(company_id)
    : actor.companyId

  if (!scopedCompanyId) {
    throw new ValidationError("Validation failed", [
      { field: "company_id", message: "company_id is required" }
    ])
  }

  // ── 2. NON SUPER ADMIN CHECK ───────────────────────────
  if (actor.primaryRole !== "SUPER_ADMIN" && company_id) {
    assertCompanyScope(actor, Number(company_id))
  }

  // ── 3. CHECK COMPANY EXISTS (IMPORTANT 🔥)
  const company = await prisma.company.findUnique({
    where: { id: scopedCompanyId }
  })

  if (!company) {
    throw new NotFoundError("Company not found")
  }

  // ── 4. FETCH ALL BRANCHES (NO PAGINATION) ──────────────
  const branches = await prisma.branch.findMany({
    where: { companyId: scopedCompanyId },
    orderBy: { createdAt: "desc" },
    include: {
      company: { select: { id: true, name: true } },
      _count : { select: { users: true } }
    }
  })

  // ── 5. RETURN ─────────────────────────────────────────
  return {
    branches,
    total: branches.length
  }
}

// ══════════════════════════════════════
// GET SINGLE BRANCH
// ══════════════════════════════════════
export const getBranchByIdService = async (id, actor) => {

  const branch = await prisma.branch.findUnique({
    where  : { id: Number(id) },
    include: {
      company: { select: { id: true, name: true } },
      _count : { select: { users: true } }
    }
  })

  if (!branch) throw new NotFoundError("Branch")

  // Scope check
  assertCompanyScope(actor, branch.companyId)

  return branch
}

// ══════════════════════════════════════
// UPDATE BRANCH
// ══════════════════════════════════════
export const updateBranchService = async (id, data, actor) => {

  const { name, status } = data

  const branch = await prisma.branch.findUnique({
    where: { id: Number(id) }
  })
  if (!branch) throw new NotFoundError("Branch")

  // Scope check
  assertCompanyScope(actor, branch.companyId)

  const updated = await prisma.branch.update({
    where: { id: Number(id) },
    data : {
      ...(name   && { name }),
      ...(status && { status })
    },
    include: {
      company: { select: { id: true, name: true } }
    }
  })

  return updated
}

// ══════════════════════════════════════════════════════════
// ASSIGN USER TO BRANCH
// Creates new user and assigns them to this branch
// ══════════════════════════════════════════════════════════
export const assignUserToBranchService = async (branchId, data, actor) => {

  const { name, email, password, roleName } = data

  // ── VALIDATE ─────────────────────────────────────────
  const errors = []
  if (!name)     errors.push({ field: "name",     message: "Name is required" })
  if (!email)    errors.push({ field: "email",    message: "Email is required" })
  if (!password) errors.push({ field: "password", message: "Password is required" })
  if (!roleName) errors.push({ field: "roleName", message: "Role is required" })
  if (errors.length > 0) throw new ValidationError("Validation failed", errors)

  // ── CHECK BRANCH EXISTS ───────────────────────────────
  const branch = await prisma.branch.findUnique({
    where  : { id: Number(branchId) },
    include: { company: true }
  })
  if (!branch) throw new NotFoundError("Branch")

  // ── SCOPE GUARD ───────────────────────────────────────
  assertCompanyScope(actor, branch.companyId)

  // ── ROLE CREATION GUARD ───────────────────────────────
  const allowedToCreate = ROLE_CREATION_RULES[actor.primaryRole] ?? []
  if (!allowedToCreate.includes(roleName)) {
    throw new ForbiddenError(
      `${actor.primaryRole} cannot create user with role ${roleName}`
    )
  }

  // ── ROLE NEEDS BRANCH CHECK ───────────────────────────
  if (!ROLES_NEED_BRANCH.includes(roleName)) {
    throw new ValidationError(
      `Role ${roleName} cannot be assigned to a branch directly`,
      [{ field: "roleName", message: "Use BRANCH_ADMIN, MANAGER, or ISE" }]
    )
  }

  // ── CHECK ROLE EXISTS ─────────────────────────────────
  const role = await prisma.role.findUnique({
    where: { name: roleName }
  })
  if (!role) throw new NotFoundError("Role")

  // ── CHECK EMAIL UNIQUE ────────────────────────────────
  const existingUser = await prisma.user.findUnique({
    where: { email }
  })
  if (existingUser) throw new ConflictError("Email already registered", "email")

  // ── HASH PASSWORD ─────────────────────────────────────
  const hashedPassword = await hashPassword(password)

  // ── CREATE USER + ASSIGN ROLE IN TRANSACTION ──────────
  const result = await prisma.$transaction(async (tx) => {

    // Create user
    const user = await tx.user.create({
      data: {
        name        : name,
        email       : email,
        passwordHash: hashedPassword,
        companyId   : branch.companyId,
        branchId    : Number(branchId),
        status      : "ACTIVE"
      }
    })

    // Assign role
    await tx.userRole.create({
      data: {
        userId    : user.id,
        roleId    : role.id,
        companyId : branch.companyId,
        branchId  : Number(branchId),
        isPrimary : true,
        assignedBy: actor.id
      }
    })

    return user
  })

  // ── RETURN SAFE USER ──────────────────────────────────
  const safeUser = await prisma.user.findUnique({
    where  : { id: result.id },
    select : {
      id       : true,
      name     : true,
      email    : true,
      status   : true,
      createdAt: true,
      company  : { select: { id: true, name: true } },
      branch   : { select: { id: true, name: true } },
      userRoles: {
        select: {
          isPrimary: true,
          role     : { select: { id: true, name: true } }
        }
      }
    }
  })

  return safeUser
}

