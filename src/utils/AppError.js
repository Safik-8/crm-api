// src/utils/AppError.js

// ══════════════════════════════════════════
// BASE ERROR CLASS
// ══════════════════════════════════════════
export class AppError extends Error {
  constructor(message, statusCode, code, details = null) {
    super(message)
    this.name          = this.constructor.name
    this.statusCode    = statusCode
    this.code          = code
    this.details       = details
    this.isOperational = true
    this.timestamp     = new Date().toISOString()
    Error.captureStackTrace(this, this.constructor)
  }

  toJSON() {
    return {
      success  : false,
      statusCode: this.statusCode,
      code     : this.code,
      message  : this.message,
      details  : this.details,
      timestamp: this.timestamp
    }
  }
}

// ══════════════════════════════════════════
// 400 — VALIDATION ERROR
// ══════════════════════════════════════════
export class ValidationError extends AppError {
  constructor(message = "Validation failed", fields = []) {
    super(message, 400, "VALIDATION_ERROR", fields)
  }

  // Usage:
  // throw new ValidationError("Invalid input", [
  //   { field: "email",    message: "Email is required" },
  //   { field: "password", message: "Min 6 characters"  }
  // ])
}

// ══════════════════════════════════════════
// 400 — BAD REQUEST
// ══════════════════════════════════════════
export class BadRequestError extends AppError {
  constructor(message = "Bad request") {
    super(message, 400, "BAD_REQUEST")
  }
}

// ══════════════════════════════════════════
// 401 — AUTHENTICATION ERRORS
// ══════════════════════════════════════════
export class UnauthorizedError extends AppError {
  constructor(message = "Not authenticated") {
    super(message, 401, "UNAUTHORIZED")
  }
}

export class TokenExpiredError extends AppError {
  constructor() {
    super("Token has expired. Please login again.", 401, "TOKEN_EXPIRED")
  }
}

export class TokenInvalidError extends AppError {
  constructor() {
    super("Invalid token. Please login again.", 401, "TOKEN_INVALID")
  }
}

// ══════════════════════════════════════════
// 403 — AUTHORIZATION ERRORS
// ══════════════════════════════════════════
export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(message, 403, "FORBIDDEN")
  }
}

export class AccountInactiveError extends AppError {
  constructor() {
    super("Your account has been deactivated. Contact admin.", 403, "ACCOUNT_INACTIVE")
  }
}

export class NoRoleError extends AppError {
  constructor() {
    super("No role assigned to this account. Contact admin.", 403, "NO_ROLE_ASSIGNED")
  }
}

export class PermissionDeniedError extends AppError {
  constructor(module, action) {    
    super(
      `You don't have permission to ${action} ${module}`,
      403,
      "PERMISSION_DENIED",
      { required: `${module}:${action}` }
    )
  }
}

export class RoleNotAllowedError extends AppError {
  constructor(requiredRoles) {
    super(
      `Access denied. Required role: ${requiredRoles.join(" or ")}`,
      403,
      "ROLE_NOT_ALLOWED",
      { required: requiredRoles }
    )
  }
}

// ══════════════════════════════════════════
// 404 — NOT FOUND
// ══════════════════════════════════════════
export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404, "NOT_FOUND")
  }
}

export class RouteNotFoundError extends AppError {
  constructor(url) {
    super(`Route ${url} not found`, 404, "ROUTE_NOT_FOUND")
  }
}

// ══════════════════════════════════════════
// 409 — CONFLICT
// ══════════════════════════════════════════
export class ConflictError extends AppError {
  constructor(message = "Resource already exists", field = null) {
    super(message, 409, "CONFLICT", field ? { field } : null)
  }
}

export class DuplicateEmailError extends AppError {
  constructor() {
    super("Email already registered", 409, "DUPLICATE_EMAIL", { field: "email" })
  }
}

export class AlreadySetupError extends AppError {
  constructor() {
    super("System is already setup", 409, "ALREADY_SETUP")
  }
}

// ══════════════════════════════════════════
// 422 — UNPROCESSABLE
// ══════════════════════════════════════════
export class UnprocessableError extends AppError {
  constructor(message = "Cannot process this request") {
    super(message, 422, "UNPROCESSABLE")
  }
}

// ══════════════════════════════════════════
// 500 — SERVER ERRORS
// ══════════════════════════════════════════
export class ServerError extends AppError {
  constructor(message = "Internal server error") {
    super(message, 500, "SERVER_ERROR")
  }
}

export class DatabaseError extends AppError {
  constructor(message = "Database error") {
    super(message, 500, "DATABASE_ERROR")
  }
}