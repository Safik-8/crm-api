// src/modules/course/course.routes.js

import { Router } from "express";
import {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  toggleCourseStatus,
  deleteCourse,
  getCoursesCategories
} from "./course.controllers.js";
import {
  createCourseSchema,
  updateCourseSchema,
  toggleCourseStatusSchema,
  validateBody
} from "./course.validation.js";
import { authenticate } from "../../middleware/Authenticate.js";
import { hasPermission } from "../../middleware/hasPermission.js";

const router = Router();

// Secure all endpoints with authentication middleware
router.use(authenticate);

// POST /api/courses - Create a new course catalog record
router.post(
  "/",
  hasPermission("COURSE", "canCreate"),
  validateBody(createCourseSchema),
  createCourse
);

// GET /api/courses - List, filter, search, and paginate courses
router.get(
  "/",
  hasPermission("COURSE", "canView"),
  getCourses
);

// GET /api/courses/categories - Fetch list of distinct course categories in company
router.get(
  "/categories",
  hasPermission("COURSE", "canView"),
  getCoursesCategories
);

// GET /api/courses/:id - Fetch complete details of a single course
router.get(
  "/:id",
  hasPermission("COURSE", "canView"),
  getCourseById
);

// PUT /api/courses/:id - Update editable fields of a course
router.put(
  "/:id",
  hasPermission("COURSE", "canEdit"),
  validateBody(updateCourseSchema),
  updateCourse
);

// PATCH /api/courses/:id/status - Toggle active/inactive status of a course
router.patch(
  "/:id/status",
  hasPermission("COURSE", "canEdit"),
  validateBody(toggleCourseStatusSchema),
  toggleCourseStatus
);

// DELETE /api/courses/:id - Soft-delete a course
router.delete(
  "/:id",
  hasPermission("COURSE", "canDelete"),
  deleteCourse
);

export default router;
