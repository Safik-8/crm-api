import { Router } from "express"
import { authenticate } from "../../middleware/Authenticate.js"
import { authorize } from "../../middleware/authorize.js"
import { submitDailyBranchReport, getDailyBranchReports, getDashboardReports } from "./dailyBranchReport.controller.js"

const router = Router()

router.use(authenticate)

router.post("/submit",      authorize("ISE"),                                                              submitDailyBranchReport)
router.get("/get-reports",  authorize("SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER"),                   getDailyBranchReports)
router.get("/dashboard",    authorize("SUPER_ADMIN", "COMPANY_ADMIN", "BRANCH_MANAGER", "ISE", "BDE"),      getDashboardReports)

export default router

