// src/modules/auth/auth.routes.js

import { Router } from "express"
import { login, refresh, logout, getMe } from "./auth.controllers.js"
import { authenticate } from "../../middleware/Authenticate.js"

const router = Router()

router.post("/auth/login", login)
router.post("/auth/refresh", refresh)
router.post("/auth/logout", logout)
router.get("/auth/me", authenticate, getMe)

export default router
