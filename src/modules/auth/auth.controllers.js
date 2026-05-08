// src/modules/auth/auth.controllers.js

import {
    loginUserService,
    refreshTokenService,
    logoutService
} from "./auth.services.js"
import { sendSuccess } from "../../utils/response.js"
import dotenv from "dotenv"
dotenv.config()

// Cookie options
const ACCESS_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 15 * 60 * 1000  // 15 minutes
}

const REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
}

// ══════════════════════════════════════
// POST /api/auth/login
// ══════════════════════════════════════
export const login = async (req, res, next) => {
    try {
        const { email, password } = req.body

        const result = await loginUserService(email, password)

        // Set tokens in httpOnly cookies
        res.cookie("accessToken", result.accessToken, ACCESS_COOKIE_OPTIONS)
        res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS)

        return sendSuccess(res, {
            user: result.user,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
        }, "Login successful")

    } catch (err) {
        next(err)
    }
}

// ══════════════════════════════════════
// POST /api/auth/refresh
// ══════════════════════════════════════
export const refresh = async (req, res, next) => {
    try {
        const authHeader = req.headers?.authorization || req.headers?.Authorization
        const bearerToken =
            typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")
                ? authHeader.slice(7).trim()
                : undefined

        const refreshToken =
            req.cookies?.refreshToken ||
            req.body?.refreshToken ||
            bearerToken

        const result = await refreshTokenService(refreshToken)

        // Set new access token in cookie
        res.cookie("accessToken", result.accessToken, ACCESS_COOKIE_OPTIONS)
        res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS)

        return sendSuccess(res, {
            user: result.user,
        }, "Token refreshed")

    } catch (err) {
        next(err)
    }
}

// ══════════════════════════════════════
// POST /api/auth/logout
// ══════════════════════════════════════
export const logout = async (req, res, next) => {
    try {
        const refreshToken = req.cookies?.refreshToken

        await logoutService(refreshToken)

        // Clear both cookies
        res.clearCookie("accessToken")
        res.clearCookie("refreshToken")

        return sendSuccess(res, null, "Logged out successfully")

    } catch (err) {
        next(err)
    }
}

// ══════════════════════════════════════
// GET /api/auth/me
// ══════════════════════════════════════
export const getMe = async (req, res, next) => {
    try {
        return sendSuccess(res, { user: req.user }, "User fetched")
    } catch (err) {
        next(err)
    }
}
