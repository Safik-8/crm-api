import {
  findUserByEmail,
  findUserById,
  updateUserLastLogin,
  createRefreshToken,
  findRefreshToken,
  deleteRefreshToken,
  deleteManyRefreshTokens,
  upsertPasswordReset,
  findPasswordResetByEmail,
  updatePasswordResetVerified,
  deletePasswordReset,
  updateUserPassword
} from "./auth.repository.js"
import { loginSchema, refreshSchema } from "./auth.validation.js"
import bcrypt from "bcryptjs"
import {
  generateAccessToken,
  generateRefreshToken
} from "../../utils/tokenUtils.js"
import {
  ValidationError,
  UnauthorizedError,
  AccountInactiveError,
  NoRoleError,
  NotFoundError,
  BadRequestError
} from "../../utils/AppError.js"
import { sendEmail } from "../../utils/mailer.js"
import { hashPassword } from "../../utils/passwordUtils.js"
import dotenv from "dotenv"
dotenv.config()

// ══════════════════════════════════════
// LOGIN SERVICE
// ══════════════════════════════════════
export const loginUserService = async (email, password) => {

  // ── 1. VALIDATE INPUT WITH ZOD ──────────────────────────
  const validation = loginSchema.safeParse({ email, password })
  if (!validation.success) {
    const fields = validation.error.issues.map(err => ({
      field: err.path.join("."),
      message: err.message
    }))
    throw new ValidationError("Validation failed", fields)
  }

  // ── 2. FIND USER ───────────────────────────────────────
  const user = await findUserByEmail(email)

  // ── 3. USER EXISTS CHECK ───────────────────────────────
  if (!user) throw new UnauthorizedError("Invalid email or password")

  // ── 4. PASSWORD CHECK FIRST ────────────────────────────
  const isValid = await bcrypt.compare(password, user.passwordHash)
  if (!isValid) throw new UnauthorizedError("Invalid email or password")

  // ── 5. STATUS CHECK ────────────────────────────────────
  if (user.status !== "ACTIVE") throw new AccountInactiveError()

  // ── 6. ROLES CHECK ─────────────────────────────────────
  if (!user.userRoles?.length) throw new NoRoleError()

  // ── 7. PRIMARY ROLE ────────────────────────────────────
  const primaryUserRole =
    user.userRoles.find(ur => ur.isPrimary) ?? user.userRoles[0]

  // ── 8. ALL ROLES — deduplicated ────────────────────────
  const uniqueRolesMap = new Map()
  user.userRoles.forEach(ur => {
    const key = `${ur.role.name}_${ur.companyId}_${ur.branchId}`
    if (!uniqueRolesMap.has(key)) {
      uniqueRolesMap.set(key, {
        role      : ur.role.name,
        companyId : ur.companyId,
        branchId  : ur.branchId,
        isPrimary : ur.isPrimary,
      })
    }
  })
  const allRoles = Array.from(uniqueRolesMap.values())

  // ── 9. PERMISSIONS — additive from all roles ───────────
  const permissionsMap = {}
  user.userRoles.forEach(ur => {
    ur.role.rolePermissions.forEach(rp => {
      if (!permissionsMap[rp.module]) {
        permissionsMap[rp.module] = {
          canView   : false,
          canCreate : false,
          canEdit   : false,
          canDelete : false,
        }
      }
      if (rp.canView)   permissionsMap[rp.module].canView   = true
      if (rp.canCreate) permissionsMap[rp.module].canCreate = true
      if (rp.canEdit)   permissionsMap[rp.module].canEdit   = true
      if (rp.canDelete) permissionsMap[rp.module].canDelete = true
    })
  })

  // ── 10. GENERATE TOKENS ────────────────────────────────
  const accessToken  = generateAccessToken({
    userId      : user.id,
    email       : user.email,
    name        : user.name,
    companyId   : user.companyId,
    branchId    : user.branchId,
    primaryRole : primaryUserRole.role.name,
    roles       : allRoles,
    permissions : permissionsMap,
  })
  const refreshToken = generateRefreshToken({
    userId    : user.id,
  })

  // ── 11. SAVE REFRESH TOKEN TO DB ───────────────────────
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  await createRefreshToken(user.id, refreshToken, expiresAt)

  // ── 12. UPDATE LAST LOGIN ──────────────────────────────
  await updateUserLastLogin(user.id)

  // ── 13. RETURN — clean structure ───────────────────────
  return {
    accessToken,
    refreshToken,
    user: {
      id          : user.id,
      name        : user.name,
      email       : user.email,
      status      : user.status,
      companyId   : user.companyId,
      companyName : user.company?.name    ?? null,
      companyCode : user.company?.code    ?? null,
      branchId    : user.branchId,
      branchName  : user.branch?.name     ?? null,
      branchCode  : user.branch?.code     ?? null,
      primaryRole : primaryUserRole.role.name,
      roles       : allRoles,
      permissions : permissionsMap,
    }
  }
}

