// src/modules/auth/auth.routes.js

import { Router } from "express"
import {
  login,
  refresh,
  logout,
  getMe,
  forgotPassword,
  verifyOtp,
  resetPassword
} from "./auth.controllers.js"
import { authenticate } from "../../middleware/Authenticate.js"
import {
  validateBody,
  loginSchema,
  forgotPasswordSchema,
  verifyOtpSchema,
  resetPasswordSchema
} from "./auth.validation.js"

const router = Router()

router.post("/auth/login", validateBody(loginSchema), login)
router.post("/auth/refresh", refresh)
router.post("/auth/logout", logout)
router.get("/auth/me", authenticate, getMe)

router.post("/auth/forgot-password", validateBody(forgotPasswordSchema), forgotPassword)
router.post("/auth/verify-otp", validateBody(verifyOtpSchema), verifyOtp)
router.post("/auth/reset-password", validateBody(resetPasswordSchema), resetPassword)

export default router
