// src/modules/userprofile/userprofile.routes.js

import { Router } from "express"
import { getUserProfile, updateUserProfile, changePassword, getUserSessions, revokeUserSession, deactivateUserAccount } from "./userprofile.controllers.js"
import { authenticate } from "../../middleware/Authenticate.js"
import { validateBody, updateUserProfileSchema, changePasswordSchema } from "./userprofile.validation.js"

const router = Router()

// All routes require authentication
router.use(authenticate)

router.get("/", getUserProfile)
router.put("/", validateBody(updateUserProfileSchema), updateUserProfile)
router.put("/change-password", validateBody(changePasswordSchema), changePassword)

router.get("/sessions", getUserSessions)
router.delete("/sessions/:id", revokeUserSession)
router.post("/deactivate", deactivateUserAccount)

export default router
