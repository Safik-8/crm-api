// src/modules/course/course.controllers.js

import {
  createCourseService,
  getCoursesService,
  getCourseByIdService,
  updateCourseService,
  toggleCourseStatusService,
  deleteCourseService,
  getCoursesCategoriesService
} from "./course.services.js";
import { sendSuccess } from "../../utils/response.js";

/**
 * Controller to create a new Course
 */
export const createCourse = async (req, res, next) => {
  try {
    const course = await createCourseService(req.body, req.user);
    return sendSuccess(res, { course }, "Course created successfully", 201);
  } catch (err) {
    next(err);
  }
};

/**
 * Controller to fetch all Courses with search, filter, and pagination
 */
export const getCourses = async (req, res, next) => {
  try {
    const result = await getCoursesService(req.query, req.user);
    return sendSuccess(res, result, "Courses fetched successfully");
  } catch (err) {
    next(err);
  }
};

/**
 * Controller to fetch a specific Course by ID
 */
export const getCourseById = async (req, res, next) => {
  try {
    const course = await getCourseByIdService(req.params.id, req.user);
    return sendSuccess(res, { course }, "Course details fetched successfully");
  } catch (err) {
    next(err);
  }
};

/**
 * Controller to update Course details
 */
export const updateCourse = async (req, res, next) => {
  try {
    const course = await updateCourseService(req.params.id, req.body, req.user);
    return sendSuccess(res, { course }, "Course updated successfully");
  } catch (err) {
    next(err);
  }
};

/**
 * Controller to toggle a Course's active/inactive status
 */
export const toggleCourseStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const course = await toggleCourseStatusService(req.params.id, status, req.user);
    return sendSuccess(res, { course }, `Course status set to ${status} successfully`);
  } catch (err) {
    next(err);
  }
};

/**
 * Controller to soft delete a Course
 */
export const deleteCourse = async (req, res, next) => {
  try {
    await deleteCourseService(req.params.id, req.user);
    return sendSuccess(res, null, "Course deleted successfully");
  } catch (err) {
    next(err);
  }
};

/**
 * Controller to fetch all unique course categories
 */
export const getCoursesCategories = async (req, res, next) => {
  try {
    const categories = await getCoursesCategoriesService(req.query, req.user);
    return sendSuccess(res, { categories }, "Course categories fetched successfully");
  } catch (err) {
    next(err);
  }
};

