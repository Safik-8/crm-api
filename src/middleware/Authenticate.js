// src/middleware/authenticate.js

import { verifyAccessToken }  from "../utils/tokenUtils.js"
import {
  UnauthorizedError,
  TokenExpiredError,
  TokenInvalidError,
  AccountInactiveError,
  NoRoleError
} from "../utils/AppError.js"
import prisma from "../config/db.js"

export const authenticate = async (req, res, next) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization
    const token = (authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null) || req.cookies?.accessToken || req.body?.accessToken

    if (!token) return next(new UnauthorizedError("No token provided"))

    // Verify token
    let payload
    try {
      payload = verifyAccessToken(token)
    } catch (err) {
      return next(
        err.name === "TokenExpiredError"
          ? new TokenExpiredError()
          : new TokenInvalidError()
      )
    }

    // Get user from DB with roles and permissions
    const user = await prisma.user.findUnique({
      where  : { id: payload.userId },
      include: {
        company: { select: { id: true, name: true, code: true, logo: true, industry: true, website: true, address: true, status: true } },
        userRoles: {
          include: {
            role: {
              include: { rolePermissions: true }
            }
          }
        }
      }
    })

    if (!user)                   return next(new UnauthorizedError("User not found"))
    if (user.status !== "ACTIVE") return next(new AccountInactiveError())
    if (!user.userRoles?.length) return next(new NoRoleError())

    const primaryUserRole = user.userRoles.find(ur => ur.isPrimary) || user.userRoles[0]

    // Build permissions map: { "COMPANY": { canView, canCreate, canEdit, canDelete } }
    const permissionsMap = {}
    user.userRoles.forEach(ur => {
      ur.role.rolePermissions.forEach(rp => {
        if (!permissionsMap[rp.module]) {
          permissionsMap[rp.module] = {
            canView   : false,
            canCreate : false,
            canEdit   : false,
            canDelete : false
          }
        }
        // Additive — if ANY role has permission, user has it
        if (rp.canView)   permissionsMap[rp.module].canView   = true
        if (rp.canCreate) permissionsMap[rp.module].canCreate = true
        if (rp.canEdit)   permissionsMap[rp.module].canEdit   = true
        if (rp.canDelete) permissionsMap[rp.module].canDelete = true
      })
    })

    // ── req.user shape ────────────────────────────────────────────────────────────────────────────────────
    // primaryRole     → role.name  e.g. "SUPER_ADMIN"  ← use this in all logic checks
    // primaryRoleName → role.name  (same — name is both identifier AND display in final DBML)
    // primaryRoleRank → role.rank  e.g. 100            ← use this for rank comparisons
    // ────────────────────────────────────────────────────────────────────────────────────
    req.user = {
      id              : user.id,
      name            : user.name,
      email           : user.email,
      companyId       : user.companyId,
      branchId        : user.branchId,
      company         : user.company,
      primaryRole     : primaryUserRole.role.name,        // ← role name used in all logic checks
      primaryRoleRank : primaryUserRole.role.rank ?? 0,   // ← authority level for rank comparisons
      allRoles        : user.userRoles.map(ur => ({
        name      : ur.role.name,
        rank      : ur.role.rank ?? 0,
        companyId : ur.companyId,
        branchId  : ur.branchId,
        isPrimary : ur.isPrimary
      })),
      permissions     : permissionsMap
    }

    next()

  } catch (err) {
    next(err)
  }
}