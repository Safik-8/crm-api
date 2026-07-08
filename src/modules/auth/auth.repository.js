// src/modules/auth/auth.repository.js

import prisma from "../../config/db.js"

/**
 * Find a user by their email address, including associated company, branch, and roles/permissions.
 * @param {string} email
 * @returns {Promise<object|null>}
 */
export const findUserByEmail = async (email) => {
  return prisma.user.findUnique({
    where: { email },
    include: {
      company: { select: { id: true, name: true, code: true, logo: true, industry: true, website: true, address: true, status: true } },
      branch: { select: { id: true, name: true, code: true, status: true } },
      userRoles: {
        include: {
          role: {
            include: { rolePermissions: true }
          }
        }
      }
    }
  })
}

/**
 * Find a user by their ID, including associated company, branch, and roles/permissions.
 * @param {number} id
 * @returns {Promise<object|null>}
 * @returns {Promise<object|null>}
 */
export const findUserById = async (id) => {
  return prisma.user.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true, code: true, logo: true, industry: true, website: true, address: true, status: true } },
      branch: { select: { id: true, name: true, code: true, status: true } },
      userRoles: {
        include: {
          role: {
            include: { rolePermissions: true }
          }
        }
      }
    }
  })
}

/**
 * Update a user's last login timestamp.
 * @param {number} id
 * @returns {Promise<object>}
 */
export const updateUserLastLogin = async (id) => {
  return prisma.user.update({
    where: { id },
    data: { lastLoginAt: new Date() }
  })
}

/**
 * Create a new refresh token entry in the database.
 * @param {number} userId
 * @param {string} token
 * @param {Date} expiresAt
 * @param {object} [tx=prisma]
 * @returns {Promise<object>}
 */
export const createRefreshToken = async (userId, token, expiresAt, tx = prisma) => {
  return tx.refreshToken.create({
    data: {
      userId,
      token,
      expiresAt,
    }
  })
}

/**
 * Find a refresh token entry in the database.
 * @param {string} token
 * @returns {Promise<object|null>}
 */
export const findRefreshToken = async (token) => {
  return prisma.refreshToken.findUnique({
    where: { token }
  })
}

/**
 * Delete a specific refresh token.
 * @param {string} token
 * @param {object} [tx=prisma]
 * @returns {Promise<object>}
 */
export const deleteRefreshToken = async (token, tx = prisma) => {
  return tx.refreshToken.delete({
    where: { token }
  })
}

/**
 * Invalidate/delete all matching refresh tokens (used during logout).
 * @param {string} token
 * @returns {Promise<object>}
 */
export const deleteManyRefreshTokens = async (token) => {
  return prisma.refreshToken.deleteMany({
    where: { token }
  })
}

/**
 * Create a new password reset OTP entry.
 */
export const createPasswordReset = async (userId, companyId, otp, expiresAt) => {
  return prisma.passwordReset.create({
    data: {
      userId,
      companyId,
      otp,
      expiresAt
    }
  })
}

/**
 * Find the latest unverified password reset entry for a user and OTP.
 */
export const findLatestResetByUserIdAndOtp = async (userId, otp) => {
  return prisma.passwordReset.findFirst({
    where: {
      userId,
      otp,
      isVerified: false
    },
    orderBy: {
      createdAt: "desc"
    }
  })
}

/**
 * Mark a password reset record as verified.
 */
export const markPasswordResetVerified = async (resetId) => {
  return prisma.passwordReset.update({
    where: { id: resetId },
    data: { isVerified: true }
  })
}

/**
 * Update a user's password hash.
 */
export const updateUserPassword = async (userId, passwordHash) => {
  return prisma.user.update({
    where: { id: userId },
    data: { passwordHash }
  })
}
