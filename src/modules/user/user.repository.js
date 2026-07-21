// src/modules/user/user.repository.js

import prisma from "../../config/db.js"

/**
 * Checks if a user already exists with the given email, mobile number, or employee ID.
 * Returns the matched properties if any duplicate is found.
 */
export const checkUserDuplicates = async (email, mobileNumber, employeeId, excludeUserId = null, tx = prisma) => {
  const duplicateConditions = [
    { email: email.toLowerCase().trim() }
  ]
  
  if (mobileNumber) {
    duplicateConditions.push({ mobileNumber: mobileNumber.trim() })
  }
  if (employeeId) {
    duplicateConditions.push({ employeeId: employeeId.trim() })
  }

  const existing = await tx.user.findFirst({
    where: {
      OR: duplicateConditions,
      ...(excludeUserId && { NOT: { id: excludeUserId } })
    },
    select: {
      id: true,
      email: true,
      mobileNumber: true,
      employeeId: true
    }
  })

  if (!existing) return null

  if (existing.email.toLowerCase() === email.toLowerCase().trim()) {
    return { field: "email", message: "Email is already registered" }
  }
  if (mobileNumber && existing.mobileNumber === mobileNumber.trim()) {
    return { field: "mobileNumber", message: "Mobile number is already registered" }
  }
  if (employeeId && existing.employeeId === employeeId.trim()) {
    return { field: "employeeId", message: "Employee ID is already registered" }
  }

  return null
}

/**
 * Creates a complete User record using a database transaction.
 * Creates User -> UserRole -> UserProfile -> UserSettings.
 */
export const createUserTransaction = async (data, actorId) => {
  const {
    firstName,
    lastName,
    email,
    passwordHash,
    mobileNumber,
    employeeId,
    joiningDate,
    companyId,
    branchId,
    roleId,
    reportingManagerId,
    address,
    city,
    state,
    country,
    pincode,
    emergencyContact,
    profilePhoto
  } = data

  const fullName = `${firstName} ${lastName}`.trim()

  return prisma.$transaction(async (tx) => {
    // 1. Create User
    const user = await tx.user.create({
      data: {
        name: fullName,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        mobileNumber: mobileNumber?.trim() || null,
        employeeId: employeeId?.trim() || null,
        joiningDate: joiningDate ? new Date(joiningDate) : null,
        companyId,
        branchId,
        reportingManagerId: reportingManagerId || null,
        profilePhoto: profilePhoto?.trim() || null,
        mustChangePassword: true, // Force reset on admin creation
        status: "ACTIVE"
      }
    })

    // 2. Create UserRole mapping (single primary role in Sprint 2)
    await tx.userRole.create({
      data: {
        userId: user.id,
        roleId,
        companyId,
        branchId,
        isPrimary: true,
        assignedBy: actorId
      }
    })

    // 3. Create UserProfile
    await tx.userProfile.create({
      data: {
        userId: user.id,
        companyId,
        branchId,
        address: address?.trim() || null,
        city: city?.trim() || null,
        state: state?.trim() || null,
        country: country?.trim() || null,
        pincode: pincode?.trim() || null,
        emergencyContact: emergencyContact?.trim() || null
      }
    })

    // 4. Create UserSettings
    await tx.userSettings.create({
      data: {
        userId: user.id,
        notificationPreferences: {},
        sessionPreferences: {},
        securitySettings: {}
      }
    })

    return user
  }, {
    timeout: 10000
  })
}

/**
 * Updates a User and UserProfile within a database transaction to preserve consistency.
 */
