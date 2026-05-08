// src/modules/company/company.routes.js

import { Router } from "express"
import {
    createCompany,
    getAllCompanies,
    getCompaniesWithPagination,
    getCompanyById,
    updateCompany
} from "./comany.controllers.js"
import { authenticate } from "../../middleware/Authenticate.js"
import { authorize } from "../../middleware/authorize.js"
import { hasPermission } from "../../middleware/hasPermission.js"

const router = Router()

// All routes require authentication    
router.use(authenticate)

// POST /api/companies — Super Admin only
router.post(
    "/",
    authorize("SUPER_ADMIN"),
    hasPermission("COMPANY", "canCreate"),
    createCompany
)   

// GET /api/companies — Super Admin only
router.get(
    "/",
    authorize("SUPER_ADMIN"),
    hasPermission("COMPANY", "canView"),
    getAllCompanies
)


// GET /api/companies — with pagination (for table)
router.get(
  "/paginated",
  authorize("SUPER_ADMIN"),
  hasPermission("COMPANY", "canView"),
  getCompaniesWithPagination
)

// GET /api/companies/:id — Super Admin only
router.get(
    "/:id",
    authorize("SUPER_ADMIN"),
    hasPermission("COMPANY", "canView"),
    getCompanyById
)

// PUT /api/companies/:id
router.put(
    "/:id",
    authorize("SUPER_ADMIN"),
    hasPermission("COMPANY", "canEdit"),
    updateCompany
)

export default router