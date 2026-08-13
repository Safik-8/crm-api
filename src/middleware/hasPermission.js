import { PermissionDeniedError } from "../utils/AppError.js"

// Check module permission
// action: "canView" | "canCreate" | "canEdit" | "canDelete"
export const hasPermission = (module, action) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new PermissionDeniedError(module, action))
    }

    // 1. Super Admin (System Owner) always has absolute global privileges
    if (req.user.primaryRole === "SUPER_ADMIN") {
      return next()
    }

    // 2. Branch Manager (rank >= 60) always has permission to view & edit their scoped branch
    if (module === "BRANCH" && (action === "canView" || action === "canEdit")) {
      if (
        req.user.primaryRole === "BRANCH_MANAGER" ||
        (req.user.primaryRoleRank && Number(req.user.primaryRoleRank) >= 60)
      ) {
        return next()
      }
    }

    // 3. Flexible permission check for Comments / Activities: users with LEAD view/edit/create rights can comment
    if (module === "ACTIVITY") {
      const leadPerms = req.user.permissions?.["LEAD"]
      if (leadPerms && (leadPerms.canView || leadPerms.canEdit || leadPerms.canCreate)) {
        return next()
      }
    }

    // 4. Module permission check from req.user.permissions matrix
    const modulePerms = req.user.permissions?.[module]
    if (!modulePerms || !modulePerms[action]) {
      return next(new PermissionDeniedError(module, action))
    }
    next()
  }
}
