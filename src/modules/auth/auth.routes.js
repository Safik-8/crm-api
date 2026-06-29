// src/modules/auth/auth.routes.js

import { Router } from "express"
import { login, refresh, logout, getMe } from "./auth.controllers.js"
import { authenticate } from "../../middleware/Authenticate.js"
import { validateBody, loginSchema } from "./auth.validation.js"

const router = Router()

router.post("/auth/login", validateBody(loginSchema), login)
router.post("/auth/refresh", refresh)
router.post("/auth/logout", logout)
router.get("/auth/me", authenticate, getMe)

export default router
