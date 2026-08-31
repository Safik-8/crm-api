// src/modules/auth/auth.routes.js

import { Router } from "express"
import { login, refresh, logout, getMe, forgotPassword, resetPassword, verifyOtp, changePassword } from "./auth.controllers.js"
import { authenticate } from "../../middleware/Authenticate.js"
import { validateBody, loginSchema, forgotPasswordSchema, resetPasswordSchema, verifyOtpSchema, changePasswordSchema } from "./auth.validation.js"
import { loginLimiter, passwordResetLimiter, otpLimiter } from "../../middleware/rateLimiters.js"

const router = Router()

router.post("/auth/login", loginLimiter, validateBody(loginSchema), login)
router.post("/auth/refresh", refresh)
router.post("/auth/logout", logout)
router.get("/auth/me", authenticate, getMe)
router.post("/auth/forgot-password", passwordResetLimiter, validateBody(forgotPasswordSchema), forgotPassword)
router.post("/auth/verify-otp", otpLimiter, validateBody(verifyOtpSchema), verifyOtp)
router.post("/auth/reset-password", passwordResetLimiter, validateBody(resetPasswordSchema), resetPassword)
router.post("/auth/change-password", authenticate, validateBody(changePasswordSchema), changePassword)

export default router
