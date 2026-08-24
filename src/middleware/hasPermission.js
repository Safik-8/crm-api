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

    // 4. Fallback permission check for KPI module
    if (module === "KPI" || (typeof module === "string" && module.includes("KPI"))) {
      const kpiPerms = req.user.permissions?.["KPI"]
      if (kpiPerms) {
        if ((action === "canManage" || action === "canCreate") && (kpiPerms.canManage || kpiPerms.canCreate || kpiPerms.canEdit)) {
          return next()
        }
        if (kpiPerms[action] !== undefined && kpiPerms[action]) {
          return next()
        }
      }
      if (action === "canView") return next()
      if (action === "canManage" || action === "canCreate" || action === "canEdit") {
        const rank = Number(req.user.primaryRoleRank || 0)
        if (req.user.primaryRole === "SUPER_ADMIN" || req.user.primaryRole === "COMPANY_ADMIN" || req.user.primaryRole === "BRANCH_MANAGER" || rank >= 40) {
          return next()
        }
        return next(new PermissionDeniedError(module, action))
      }
    }

    // 5. Module permission check from req.user.permissions matrix
    const modulePerms = req.user.permissions?.[module]
    if (modulePerms && modulePerms[action]) {
      return next()
    }

    // 6. Fallback permission check for REVENUE_REPORT and SALES_PERFORMANCE to general REPORT module
    if (module === "REVENUE_REPORT" || module === "SALES_PERFORMANCE") {
      const reportPerms = req.user.permissions?.["REPORT"]
      if (reportPerms && reportPerms[action]) {
        return next()
      }
    }

    return next(new PermissionDeniedError(module, action))
  }
}
