// src/modules/course/course.repository.js

import prisma from "../../config/db.js";

/**
 * Checks if a course already exists with the given code inside the same company.
 * Ignores soft-deleted courses.
 *
 * @param {string} code - The code of the course (unique per tenant/company)
 * @param {number} companyId - The ID of the company
 * @param {number|null} excludeCourseId - An optional ID to exclude (used on edit validation)
 * @param {object} tx - Prisma Client or Transaction Client
 * @returns {Promise<object|null>} Duplicate issue object or null
 */
export const checkCourseDuplicate = async (code, companyId, excludeCourseId = null, tx = prisma) => {
  const existing = await tx.course.findFirst({
    where: {
      code: code.trim().toUpperCase(),
      companyId,
      isDeleted: false,
      ...(excludeCourseId && { NOT: { id: excludeCourseId } })
    },
    select: {
      id: true,
      code: true,
      name: true
    }
  });

  if (!existing) return null;

  return {
    field: "code",
    message: `Course code '${existing.code}' is already registered for course '${existing.name}'`
  };
};

/**
 * Creates a new Course record in the database.
 *
 * @param {object} data - Course creation data
 * @param {number} actorId - ID of user creating the course
 * @param {object} tx - Prisma client instance
 * @returns {Promise<object>} Created course record
 */
export const createCourse = async (data, actorId, tx = prisma) => {
  const { name, code, description, category, parentCategory, price, duration, status, companyId } = data;

  return tx.course.create({
    data: {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description?.trim() || null,
      category: category.trim(),
      parentCategory: parentCategory?.trim() || null,
      price,
      duration: duration?.trim() || null,
      status,
      companyId,
      createdById: actorId
    }
  });
};

/**
 * Updates an existing Course record.
 *
 * @param {number} id - Course ID
 * @param {object} data - Fields to update
 * @param {number} actorId - ID of user performing the update
 * @param {object} tx - Prisma client instance
 * @returns {Promise<object>} Updated course record
 */
export const updateCourse = async (id, data, actorId, tx = prisma) => {
  const updateData = {
    ...(data.name !== undefined && { name: data.name.trim() }),
    ...(data.code !== undefined && { code: data.code.trim().toUpperCase() }),
    ...(data.description !== undefined && { description: data.description?.trim() || null }),
    ...(data.category !== undefined && { category: data.category.trim() }),
    ...(data.parentCategory !== undefined && { parentCategory: data.parentCategory?.trim() || null }),
    ...(data.price !== undefined && { price: data.price }),
    ...(data.duration !== undefined && { duration: data.duration?.trim() || null }),
    ...(data.status !== undefined && { status: data.status }),
    updatedById: actorId
  };

  return tx.course.update({
    where: { id },
    data: updateData
  });
};

/**
 * Soft deletes a Course by setting isDeleted: true.
 *
 * @param {number} id - Course ID
 * @param {number} actorId - User ID of the performer
 * @param {object} tx - Prisma client instance
 * @returns {Promise<object>} Updated course record
 */
export const softDeleteCourse = async (id, actorId, tx = prisma) => {
  return tx.course.update({
    where: { id },
    data: {
      isDeleted: true,
      updatedById: actorId
    }
  });
};

/**
 * Finds a course by ID, including relations.
 *
 * @param {number} id - Course ID
 * @param {object} tx - Prisma client instance
 * @returns {Promise<object|null>} Course object or null
 */
export const findCourseById = async (id, tx = prisma) => {
  return tx.course.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      updatedBy: { select: { id: true, name: true, email: true } }
    }
  });
};

/**
 * Fetches courses based on dynamic queries, search, pagination, and sorting.
 *
 * @param {object} params - Dynamic query parameters
 * @param {object} tx - Prisma client instance
 * @returns {Promise<Array>} List of course records
 */
export const findCourses = async (params, tx = prisma) => {
  return tx.course.findMany({
    where: params.where,
    orderBy: params.orderBy || { createdAt: "desc" },
    skip: params.skip,
    take: params.take,
    include: {
      createdBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } }
    }
  });
};

/**
 * Counts total active courses matching conditions.
 *
 * @param {object} where - Prisma where conditions
 * @param {object} tx - Prisma client instance
 * @returns {Promise<number>} Total count
 */
export const countCourses = async (where, tx = prisma) => {
  return tx.course.count({ where });
};

/**
 * Creates a record in the AuditLog table.
 *
 * @param {object} data - Audit log payload
 * @param {object} tx - Prisma client instance
 * @returns {Promise<object>} Created audit log record
 */
export const createAuditLog = async (data, tx = prisma) => {
  return tx.auditLog.create({
    data: {
      companyId: data.companyId,
      entityType: "COURSE",
      entityId: data.entityId,
      action: data.action,
      oldValue: data.oldValue || null,
      newValue: data.newValue || null,
      performedById: data.performedById
    }
  });
};

/**
 * Fetches unique categories from all courses of a company.
 *
 * @param {number} companyId - Company ID
 * @param {object} tx - Prisma client instance
 * @returns {Promise<Array>} List of category strings
 */
export const findUniqueCategories = async (companyId, tx = prisma) => {
  const result = await tx.course.findMany({
    where: {
      companyId,
      isDeleted: false
    },
    select: {
      category: true
    },
    distinct: ["category"]
  });
  return result.map(c => c.category);
};