export const updateUserTransaction = async (userId, data) => {
  const {
    firstName,
    lastName,
    mobileNumber,
    branchId,
    roleId,
    reportingManagerId,
    status,
    address,
    city,
    state,
    country,
    pincode,
    emergencyContact,
    profilePhoto
  } = data

  return prisma.$transaction(async (tx) => {
    // Determine updated full name if names changed
    let nameUpdate = {}
    if (firstName || lastName) {
      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true }
      })
      const finalFirst = firstName !== undefined ? firstName.trim() : current.firstName
      const finalLast = lastName !== undefined ? lastName.trim() : current.lastName
      nameUpdate = {
        name: `${finalFirst} ${finalLast}`.trim(),
        firstName: finalFirst,
        lastName: finalLast
      }
    }

    // 1. Update main User columns
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        ...nameUpdate,
        ...(mobileNumber !== undefined && { mobileNumber: mobileNumber?.trim() || null }),
        ...(branchId !== undefined && { branchId }),
        ...(reportingManagerId !== undefined && { reportingManagerId: reportingManagerId || null }),
        ...(status !== undefined && { status }),
        ...(profilePhoto !== undefined && { profilePhoto: profilePhoto?.trim() || null })
      }
    })

    // 2. Sync branchId and update other details on UserProfile if profiles exist
    const profileData = {
      ...(branchId !== undefined && { branchId }),
      ...(address !== undefined && { address: address?.trim() || null }),
      ...(city !== undefined && { city: city?.trim() || null }),
      ...(state !== undefined && { state: state?.trim() || null }),
      ...(country !== undefined && { country: country?.trim() || null }),
      ...(pincode !== undefined && { pincode: pincode?.trim() || null }),
      ...(emergencyContact !== undefined && { emergencyContact: emergencyContact?.trim() || null })
    }

    if (Object.keys(profileData).length > 0) {
      await tx.userProfile.upsert({
        where: { userId },
        create: {
          userId,
          companyId: user.companyId,
          ...profileData
        },
        update: profileData
      })
    }

    // 3. Sync UserRole mapping if roleId or branchId changed
    if (roleId !== undefined || branchId !== undefined) {
      await tx.userRole.updateMany({
        where: { userId, isPrimary: true },
        data: {
          ...(roleId !== undefined && { roleId: Number(roleId) }),
          ...(branchId !== undefined && { branchId: Number(branchId) })
        }
      })
    }

    return user
  }, {
    timeout: 10000
  })
}

/**
 * Finds a single user by primary ID, including relations.
 */
export const findUserById = async (id, tx = prisma) => {
  return tx.user.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true, code: true } },
      branch: { select: { id: true, name: true, code: true } },
      reportingManager: { select: { id: true, name: true, email: true } },
      profile: true,
      settings: true,
      userRoles: {
        where: { isPrimary: true },
        include: {
          role: { select: { id: true, name: true, rank: true } }
        }
      }
    }
  })
}

/**
 * Finds users matching dynamic search and pagination parameters.
 */
export const findUsers = async (params, tx = prisma) => {
  return tx.user.findMany({
    where: params.where,
    orderBy: params.orderBy || { createdAt: "desc" },
    include: params.include,
    skip: params.skip,
    take: params.take
  })
}

/**
 * Counts total users matching search criteria.
 */
export const countUsers = async (where, tx = prisma) => {
  return tx.user.count({ where })
}

/**
 * Updates raw user password and mustChangePassword status (used during resets).
 */
export const updateUserPassword = async (userId, passwordHash, mustChangePassword = false, tx = prisma) => {
  return tx.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      mustChangePassword
    }
  })
}

/**
 * Writes a record to the AuditLog table.
 */
export const createAuditLog = async (data, tx = prisma) => {
  return tx.auditLog.create({
    data: {
      companyId: data.companyId,
      entityType: data.entityType,
      entityId: data.entityId,
      action: data.action,
      oldValue: data.oldValue || null,
      newValue: data.newValue || null,
      performedById: data.performedById
    }
  })
}

/**
 * Fetches roles an actor is allowed to assign to a new user.
 * Filters by: active status, rank strictly below actor's rank,
 * and company scope (global system roles + actor's own company roles).
 */
export const findAssignableRoles = async (actorRank, companyId) => {
  return prisma.role.findMany({
    where: {
      status: "ACTIVE",
      rank: { lt: actorRank },
      OR: [
        { companyId: companyId ?? null },
        { companyId: null }
      ]
    },
    orderBy: { rank: "desc" },
    select: { id: true, name: true, rank: true, isSystem: true, status: true }
  })
}

