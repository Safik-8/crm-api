
import { RoleNotAllowedError } from "../utils/AppError.js"
 
// Check if user has required role
export const authorize = (...roles) => {
  return (req, res, next) => {
    const userRoles = req.user.allRoles.map(r => r.role)
    const hasRole   = roles.some(r => userRoles.includes(r))
    if (!hasRole) return next(new RoleNotAllowedError(roles))
    next()
  }
}
 