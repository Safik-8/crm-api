import { Router } from "express"
import { authenticate } from "../../middleware/Authenticate.js"
import {
  submitFeedback,
  listFeedbacks,
  getFeedbackDetails,
  updateFeedbackStatus,
  deleteFeedback
} from "./feedback.controller.js"
import {
  submitFeedbackSchema,
  updateFeedbackStatusSchema,
  validateBody
} from "./feedback.validation.js"

const isSuperAdmin = (req, res, next) => {
  const roleName = req.user?.primaryRole || req.user?.role || ""
  const rank = Number(req.user?.primaryRoleRank ?? 0)
  const isSuper = roleName === "SUPER_ADMIN" || rank >= 100

  if (!isSuper) {
    return res.status(403).json({
      success: false,
      message: "Access restricted to Super Admin only"
    })
  }
  next()
}

const router = Router()

// All feedback endpoints require active authentication
router.use(authenticate)

// 1. Submit feedback / bug report: Open to ALL authenticated users
router.post("/", validateBody(submitFeedbackSchema), submitFeedback)

// 2. Super Admin Kanban & Management: STRICTLY Super Admin only
router.get("/", isSuperAdmin, listFeedbacks)
router.get("/:id", isSuperAdmin, getFeedbackDetails)
router.patch("/:id/status", isSuperAdmin, validateBody(updateFeedbackStatusSchema), updateFeedbackStatus)
router.delete("/:id", isSuperAdmin, deleteFeedback)

export default router
