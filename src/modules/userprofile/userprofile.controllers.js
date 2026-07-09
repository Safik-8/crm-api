// src/modules/userprofile/userprofile.controllers.js

import {
  getUserProfileService,
  updateUserProfileService,
  changePasswordService,
  getUserSessionsService,
  revokeUserSessionService,
  deactivateUserAccountService,
} from "./userprofile.services.js"
import { sendSuccess } from "../../utils/response.js"

/**
 * GET /api/user-profile
 */
export const getUserProfile = async (req, res, next) => {
  try {
    const profile = await getUserProfileService(req.user.id)
    return sendSuccess(res, { profile }, "User profile fetched successfully")
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/user-profile
 */
export const updateUserProfile = async (req, res, next) => {
  try {
    const profile = await updateUserProfileService(req.user.id, req.body)
    return sendSuccess(res, { profile }, "User profile updated successfully")
  } catch (err) {
    next(err)
  }
}

/**
 * PUT /api/user-profile/change-password
 */
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body
    await changePasswordService(req.user.id, currentPassword, newPassword)
    return sendSuccess(res, null, "Password updated successfully")
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/user-profile/sessions
 */
export const getUserSessions = async (req, res, next) => {
  try {
    const sessions = await getUserSessionsService(req.user.id)
    const currentRefreshToken = req.cookies?.refreshToken
    const sanitizedSessions = sessions.map(session => {
      const { token, ...rest } = session
      return {
        ...rest,
        isCurrent: token === currentRefreshToken
      }
    })
    return sendSuccess(res, { sessions: sanitizedSessions }, "User sessions fetched successfully")
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/user-profile/sessions/:id
 */
export const revokeUserSession = async (req, res, next) => {
  try {
    const { id } = req.params
    const sessionId = parseInt(id, 10)
    if (isNaN(sessionId)) {
      return res.status(400).json({ success: false, message: "Invalid session ID" })
    }
    const revoked = await revokeUserSessionService(req.user.id, sessionId)
    
    const currentRefreshToken = req.cookies?.refreshToken
    if (revoked.token === currentRefreshToken) {
      res.clearCookie("accessToken")
      res.clearCookie("refreshToken")
    }
    return sendSuccess(res, null, "Session revoked successfully")
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/user-profile/deactivate
 */
export const deactivateUserAccount = async (req, res, next) => {
  try {
    await deactivateUserAccountService(req.user.id)
    res.clearCookie("accessToken")
    res.clearCookie("refreshToken")
    return sendSuccess(res, null, "Account deactivated successfully")
  } catch (err) {
    next(err)
  }
}

