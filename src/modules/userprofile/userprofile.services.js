// src/modules/userprofile/userprofile.services.js

import prisma from "../../config/db.js"
import {
  findUserProfileByUserId,
  updateUserFields,
  upsertUserProfileFields,
} from "./userprofile.repository.js"
import { NotFoundError, BadRequestError } from "../../utils/AppError.js"

/**
 * Service to retrieve a user's full profile details
 */
export const getUserProfileService = async (userId) => {
  const user = await findUserProfileByUserId(userId)
  if (!user) {
    throw new NotFoundError("User not found")
  }

  // Sanitize password or other sensitive info
  const { passwordHash, ...safeUser } = user
  
  // Find primary role name
  const primaryRoleObj = user.userRoles?.find(ur => ur.isPrimary)
  const primaryRole = primaryRoleObj?.role?.name || user.userRoles?.[0]?.role?.name || "Member"

  return {
    ...safeUser,
    primaryRole
  }
}

/**
 * Service to update user and profile details
 */
export const updateUserProfileService = async (userId, data) => {
  const user = await findUserProfileByUserId(userId)
  if (!user) {
    throw new NotFoundError("User not found")
  }

  const {
    firstName,
    lastName,
    mobileNumber,
    profilePhoto,
    // Profile fields
    address,
    city,
    state,
    country,
    pincode,
    emergencyContact,
  } = data

  // Prepare user table update
  const userUpdateData = {}
  if (firstName !== undefined) userUpdateData.firstName = firstName
  if (lastName !== undefined) userUpdateData.lastName = lastName
  if (mobileNumber !== undefined) userUpdateData.mobileNumber = mobileNumber
  if (profilePhoto !== undefined) userUpdateData.profilePhoto = profilePhoto

  // Sync the `name` field if firstName or lastName are changed
  if (firstName !== undefined || lastName !== undefined) {
    const finalFirstName = firstName !== undefined ? firstName : (user.firstName || "")
    const finalLastName = lastName !== undefined ? lastName : (user.lastName || "")
    userUpdateData.name = `${finalFirstName} ${finalLastName}`.trim() || user.email.split("@")[0]
  }

  // Update user table if there are changes
  if (Object.keys(userUpdateData).length > 0) {
    await updateUserFields(userId, userUpdateData)
  }

  // Prepare profile table update
  const profileUpdateData = {}
  if (address !== undefined) profileUpdateData.address = address
  if (city !== undefined) profileUpdateData.city = city
  if (state !== undefined) profileUpdateData.state = state
  if (country !== undefined) profileUpdateData.country = country
  if (pincode !== undefined) profileUpdateData.pincode = pincode
  if (emergencyContact !== undefined) profileUpdateData.emergencyContact = emergencyContact

  // Upsert profile table if there are changes (and set denormalized companyId/branchId from user if creating)
  if (Object.keys(profileUpdateData).length > 0) {
    // Add denormalized fields for tenant isolation if creating
    profileUpdateData.companyId = user.companyId
    profileUpdateData.branchId = user.branchId
    
    await upsertUserProfileFields(userId, profileUpdateData)
  }

  // Return the updated full profile
  return getUserProfileService(userId)
}

/**
 * Service to change the logged-in user's password
 */
import bcrypt from "bcryptjs"

export const changePasswordService = async (userId, currentPassword, newPassword) => {
  const user = await findUserProfileByUserId(userId)
  if (!user) {
    throw new NotFoundError("User not found")
  }

  // Verify current password
  const isValid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!isValid) {
    throw new BadRequestError("Current password is incorrect")
  }

  // Hash new password
  const salt = await bcrypt.genSalt(10)
  const passwordHash = await bcrypt.hash(newPassword, salt)

  // Update password in DB
  await updateUserFields(userId, { passwordHash })
}

export const getUserSessionsService = async (userId) => {
  // Lazily clean up expired sessions for this user
  await prisma.refreshToken.deleteMany({
    where: {
      userId,
      expiresAt: { lt: new Date() }
    }
  })

  return prisma.refreshToken.findMany({
    where: { userId },
    select: {
      id: true,
      browser: true,
      os: true,
      deviceName: true,
      ipAddress: true,
      lastActive: true,
      createdAt: true,
      token: true
    },
    orderBy: {
      createdAt: "desc"
    }
  })
}

export const revokeUserSessionService = async (userId, sessionId) => {
  const session = await prisma.refreshToken.findFirst({
    where: { id: sessionId, userId }
  })
  if (!session) {
    throw new NotFoundError("Session not found or unauthorized")
  }
  await prisma.refreshToken.delete({
    where: { id: sessionId }
  })
  return session
}

export const deactivateUserAccountService = async (userId) => {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { status: "INACTIVE" }
    }),
    prisma.refreshToken.deleteMany({
      where: { userId }
    })
  ])
}

