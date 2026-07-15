// src/modules/course/course.services.js

import {
  checkCourseDuplicate,
  createCourse,
  updateCourse,
  softDeleteCourse,
  findCourseById,
  findCourses,
  countCourses,
  createAuditLog,
  findUniqueCategories
} from "./course.repository.js";
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError
} from "../../utils/AppError.js";
import prisma from "../../config/db.js";
import { parsePagination, parseSorting, buildSearchFilter } from "../../utils/queryHelpers.js";

/**
 * Asserts that the actor is authorized to interact with the target company's scope.
 * Super Admins bypass this. All other roles are confined to their own companyId.
 */
const assertCompanyScope = (actor, targetCompanyId) => {
  if (actor.primaryRole === "SUPER_ADMIN") return;
  if (Number(actor.companyId) !== Number(targetCompanyId)) {
    throw new ForbiddenError("You cannot access data from another company");
  }
};

/**
 * Service to create a new course.
 *
 * @param {object} data - Course payload
 * @param {object} actor - The user initiating the request
 * @returns {Promise<object>} Created course record
 */
export const createCourseService = async (data, actor) => {
  const companyId = Number(data.companyId);

  // 1. Enforce tenant isolation
  assertCompanyScope(actor, companyId);

  // 2. Fetch the company details to generate code prefix
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true }
  });
  if (!company) {
    throw new NotFoundError("Company");
  }

  // Auto-generate course code: Prefix from company name (first 4 uppercase letters/numbers) + sequential count
  const prefix = company.name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4) || "CRS";
  
  // Query highest current code using this prefix
  const lastCourse = await prisma.course.findFirst({
    where: {
      companyId,
      code: { startsWith: `${prefix}-` },
      isDeleted: false
    },
    orderBy: { code: "desc" },
    select: { code: true }
  });

  let nextNumber = 1001;
  if (lastCourse) {
    const parts = lastCourse.code.split("-");
    const lastNum = parseInt(parts[parts.length - 1]);
    if (!isNaN(lastNum)) {
      nextNumber = lastNum + 1;
    }
  }

  const generatedCode = `${prefix}-${nextNumber}`;
  data.code = generatedCode;

  // 3. Double-check code duplicate (failsafe check)
  const duplicate = await checkCourseDuplicate(generatedCode, companyId);
  if (duplicate) {
    throw new ConflictError(duplicate.message, "code");
  }

  // 4. Create course and register audit log in a transaction to guarantee consistency
  return prisma.$transaction(async (tx) => {
    const course = await createCourse(data, actor.id, tx);

    await createAuditLog({
      companyId: course.companyId,
      entityId: course.id,
      action: "CREATE",
      newValue: JSON.stringify(course),
      performedById: actor.id
    }, tx);

    return course;
  });
};

/**
 * Service to retrieve a paginated and filtered list of courses.
 *
 * @param {object} query - Search and filter parameters from the query string
 * @param {object} actor - The user initiating the request
 * @returns {Promise<object>} Paginated result object
 */
export const getCoursesService = async (query, actor) => {
  const { page, limit, skip } = parsePagination(query);
  const orderBy = parseSorting(query, ["name", "code", "price", "category", "status", "createdAt"]);

  // 1. Establish tenant scope. Non-Super Admins can only query their own company.
  const targetCompanyId = actor.primaryRole === "SUPER_ADMIN"
    ? (query.companyId ? Number(query.companyId) : undefined)
    : actor.companyId;

  // 2. Build where filter conditions
  const where = {
    isDeleted: false,
    ...(targetCompanyId && { companyId: targetCompanyId })
  };

  // Search keyword (matches name or code case-insensitively)
  const searchFilter = buildSearchFilter(query.search, ["name", "code"]);
  if (searchFilter) {
    where.OR = searchFilter.OR;
  }

  // Filter: status (ACTIVE/INACTIVE)
  if (query.status) {
    where.status = query.status;
  }

  // Filter: category
  if (query.category) {
    where.category = query.category;
  }

  // Filter: parent category
  if (query.parentCategory) {
    where.parentCategory = query.parentCategory;
  }

  // Price range filters
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    where.price = {};
    if (query.minPrice !== undefined) {
      where.price.gte = parseFloat(query.minPrice);
    }
    if (query.maxPrice !== undefined) {
      where.price.lte = parseFloat(query.maxPrice);
    }
  }

  // 3. Fetch count and rows
  const [total, courses] = await Promise.all([
    countCourses(where),
    findCourses({
      where,
      skip,
      take: limit,
      orderBy
    })
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    courses,
    pagination: {
      total,
      page,
      limit,
      totalPages
    }
  };
};

