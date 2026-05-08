import { Router } from "express"
import { authenticate } from "../../middleware/Authenticate.js"
import { hasPermission } from "../../middleware/hasPermission.js"
import { submitDailyBranchReport , getDailyBranchReports } from "./dailyBranchReport.controller.js"
import { authorize } from "../../middleware/authorize.js"

const router = Router()

router.use(authenticate)

router.post("/submit" , authorize("ISE") ,submitDailyBranchReport);
router.get("/get-reports" , authorize("BRANCH_ADMIN") ,getDailyBranchReports);
export default router