// ══════════════════════════════════════
// REFRESH TOKEN SERVICE
// ══════════════════════════════════════
export const refreshTokenService = async (refreshToken) => {
  // ── 1. VALIDATE WITH ZOD ───────────────────────────────
  const validation = refreshSchema.safeParse({ refreshToken })
  if (!validation.success) {
    const fields = validation.error.issues.map(err => ({
      field: err.path.join("."),
      message: err.message
    }))
    throw new ValidationError("Validation failed", fields)
  }

  // ── 2. VERIFY SIGNATURE ────────────────────────────────
  let payload
  try {
    const { verifyRefreshToken } = await import("../../utils/tokenUtils.js")
    payload = verifyRefreshToken(refreshToken)
  } catch(err) {
    throw new UnauthorizedError("Invalid or expired refresh token")
  }

  // ── 3. CHECK TOKEN EXISTS IN DB ────────────────────────
  const stored = await findRefreshToken(refreshToken)

  if (!stored) {
    throw new UnauthorizedError("Refresh token not found")
  }

  // ── 4. CHECK EXPIRY ────────────────────────────────────
  if (stored.expiresAt < new Date()) {
    await deleteRefreshToken(refreshToken)
    throw new UnauthorizedError("Refresh token expired")
  }

  // ── 5. GET FRESH USER DATA ─────────────────────────────
  const user = await findUserById(payload.userId)

  if (!user || user.status !== "ACTIVE") {
    throw new UnauthorizedError("User not found or inactive")
  }

  // ── 6. REBUILD ROLES AND PERMISSIONS ───────────────────
  const primaryUserRole =
    user.userRoles.find(ur => ur.isPrimary) ?? user.userRoles[0]

  const allRoles = user.userRoles.map(ur => ({
    role: ur.role.name,
    companyId: ur.companyId,
    branchId: ur.branchId,
    isPrimary: ur.isPrimary,
  }))

  const permissionsMap = {}
  user.userRoles.forEach(ur => {
    ur.role.rolePermissions.forEach(rp => {
      if (!permissionsMap[rp.module]) {
        permissionsMap[rp.module] = {
          canView: false,
          canCreate: false,
          canEdit: false,
          canDelete: false,
        }
      }
      if (rp.canView)   permissionsMap[rp.module].canView = true
      if (rp.canCreate) permissionsMap[rp.module].canCreate = true
      if (rp.canEdit)   permissionsMap[rp.module].canEdit = true
      if (rp.canDelete) permissionsMap[rp.module].canDelete = true
    })
  })

  // ── 7. 🔥 DELETE OLD REFRESH TOKEN (ROTATION) ──────────
  await deleteRefreshToken(refreshToken)

  // ── 8. 🔥 GENERATE NEW TOKENS ──────────────────────────
  const newAccessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    companyId: user.companyId,
    branchId: user.branchId,
    primaryRole: primaryUserRole.role.name,
    roles: allRoles,
    permissions: permissionsMap,
  })

  const newRefreshToken = generateRefreshToken({
    userId: user.id,
  })

  // ── 9. 🔥 SAVE NEW REFRESH TOKEN ───────────────────────
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  await createRefreshToken(user.id, newRefreshToken, expiresAt)

  // ── 10. RETURN ─────────────────────────────────────────
  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      companyId: user.companyId,
      companyName: user.company?.name ?? null,
      companyCode: user.company?.code ?? null,
      branchId: user.branchId,
      branchName: user.branch?.name ?? null,
      branchCode: user.branch?.code ?? null,
      primaryRole: primaryUserRole.role.name,
      roles: allRoles,
      permissions: permissionsMap,
    }
  }
}

// ══════════════════════════════════════
// LOGOUT SERVICE
// ══════════════════════════════════════
export const logoutService = async (refreshToken) => {
  if (!refreshToken) return

  await deleteManyRefreshTokens(refreshToken)
}

// ══════════════════════════════════════
// FORGOT PASSWORD SERVICE (Send OTP)
// ══════════════════════════════════════
export const forgotPasswordService = async (email) => {
  // Check if user exists
  const user = await findUserByEmail(email)
  if (!user) {
    throw new NotFoundError("User with this email")
  }

  // Generate 6-digit OTP code
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes expiry

  // Save OTP to DB
  await upsertPasswordReset(email, otp, expiresAt)

  // Send Email with OTP
  await sendEmail({
    to: email,
    subject: "StackDot CRM - Password Reset OTP",
    text: `Your password reset OTP code is ${otp}. It will expire in 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2>Password Reset Request</h2>
        <p>You requested a password reset for your StackDot CRM account.</p>
        <p>Please use the following 6-digit One-Time Password (OTP) to reset your password:</p>
        <div style="background-color: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; border-radius: 4px; margin: 20px 0;">
          ${otp}
        </div>
        <p style="color: #666; font-size: 12px;">This OTP will expire in 10 minutes. If you did not make this request, please ignore this email.</p>
      </div>
    `
  })

  return { email }
}

// ══════════════════════════════════════
// VERIFY OTP SERVICE
// ══════════════════════════════════════
export const verifyOtpService = async (email, otp) => {
  const record = await findPasswordResetByEmail(email)
  
  if (!record) {
    throw new NotFoundError("OTP request")
  }

  if (record.expiresAt < new Date()) {
    throw new BadRequestError("OTP code has expired")
  }

  if (record.otp !== otp) {
    throw new BadRequestError("Invalid OTP code")
  }

  // Mark as verified
  await updatePasswordResetVerified(email, true)

  return { email, verified: true }
}

// ══════════════════════════════════════
// RESET PASSWORD SERVICE
// ══════════════════════════════════════
export const resetPasswordService = async (email, otp, newPassword) => {
  const record = await findPasswordResetByEmail(email)

  if (!record) {
    throw new BadRequestError("No password reset request found. Please request OTP first.")
  }

  if (!record.isVerified) {
    throw new BadRequestError("OTP has not been verified. Please verify OTP first.")
  }

  if (record.expiresAt < new Date()) {
    throw new BadRequestError("Reset session has expired. Please request a new OTP.")
  }

  if (record.otp !== otp) {
    throw new BadRequestError("Invalid OTP code matching this session")
  }

  // Hash new password and update user record
  const passwordHash = await hashPassword(newPassword)
  await updateUserPassword(email, passwordHash)

  // Clear/delete reset record
  await deletePasswordReset(email)

  return { email, success: true }
}

