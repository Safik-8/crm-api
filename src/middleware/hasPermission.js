import { PermissionDeniedError } from "../utils/AppError.js"

// Check module permission
// action: "canView" | "canCreate" | "canEdit" | "canDelete"
export const hasPermission = (module, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new PermissionDeniedError(module, action))
    }

    // 1. Super Admin & Company Admin always have administrative privileges across all modules
    if (
      req.user.primaryRole === "SUPER_ADMIN" ||
      req.user.primaryRole === "COMPANY_ADMIN" ||
      (req.user.primaryRoleRank && Number(req.user.primaryRoleRank) >= 80)
    ) {
      return next()
    }

    // 2. Flexible permission check for Comments / Activities: users with LEAD view/edit/create rights can comment
    if (module === "ACTIVITY") {
      const leadPerms = req.user.permissions?.["LEAD"]
      if (leadPerms && (leadPerms.canView || leadPerms.canEdit || leadPerms.canCreate)) {
        return next()
      }
    }

    // 3. Module permission check from req.user.permissions matrix
    const modulePerms = req.user.permissions?.[module]
    if (!modulePerms || !modulePerms[action]) {
      return next(new PermissionDeniedError(module, action))
    }
    next()
  }
}
