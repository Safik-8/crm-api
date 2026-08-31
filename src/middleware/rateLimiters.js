// src/middleware/rateLimiters.js

import { rateLimit } from "express-rate-limit"

/**
 * Strict Rate Limiter for Login Endpoint:
 * Max 5 attempts per 15 minutes per IP.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  statusCode: 429,
  message: {
    success: false,
    statusCode: 429,
    code: "TOO_MANY_REQUESTS",
    message: "Too many login attempts. Please try again after 15 minutes."
  }
})

/**
 * Strict Rate Limiter for Password Reset Endpoints:
 * Max 3 requests per hour per IP.
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 3,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  statusCode: 429,
  message: {
    success: false,
    statusCode: 429,
    code: "TOO_MANY_REQUESTS",
    message: "Too many password reset requests. Please try again after 1 hour."
  }
})

/**
 * Strict Rate Limiter for OTP Verification Endpoints:
 * Max 5 attempts per 15 minutes per IP.
 */
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  statusCode: 429,
  message: {
    success: false,
    statusCode: 429,
    code: "TOO_MANY_REQUESTS",
    message: "Too many OTP verification attempts. Please try again after 15 minutes."
  }
})

/**
 * Strict Rate Limiter for Data Export Endpoints:
 * Max 10 requests per 15 minutes per IP.
 */
export const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  statusCode: 429,
  message: {
    success: false,
    statusCode: 429,
    code: "TOO_MANY_REQUESTS",
    message: "Too many data export requests. Please try again after 15 minutes."
  }
})
