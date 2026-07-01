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

    const primaryRole = user.userRoles.find(ur => ur.isPrimary) || user.userRoles[0]

    // Build permissions map: { "COMPANY": { canView, canCreate, canEdit, canDelete } }
    const permissionsMap = {}
    user.userRoles.forEach(ur => {
      ur.role.rolePermissions.forEach(rp => {
        if (!permissionsMap[rp.module]) {
          permissionsMap[rp.module] = {
            canView  : false,
            canCreate: false,
            canEdit  :  false,
            canDelete: false
          }
        }
        // Additive — if ANY role has permission, user has it
        if (rp.canView)   permissionsMap[rp.module].canView   = true
        if (rp.canCreate) permissionsMap[rp.module].canCreate = true
        if (rp.canEdit)   permissionsMap[rp.module].canEdit   = true
        if (rp.canDelete) permissionsMap[rp.module].canDelete = true
      })
    })

    req.user = {
      id           : user.id,
      name         : user.name,
      email        : user.email,
      companyId    : user.companyId,
      branchId     : user.branchId,
      company      : user.company,
      primaryRole  : primaryRole.role.name,
      allRoles     : user.userRoles.map(ur => ({
        role     : ur.role.name,
        companyId: ur.companyId,
        branchId : ur.branchId,
        isPrimary: ur.isPrimary
      })),
      permissions  : permissionsMap
    }

    next()

  } catch (err) {
    next(err)
  }
}