/**
 * Service to retrieve a course by ID.
 *
 * @param {number} id - Course ID
 * @param {object} actor - The user initiating the request
 * @returns {Promise<object>} The found course
 */
export const getCourseByIdService = async (id, actor) => {
  const course = await findCourseById(Number(id));
  if (!course || course.isDeleted) {
    throw new NotFoundError("Course");
  }

  // Enforce company isolation
  assertCompanyScope(actor, course.companyId);

  return course;
};

/**
 * Service to update an existing course.
 *
 * @param {number} id - Course ID
 * @param {object} data - Fields to update
 * @param {object} actor - The user initiating the request
 * @returns {Promise<object>} Updated course record
 */
export const updateCourseService = async (id, data, actor) => {
  const courseId = Number(id);

  // 1. Fetch current record
  const currentCourse = await findCourseById(courseId);
  if (!currentCourse || currentCourse.isDeleted) {
    throw new NotFoundError("Course");
  }

  // 2. Validate tenant scope
  assertCompanyScope(actor, currentCourse.companyId);

  // 3. If code is changing, check for unique constraint duplication
  if (data.code && data.code.toUpperCase() !== currentCourse.code) {
    const duplicate = await checkCourseDuplicate(data.code, currentCourse.companyId, courseId);
    if (duplicate) {
      throw new ConflictError(duplicate.message, "code");
    }
  }

  // 4. Update the course record inside a database transaction to log the changes
  return prisma.$transaction(async (tx) => {
    const updated = await updateCourse(courseId, data, actor.id, tx);

    await createAuditLog({
      companyId: currentCourse.companyId,
      entityId: courseId,
      action: "UPDATE",
      oldValue: JSON.stringify(currentCourse),
      newValue: JSON.stringify(updated),
      performedById: actor.id
    }, tx);

    return updated;
  });
};

/**
 * Service to toggle status (ACTIVE/INACTIVE) of a course.
 *
 * @param {number} id - Course ID
 * @param {string} status - New status
 * @param {object} actor - The user initiating the request
 * @returns {Promise<object>} Updated course record
 */
export const toggleCourseStatusService = async (id, status, actor) => {
  const courseId = Number(id);

  const currentCourse = await findCourseById(courseId);
  if (!currentCourse || currentCourse.isDeleted) {
    throw new NotFoundError("Course");
  }

  assertCompanyScope(actor, currentCourse.companyId);

  return prisma.$transaction(async (tx) => {
    const updated = await updateCourse(courseId, { status }, actor.id, tx);

    await createAuditLog({
      companyId: currentCourse.companyId,
      entityId: courseId,
      action: "STATUS_CHANGE",
      oldValue: JSON.stringify({ status: currentCourse.status }),
      newValue: JSON.stringify({ status: updated.status }),
      performedById: actor.id
    }, tx);

    return updated;
  });
};

/**
 * Service to soft delete a course.
 *
 * @param {number} id - Course ID
 * @param {object} actor - The user initiating the request
 * @returns {Promise<object>} Deletion confirmation
 */
export const deleteCourseService = async (id, actor) => {
  const courseId = Number(id);

  const currentCourse = await findCourseById(courseId);
  if (!currentCourse || currentCourse.isDeleted) {
    throw new NotFoundError("Course");
  }

  assertCompanyScope(actor, currentCourse.companyId);

  return prisma.$transaction(async (tx) => {
    const deleted = await softDeleteCourse(courseId, actor.id, tx);

    await createAuditLog({
      companyId: currentCourse.companyId,
      entityId: courseId,
      action: "DELETE",
      oldValue: JSON.stringify(currentCourse),
      newValue: JSON.stringify(deleted),
      performedById: actor.id
    }, tx);

    return { success: true };
  });
};

/**
 * Service to fetch all unique categories from active courses of a company.
 *
 * @param {object} query - Express request query params
 * @param {object} actor - Logged in session user
 * @returns {Promise<Array>} List of category strings
 */
export const getCoursesCategoriesService = async (query, actor) => {
  const companyId = actor.primaryRole === "SUPER_ADMIN"
    ? (query.companyId ? Number(query.companyId) : undefined)
    : actor.companyId;

  if (!companyId) {
    throw new ValidationError("Company ID is required to fetch categories");
  }

  return findUniqueCategories(companyId);
};

