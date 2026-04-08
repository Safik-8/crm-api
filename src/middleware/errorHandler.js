// src/middleware/errorHandler.js

import {
  AppError,
  RouteNotFoundError,
  ConflictError,
  NotFoundError,
  ValidationError,
  ServerError
} from "../utils/AppError.js"

export const notFound = (req, res, next) => {
  next(new RouteNotFoundError(req.originalUrl))
}

export const errorHandler = (err, req, res, next) => {

  // Known operational error
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(err.toJSON())
  }

  // Prisma — unique constraint
  if (err.code === "P2002") {
    const field = err.meta?.target?.[0] || "field"
    const error = new ConflictError(`${field} already exists`, field)
    return res.status(error.statusCode).json(error.toJSON())
  }

  // Prisma — record not found
  if (err.code === "P2025") {
    const error = new NotFoundError(err.meta?.cause || "Record")
    return res.status(error.statusCode).json(error.toJSON())
  }

  // Prisma — foreign key
  if (err.code === "P2003") {
    const error = new ValidationError("Related record not found", [
      { field: err.meta?.field_name, message: "Does not exist" }
    ])
    return res.status(error.statusCode).json(error.toJSON())
  }

  // JWT errors
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false, statusCode: 401,
      code: "TOKEN_EXPIRED", message: "Token expired. Please login again.",
      timestamp: new Date().toISOString()
    })
  }

  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false, statusCode: 401,
      code: "TOKEN_INVALID", message: "Invalid token. Please login again.",
      timestamp: new Date().toISOString()
    })
  }

  // Bad JSON body
  if (err instanceof SyntaxError && err.status === 400) {
    return res.status(400).json({
      success: false, statusCode: 400,
      code: "INVALID_JSON", message: "Invalid JSON in request body",
      timestamp: new Date().toISOString()
    })
  }

  // Unknown
  console.error("Unhandled Error:", err)
  const serverError = new ServerError()
  return res.status(serverError.statusCode).json(serverError.toJSON())
}