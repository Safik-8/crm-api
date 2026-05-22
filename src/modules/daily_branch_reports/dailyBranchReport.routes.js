import { Router } from "express"
import { authenticate } from "../../middleware/Authenticate.js"
import { authorize } from "../../middleware/authorize.js"
import { submitDailyBranchReport, getDailyBranchReports, getDashboardReports } from "./dailyBranchReport.controller.js"

const router = Router()

router.use(authenticate)

router.post("/submit",      authorize("ISE"),          submitDailyBranchReport)
router.get("/get-reports",  authorize("BRANCH_ADMIN"), getDailyBranchReports)
router.get("/dashboard",    authorize("BRANCH_ADMIN", "MANAGER"), getDashboardReports)

export default router

