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
      company: { select: { id: true, name: true, code: true } },
      branch: { select: { id: true, name: true, code: true } },
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
 */
export const findUserById = async (id) => {
  return prisma.user.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true, code: true } },
      branch: { select: { id: true, name: true, code: true } },
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
 * @returns {Promise<object>}
 */
export const createRefreshToken = async (userId, token, expiresAt) => {
  return prisma.refreshToken.create({
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
 * @returns {Promise<object>}
 */
export const deleteRefreshToken = async (token) => {
  return prisma.refreshToken.delete({
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
 * Upsert a password reset record with email, OTP, and expiry.
 * @param {string} email
 * @param {string} otp
 * @param {Date} expiresAt
 * @returns {Promise<object>}
 */
export const upsertPasswordReset = async (email, otp, expiresAt) => {
  return prisma.passwordReset.upsert({
    where: { email },
    update: {
      otp,
      expiresAt,
      isVerified: false,
    },
    create: {
      email,
      otp,
      expiresAt,
      isVerified: false,
    }
  })
}

/**
 * Find a password reset record by email.
 * @param {string} email
 * @returns {Promise<object|null>}
 */
export const findPasswordResetByEmail = async (email) => {
  return prisma.passwordReset.findUnique({
    where: { email }
  })
}

/**
 * Update the isVerified field on a password reset record.
 * @param {string} email
 * @param {boolean} isVerified
 * @returns {Promise<object>}
 */
export const updatePasswordResetVerified = async (email, isVerified) => {
  return prisma.passwordReset.update({
    where: { email },
    data: { isVerified }
  })
}

/**
 * Delete a password reset record.
 * @param {string} email
 * @returns {Promise<object>}
 */
export const deletePasswordReset = async (email) => {
  return prisma.passwordReset.delete({
    where: { email }
  })
}

/**
 * Update a user's password hash.
 * @param {string} email
 * @param {string} passwordHash
 * @returns {Promise<object>}
 */
export const updateUserPassword = async (email, passwordHash) => {
  return prisma.user.update({
    where: { email },
    data: { passwordHash }
  })
}