/**
 * Finds users eligible to receive leads and direct reports from a target user being deleted.
 * Criteria:
 * 1. Must belong to the same company as the target user.
 * 2. Must belong to the same branch as the target user (if branchId exists).
 * 3. Role rank must be equal to or higher than the target user's role rank.
 * 4. Cannot be the target user itself.
 * 5. Must be ACTIVE status.
 */
export const findEligibleReplacements = async (targetUser) => {
  const targetUserRank = targetUser.userRoles?.find(ur => ur.isPrimary)?.role?.rank ?? 0
  const targetCompanyId = targetUser.companyId
  const targetBranchId = targetUser.branchId

  const candidates = await prisma.user.findMany({
    where: {
      id: { not: targetUser.id },
      companyId: targetCompanyId,
      status: "ACTIVE",
      OR: [
        ...(targetBranchId ? [{ branchId: targetBranchId }] : []),
        { branchId: null },
        { userRoles: { some: { role: { rank: { gte: 80 } } } } }
      ]
    },
    include: {
      userRoles: {
        include: {
          role: true
        }
      },
      branch: {
        select: { id: true, name: true }
      }
    }
  })

  return candidates.filter(candidate => {
    const primaryRole = candidate.userRoles?.find(ur => ur.isPrimary) || candidate.userRoles?.[0]
    const rank = primaryRole?.role?.rank ?? 0
    return rank >= targetUserRank
  }).map(c => {
    const primaryRole = c.userRoles?.find(ur => ur.isPrimary) || c.userRoles?.[0]
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      branchName: c.branch?.name || "Global / Company Wide",
      roleName: primaryRole?.role?.name || "Member",
      rank: primaryRole?.role?.rank ?? 0
    }
  })
}

/**
 * Hard deletes a User and reassigns leads & direct reports atomically in a transaction.
 */
export const deleteUserTransaction = async (targetUserId, replacementUserId, actorId) => {
  return prisma.$transaction(async (tx) => {
    let leadsReassignedCount = 0
    let subordinatesReassignedCount = 0

    // 1. Reassign Leads if replacementUserId is provided
    if (replacementUserId) {
      const leadUpdate = await tx.lead.updateMany({
        where: { assignedToId: replacementUserId ? Number(replacementUserId) : null },
        data: { assignedToId: Number(replacementUserId) }
      })
      // Correct query filter
      const actualLeadUpdate = await tx.lead.updateMany({
        where: { assignedToId: targetUserId },
        data: { assignedToId: Number(replacementUserId) }
      })
      leadsReassignedCount = actualLeadUpdate.count
    }

    // 2. Reassign Direct Reports (Subordinates) if replacementUserId is provided
    if (replacementUserId) {
      const subUpdate = await tx.user.updateMany({
        where: { reportingManagerId: targetUserId },
        data: { reportingManagerId: Number(replacementUserId) }
      })
      subordinatesReassignedCount = subUpdate.count
    } else {
      // Unlink manager if no replacement provided
      await tx.user.updateMany({
        where: { reportingManagerId: targetUserId },
        data: { reportingManagerId: null }
      })
    }

    // 3. Remove team memberships
    await tx.teamMember.deleteMany({
      where: { userId: targetUserId }
    })

    // 4. Remove User relations
    await tx.refreshToken.deleteMany({ where: { userId: targetUserId } })
    await tx.userRole.deleteMany({ where: { userId: targetUserId } })
    await tx.userProfile.deleteMany({ where: { userId: targetUserId } })
    await tx.userSettings.deleteMany({ where: { userId: targetUserId } })

    // 5. Hard delete User record
    const deletedUser = await tx.user.delete({
      where: { id: targetUserId }
    })

    return {
      deletedUser,
      leadsReassignedCount,
      subordinatesReassignedCount
    }
  }, {
    timeout: 15000
  })
}
