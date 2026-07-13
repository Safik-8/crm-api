// src/modules/userprofile/userprofile.repository.js

import prisma from "../../config/db.js"

/**
 * Fetch full user and profile details by user ID
 */
export const findUserProfileByUserId = async (userId, tx = prisma) => {
  return tx.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      company: {
        select: {
          id: true,
          name: true,
          code: true,
        }
      },
      branch: {
        select: {
          id: true,
          name: true,
          code: true,
        }
      },
      reportingManager: {
        select: {
          id: true,
          name: true,
          email: true,
        }
      },
      userRoles: {
        include: {
          role: true
        }
      }
    }
  })
}

/**
 * Update the user table details
 */
export const updateUserFields = async (userId, data, tx = prisma) => {
  return tx.user.update({
    where: { id: userId },
    data,
  })
}

/**
 * Upsert the user profile table details
 */
export const upsertUserProfileFields = async (userId, data, tx = prisma) => {
  return tx.userProfile.upsert({
    where: { userId },
    update: data,
    create: {
      userId,
      ...data,
    },
  })
}
