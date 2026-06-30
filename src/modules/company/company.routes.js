// src/modules/company/company.routes.js

import { Router } from "express"
import {
  createCompany,
  getAllCompanies,
  getCompaniesWithPagination,
  getCompanyById,
  updateCompany
} from "./company.controllers.js"
import {
  createCompanySchema,
  updateCompanySchema,
  validateBody
} from "./company.validation.js"
import { authenticate } from "../../middleware/Authenticate.js"
import { hasPermission } from "../../middleware/hasPermission.js"

const router = Router()

// All routes in this module require JWT authentication
router.use(authenticate)

// onboard a new company
router.post(
  "/",
  hasPermission("COMPANY", "canCreate"),
  validateBody(createCompanySchema),
  createCompany
)

// GET /api/companies — raw list (useful for dropdowns)
router.get(
  "/",
  hasPermission("COMPANY", "canView"),
  getAllCompanies
)

// GET /api/companies/paginated — paginated/filtered list (useful for tables)
router.get(
  "/paginated",
  hasPermission("COMPANY", "canView"),
  getCompaniesWithPagination
)

// GET /api/companies/:id — fetch single company details
router.get(
  "/:id",
  hasPermission("COMPANY", "canView"),
  getCompanyById
)

// PUT /api/companies/:id — modify name or status
router.put(
  "/:id",
  hasPermission("COMPANY", "canEdit"),
  validateBody(updateCompanySchema),
  updateCompany
)

export default router
