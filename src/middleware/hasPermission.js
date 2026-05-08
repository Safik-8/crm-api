import { PermissionDeniedError } from "../utils/AppError.js"
 
// Check module permission
// action: "canView" | "canCreate" | "canEdit" | "canDelete"
export const hasPermission = (module, action) => {
  return (req, res, next) => {
    const modulePerms = req.user.permissions[module]
    if (!modulePerms || !modulePerms[action]) {
      return next(new PermissionDeniedError(module, action))
    }
    next()
  }
}
 


























