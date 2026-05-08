// src/modules/auth/auth.services.js

import prisma from "../../config/db.js"
import bcrypt from "bcryptjs"
import {
  generateAccessToken,
  generateRefreshToken
} from "../../utils/tokenUtils.js"
import {
  ValidationError,
  UnauthorizedError,
  AccountInactiveError,
  NoRoleError
} from "../../utils/AppError.js"


import dotenv from "dotenv"
dotenv.config()
// ══════════════════════════════════════
// LOGIN SERVICE
// ══════════════════════════════════════
export const loginUserService = async (email, password) => {

  // ── 1. VALIDATE INPUT ──────────────────────────────────
  const errors = []
  if (!email)    errors.push({ field: "email",    message: "Email is required" })
  if (!password) errors.push({ field: "password", message: "Password is required" })
  if (errors.length > 0) throw new ValidationError("Validation failed", errors)

  // ── 2. FIND USER ───────────────────────────────────────
  const user = await prisma.user.findUnique({
    where   : { email },
    include : {
      company  : { select: { id: true, name: true, code: true } },
      branch   : { select: { id: true, name: true, code: true } },
      userRoles: {
        include: {
          role: {
            include: { rolePermissions: true }
          }
        }
      }
    }
  })

  // ── 3. USER EXISTS CHECK ───────────────────────────────
  if (!user) throw new UnauthorizedError("Invalid email or password")

  // ── 4. PASSWORD CHECK FIRST ────────────────────────────
  const isValid = await bcrypt.compare(password, user.passwordHash)
  if (!isValid) throw new UnauthorizedError("Invalid email or password")

  // ── 5. STATUS CHECK ────────────────────────────────────
  if (user.status !== "ACTIVE") throw new AccountInactiveError()

  // ── 6. ROLES CHECK ─────────────────────────────────────
  if (!user.userRoles?.length) throw new NoRoleError()

  // ── 7. PRIMARY ROLE ────────────────────────────────────
  const primaryUserRole =
    user.userRoles.find(ur => ur.isPrimary) ?? user.userRoles[0]

  // ── 8. ALL ROLES — deduplicated ────────────────────────
  const uniqueRolesMap = new Map()
  user.userRoles.forEach(ur => {
    const key = `${ur.role.name}_${ur.companyId}_${ur.branchId}`
    if (!uniqueRolesMap.has(key)) {
      uniqueRolesMap.set(key, {
        role      : ur.role.name,
        companyId : ur.companyId,
        branchId  : ur.branchId,
        isPrimary : ur.isPrimary,
      })
    }
  })
  const allRoles = Array.from(uniqueRolesMap.values())

  // ── 9. PERMISSIONS — additive from all roles ───────────
  const permissionsMap = {}
  user.userRoles.forEach(ur => {
    ur.role.rolePermissions.forEach(rp => {
      if (!permissionsMap[rp.module]) {
        permissionsMap[rp.module] = {
          canView   : false,
          canCreate : false,
          canEdit   : false,
          canDelete : false,
        }
      }
      if (rp.canView)   permissionsMap[rp.module].canView   = true
      if (rp.canCreate) permissionsMap[rp.module].canCreate = true
      if (rp.canEdit)   permissionsMap[rp.module].canEdit   = true
      if (rp.canDelete) permissionsMap[rp.module].canDelete = true
    })
  })

  // ── 10. GENERATE TOKENS ────────────────────────────────
  // access token — includes user metadata + permissions
  // full user data fetched fresh from DB on each request via middleware
  const accessToken  = generateAccessToken({
    userId      : user.id,
    email       : user.email,
    name        : user.name,
    companyId   : user.companyId,
    branchId    : user.branchId,
    primaryRole : primaryUserRole.role.name,
    roles       : allRoles,
    permissions : permissionsMap,
  })
  const refreshToken = generateRefreshToken({
    userId    : user.id,
  })

  // ── 11. SAVE REFRESH TOKEN TO DB ───────────────────────
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  await prisma.refreshToken.create({
    data: {
      userId   : user.id,
      token    : refreshToken,
      expiresAt,
    }
  })

  // ── 12. UPDATE LAST LOGIN ──────────────────────────────
  await prisma.user.update({
    where : { id: user.id },
    data  : { lastLoginAt: new Date() }
  })

  // ── 13. RETURN — clean structure ───────────────────────
  return {
    accessToken,
    refreshToken,
    user: {
      id          : user.id,
      name        : user.name,
      email       : user.email,
      status      : user.status,
      companyId   : user.companyId,
      companyName : user.company?.name    ?? null,
      companyCode : user.company?.code    ?? null,
      branchId    : user.branchId,
      branchName  : user.branch?.name     ?? null,
      branchCode  : user.branch?.code     ?? null,
      primaryRole : primaryUserRole.role.name,
      roles       : allRoles,
      permissions : permissionsMap,
    }
  }
}

