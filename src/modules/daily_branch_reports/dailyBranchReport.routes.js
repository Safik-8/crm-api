import { Router } from "express"
import { authenticate } from "../../middleware/Authenticate.js"
import { hasPermission } from "../../middleware/hasPermission.js"
import { submitDailyBranchReport , getDailyBranchReports } from "./dailyBranchReport.controller.js"

const router = Router()

router.use(authenticate)

router.post("/submit" , hasPermission("REPORT", "canCreate") ,submitDailyBranchReport);
router.get("/get-reports" , hasPermission("REPORT", "canView") ,getDailyBranchReports);
export default router