// ══════════════════════════════════════
// REFRESH TOKEN SERVICE
// ══════════════════════════════════════
export const refreshTokenService = async (refreshToken) => {
  // ── 1. VALIDATE ────────────────────────────────────────
  if (!refreshToken) {
    throw new ValidationError("Validation failed", [
      { field: "refreshToken", message: "Refresh token is required" }
    ])
  }

  // ── 2. VERIFY SIGNATURE ────────────────────────────────
  let payload
  try {
    const { verifyRefreshToken } = await import("../../utils/tokenUtils.js")
    payload = verifyRefreshToken(refreshToken)
  } catch(err) {
    throw new UnauthorizedError("Invalid or expired refresh token")
  }

  // ── 3. CHECK TOKEN EXISTS IN DB ────────────────────────
  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken }
  })

  if (!stored) {
    throw new UnauthorizedError("Refresh token not found")
  }

  // ── 4. CHECK EXPIRY ────────────────────────────────────
  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.delete({
      where: { token: refreshToken }
    })
    throw new UnauthorizedError("Refresh token expired")
  }

  // ── 5. GET FRESH USER DATA ─────────────────────────────
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      company: { select: { id: true, name: true, code: true } },
      branch: { select: { id: true, name: true, code: true } },
      userRoles: {
        include: {
          role: { include: { rolePermissions: true } }
        }
      }
    }
  })

  if (!user || user.status !== "ACTIVE") {
    throw new UnauthorizedError("User not found or inactive")
  }

  // ── 6. REBUILD ROLES AND PERMISSIONS ───────────────────
  const primaryUserRole =
    user.userRoles.find(ur => ur.isPrimary) ?? user.userRoles[0]

  const allRoles = user.userRoles.map(ur => ({
    role: ur.role.name,
    companyId: ur.companyId,
    branchId: ur.branchId,
    isPrimary: ur.isPrimary,
  }))

  const permissionsMap = {}
  user.userRoles.forEach(ur => {
    ur.role.rolePermissions.forEach(rp => {
      if (!permissionsMap[rp.module]) {
        permissionsMap[rp.module] = {
          canView: false,
          canCreate: false,
          canEdit: false,
          canDelete: false,
        }
      }
      if (rp.canView)   permissionsMap[rp.module].canView = true
      if (rp.canCreate) permissionsMap[rp.module].canCreate = true
      if (rp.canEdit)   permissionsMap[rp.module].canEdit = true
      if (rp.canDelete) permissionsMap[rp.module].canDelete = true
    })
  })

  // ── 7. 🔥 DELETE OLD REFRESH TOKEN (ROTATION) ──────────
  await prisma.refreshToken.delete({
    where: { token: refreshToken }
  })

  // ── 8. 🔥 GENERATE NEW TOKENS ──────────────────────────
  const newAccessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    companyId: user.companyId,
    branchId: user.branchId,
    primaryRole: primaryUserRole.role.name,
    roles: allRoles,
    permissions: permissionsMap,
  })

  const newRefreshToken = generateRefreshToken({
    userId: user.id,
  })

  // ── 9. 🔥 SAVE NEW REFRESH TOKEN ───────────────────────
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      token: newRefreshToken,
      expiresAt,
    }
  })

  // ── 10. RETURN ─────────────────────────────────────────
  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken, // 👈 IMPORTANT
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      companyId: user.companyId,
      companyName: user.company?.name ?? null,
      companyCode: user.company?.code ?? null,
      branchId: user.branchId,
      branchName: user.branch?.name ?? null,
      branchCode: user.branch?.code ?? null,
      primaryRole: primaryUserRole.role.name,
      roles: allRoles,
      permissions: permissionsMap,
    }
  }
}

// ══════════════════════════════════════
// LOGOUT SERVICE
// ══════════════════════════════════════
export const logoutService = async (refreshToken) => {
  if (!refreshToken) return

  await prisma.refreshToken.deleteMany({
    where: { token: refreshToken }
  })
}
