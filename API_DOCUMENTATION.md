# StackDot CRM Backend API Documentation

Base URL prefix: `/api`

This documentation reflects the current implementation in:
- `src/modules/auth/*`
- `src/modules/company/*`
- `src/modules/branch/*`
- `src/modules/leadsources/*`
- `src/modules/prospect/*`
- shared responses/errors: `src/utils/response.js`, `src/utils/AppError.js`, `src/middleware/errorHandler.js`

---

## Table of Contents

- [Response Formats](#response-formats)
  - [Success response](#success-response)
  - [Error response](#error-response)
  - [Common error codes](#common-error-codes)
- [1) Authentication](#1-authentication)
  - [POST `/api/auth/login`](#post-apiauthlogin)
  - [POST `/api/auth/refresh`](#post-apiauthrefresh)
  - [POST `/api/auth/logout`](#post-apiauthlogout)
  - [GET `/api/auth/me`](#get-apiauthme)
- [2) Company](#2-company)
  - [POST `/api/companies`](#post-apicompanies)
  - [GET `/api/companies`](#get-apicompanies)
  - [GET `/api/companies/paginated`](#get-apicompaniespaginated)
  - [GET `/api/companies/:id`](#get-apicompaniesid)
  - [PUT `/api/companies/:id`](#put-apicompaniesid)
- [3) Branch](#3-branch)
  - [POST `/api/branches`](#post-apibranches)
  - [GET `/api/branches`](#get-apibranches)
  - [GET `/api/branches/paginated`](#get-apibranchespaginated)
  - [GET `/api/branches/:id`](#get-apibranchesid)
  - [PUT `/api/branches/:id`](#put-apibranchesid)
  - [POST `/api/branches/:id/assign-user`](#post-apibranchesidassign-user)
- [4) Lead Sources](#4-lead-sources)
  - [GET `/api/lead-sources`](#get-apilead-sources)
  - [GET `/api/lead-sources/:id`](#get-apilead-sourcesid)
  - [POST `/api/lead-sources`](#post-apilead-sources)
  - [PUT `/api/lead-sources/:id`](#put-apilead-sourcesid)
- [5) Prospects](#5-prospects)
  - [GET `/api/prospects/lead-sources`](#get-apiprospectslead-sources)
  - [POST `/api/prospects`](#post-apiprospects)
  - [GET `/api/prospects/all`](#get-apiprospectsall)
  - [GET `/api/prospects/:id`](#get-apiprospectsid)
  - [PUT `/api/prospects/:id`](#put-apiprospectsid)
  - [POST `/api/prospects/:id/stage`](#post-apiprospectsidstage)

---

## Response Formats

### Success response

All controllers use `sendSuccess(res, data, message, statusCode)`:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": {},
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

### Error response

Operational errors are thrown as `AppError` (or subclasses) and returned as JSON with `success: false`. Every operational error includes `statusCode`, `code`, `message`, and `timestamp`. The `details` field is present on `AppError` responses and is **`null`** when there are no structured details; **`details` may be omitted** on a few middleware paths (e.g. JWT parse failures).

**Validation (`400`, `VALIDATION_ERROR`)** — `details` is an array of `{ "field", "message" }` (one object per failed rule; multiple fields can appear in one response):

```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    { "field": "name", "message": "Name is required" },
    { "field": "mobile", "message": "Mobile is required" },
    { "field": "leadSourceId", "message": "Lead source is required" }
  ],
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

**Not found (`404`, `NOT_FOUND`)** — message text is human-readable; there is no `details` object for the standard `NotFoundError`:

```json
{
  "success": false,
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Lead source not found",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

For prospects, a missing/inactive/out-of-scope lead source is still returned this way: the server does not distinguish “wrong id” vs “inactive” vs “other company’s source” in the payload (all resolve to **404** with the same shape).

**Conflict (`409`, `CONFLICT`)** — often includes `details.field` (e.g. duplicate mobile on create prospect):

```json
{
  "success": false,
  "statusCode": 409,
  "code": "CONFLICT",
  "message": "Mobile already exists for prospect Jane Doe (PR-2026-00042)",
  "details": { "field": "mobile" },
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

Retry the same request with `"duplicate_acknowledged": true` in the body to allow creation when the duplicate is intentional.

**Forbidden (`403`, `FORBIDDEN`)** — generic access or business rule (e.g. assignee not in your company):

```json
{
  "success": false,
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "Assigned user does not belong to your company",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

**Permission / role (`403`)**

```json
{
  "success": false,
  "statusCode": 403,
  "code": "PERMISSION_DENIED",
  "message": "You don't have permission to canCreate PROSPECT",
  "details": { "required": "PROSPECT:canCreate" },
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 403,
  "code": "ROLE_NOT_ALLOWED",
  "message": "Access denied. Required role: SUPER_ADMIN or BRANCH_ADMIN",
  "details": { "required": ["SUPER_ADMIN", "BRANCH_ADMIN"] },
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

**Unauthorized (`401`)** — `UnauthorizedError` includes `details: null`. JWT middleware responses may omit `details`:

```json
{
  "success": false,
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "Invalid email or password",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 401,
  "code": "TOKEN_EXPIRED",
  "message": "Token expired. Please login again.",
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

**Bad request (`400`, `BAD_REQUEST`)** — no structured `details` by default:

```json
{
  "success": false,
  "statusCode": 400,
  "code": "BAD_REQUEST",
  "message": "Invalid stage. Must be one of: NEW, ENGAGED, ...",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

### Common error codes (quick reference)

- **400 VALIDATION_ERROR**: `details` = array of `{ field, message }`
- **400 BAD_REQUEST** / **INVALID_JSON** (malformed JSON body)
- **401 UNAUTHORIZED** / **TOKEN_EXPIRED** / **TOKEN_INVALID**
- **403 FORBIDDEN** / **ACCOUNT_INACTIVE** / **NO_ROLE_ASSIGNED**
- **403 PERMISSION_DENIED**: `details = { required: "<MODULE>:<ACTION>" }`
- **403 ROLE_NOT_ALLOWED**: `details = { required: ["ROLE1", "ROLE2"] }`
- **404 NOT_FOUND** / **ROUTE_NOT_FOUND**
- **409 CONFLICT**: often `details = { field: "<field>" }` (may be `null` if not set)
- **500 SERVER_ERROR**

---

## 1) Authentication

Routes: `src/modules/auth/auth.routes.js`

### POST `/api/auth/login`

Authenticate user and return tokens (also sets httpOnly cookies `accessToken` and `refreshToken`).

**Request body**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Success (200)**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "name": "User",
      "email": "user@example.com",
      "companyId": 1,
      "branchId": 2,
      "primaryRole": "BRANCH_ADMIN",
      "roles": [],
      "permissions": {}
    },
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  },
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

**Possible errors**
- **400 VALIDATION_ERROR** (missing email/password)
- **401 UNAUTHORIZED** (invalid email/password)
- **403 ACCOUNT_INACTIVE**
- **403 NO_ROLE_ASSIGNED**

**Error response examples**

Missing email or password (`400`):

```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    { "field": "email", "message": "Email is required" },
    { "field": "password", "message": "Password is required" }
  ],
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

Invalid credentials (`401`):

```json
{
  "success": false,
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "Invalid email or password",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

Inactive account (`403`, `ACCOUNT_INACTIVE`):

```json
{
  "success": false,
  "statusCode": 403,
  "code": "ACCOUNT_INACTIVE",
  "message": "Your account has been deactivated. Contact admin.",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

No role (`403`, `NO_ROLE_ASSIGNED`):

```json
{
  "success": false,
  "statusCode": 403,
  "code": "NO_ROLE_ASSIGNED",
  "message": "No role assigned to this account. Contact admin.",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

---

### POST `/api/auth/refresh`

Rotate refresh token and issue a new access token cookie.

**Request body**
- `refreshToken` can be sent in body or cookie `refreshToken`.

```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Success (200)**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Token refreshed",
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "primaryRole": "BRANCH_ADMIN"
    }
  },
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

**Possible errors**
- **400 VALIDATION_ERROR** (`refreshToken` missing)
- **401 UNAUTHORIZED** (refresh token invalid/expired/not found)

**Error response examples**

Missing refresh token (`400`):

```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    { "field": "refreshToken", "message": "Refresh token is required" }
  ],
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

Invalid, expired, or unknown refresh token (`401`):

```json
{
  "success": false,
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "Invalid or expired refresh token",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "Refresh token not found",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

---

### POST `/api/auth/logout`

Clears token cookies. If cookie refresh token exists, it’s removed from DB as well.

**Request**: no body required

**Success (200)**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Logged out successfully",
  "data": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

---

### GET `/api/auth/me`

Get current authenticated user (uses auth middleware).

**Auth**: required (`Authorization: Bearer <token>` or cookie token)

**Success (200)**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "User fetched",
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "primaryRole": "BRANCH_ADMIN",
      "permissions": {}
    }
  },
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

**Possible errors**
- **401 UNAUTHORIZED** / **TOKEN_EXPIRED** / **TOKEN_INVALID**
- **403 ACCOUNT_INACTIVE**
- **403 NO_ROLE_ASSIGNED**

**Error response examples**

Missing/invalid/expired bearer token (`401`, shapes vary slightly):

```json
{
  "success": false,
  "statusCode": 401,
  "code": "TOKEN_EXPIRED",
  "message": "Token expired. Please login again.",
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 401,
  "code": "TOKEN_INVALID",
  "message": "Invalid token. Please login again.",
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

(See login section for `ACCOUNT_INACTIVE` and `NO_ROLE_ASSIGNED` JSON.)

---

## 2) Company

Routes: `src/modules/company/comany.routes.js`

All endpoints here require:
- **Auth**: required
- **Role**: `SUPER_ADMIN` (`authorize("SUPER_ADMIN")`)
- **Permission module**: `COMPANY` (`hasPermission(...)`)

### POST `/api/companies`

Create a company.

**Request body**

```json
{
  "name": "StackDot",
  "code": "STD",
  "status": "ACTIVE"
}
```

**Success (201)**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Company created successfully",
  "data": { "company": { "id": 1, "name": "StackDot", "code": "STD", "status": "ACTIVE" } },
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

**Possible errors**
- **400 VALIDATION_ERROR** (missing `name`/`code`)
- **409 CONFLICT** (`code` already exists)
- **403 ROLE_NOT_ALLOWED** / **403 PERMISSION_DENIED**

**Error response examples**

```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    { "field": "name", "message": "Company name is required" },
    { "field": "code", "message": "Company code is required" }
  ],
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 409,
  "code": "CONFLICT",
  "message": "Company code already exists",
  "details": { "field": "code" },
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 403,
  "code": "PERMISSION_DENIED",
  "message": "You don't have permission to canCreate COMPANY",
  "details": { "required": "COMPANY:canCreate" },
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

Wrong role for this route (`403`, `ROLE_NOT_ALLOWED`):

```json
{
  "success": false,
  "statusCode": 403,
  "code": "ROLE_NOT_ALLOWED",
  "message": "Access denied. Required role: SUPER_ADMIN",
  "details": { "required": ["SUPER_ADMIN"] },
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

---

### GET `/api/companies`

Get all companies.

**Success (200)**: controller returns an array in `data`.

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Companies fetched",
  "data": [
    {
      "id": 1,
      "name": "StackDot",
      "code": "STD",
      "_count": { "branches": 0, "users": 0 }
    }
  ],
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

**Possible errors** (all list/detail company routes)

- **401** / **TOKEN_**\* (not logged in or bad token) — see [GET `/api/auth/me`](#get-apiauthme)
- **403 PERMISSION_DENIED** / **403 ROLE_NOT_ALLOWED** — missing `COMPANY` permission or wrong role

**Error response example** (`403`, missing module permission)

```json
{
  "success": false,
  "statusCode": 403,
  "code": "PERMISSION_DENIED",
  "message": "You don't have permission to canView COMPANY",
  "details": { "required": "COMPANY:canView" },
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

---

### GET `/api/companies/paginated`

Paginated companies list (for tables).

**Query params**
- `page` (default 1)
- `limit` (default 10)
- `search` (name/code)
- `status`
- `sort` = `newest` (default) | `oldest` | `name_asc` | `name_desc`

**Success (200)**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Companies fetched",
  "data": {
    "companies": [],
    "pagination": { "total": 0, "page": 1, "limit": 10, "pages": 0, "hasNext": false, "hasPrev": false }
  },
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

**Possible errors**

- Same auth/permission cases as **GET `/api/companies`**

---

### GET `/api/companies/:id`

Get a company by id (includes branches + counts).

**Success (200)**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Company fetched",
  "data": { "company": { "id": 1, "name": "StackDot", "branches": [], "_count": { "branches": 0, "users": 0 } } },
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

**Possible errors**
- **404 NOT_FOUND** (company not found)
- **401** / **TOKEN_**\* / **403 PERMISSION_DENIED** / **403 ROLE_NOT_ALLOWED** — same as **GET `/api/companies`**

**Error response example**

```json
{
  "success": false,
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Company not found",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

---

### PUT `/api/companies/:id`

Update company fields.

**Request body** (any)

```json
{
  "name": "StackDot CRM",
  "status": "ACTIVE"
}
```

**Success (200)**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Company updated successfully",
  "data": { "company": { "id": 1, "name": "StackDot CRM", "status": "ACTIVE" } },
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

**Possible errors**
- **404 NOT_FOUND**
- **401** / **TOKEN_**\* / **403 PERMISSION_DENIED** / **403 ROLE_NOT_ALLOWED** — same as **GET `/api/companies`**

**Error response example**

```json
{
  "success": false,
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Company not found",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

---

## 3) Branch

Routes: `src/modules/branch/branch.routes.js`

All endpoints here require:
- **Auth**: required
- **Permission module**: `BRANCH` (`hasPermission(...)`)
- Some endpoints also require **roles**: `SUPER_ADMIN` or `BRANCH_ADMIN`

### POST `/api/branches`

Create branch.

**Role**: `SUPER_ADMIN` or `BRANCH_ADMIN`  
**Permission**: `BRANCH:canCreate`

**Request body**

```json
{
  "companyId": 1,
  "name": "Main Branch",
  "code": "MAIN",
  "status": "ACTIVE"
}
```

**Success (201)**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Branch created successfully",
  "data": { "branch": { "id": 2, "name": "Main Branch", "code": "MAIN", "companyId": 1 } },
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

**Possible errors**
- **400 VALIDATION_ERROR** (missing companyId/name/code)
- **404 NOT_FOUND** (company not found)
- **409 CONFLICT** (branch code exists in company)
- **403 FORBIDDEN** (trying to create in another company / access denied)
- **403 ROLE_NOT_ALLOWED** / **403 PERMISSION_DENIED**

**Error response examples**

```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    { "field": "companyId", "message": "Company is required" },
    { "field": "name", "message": "Branch name is required" },
    { "field": "code", "message": "Branch code is required" }
  ],
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

Company exists but is not active (`400` — message-only validation; `details` may be an empty array):

```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Company is inactive",
  "details": [],
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Company not found",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 409,
  "code": "CONFLICT",
  "message": "Branch code already exists in this company",
  "details": { "field": "code" },
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "You cannot access data from another company",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

---

### GET `/api/branches`

Get branches by company.

**Permission**: `BRANCH:canView`

**Query params**
- `company_id` (required for SUPER_ADMIN; ignored/scoped for non-super-admin)

**Success (200)**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Branches fetched",
  "data": { "branches": [], "total": 0 },
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

**Possible errors**
- **400 VALIDATION_ERROR** (`company_id` required for SUPER_ADMIN)
- **404 NOT_FOUND** (company not found)
- **403 FORBIDDEN** (non-super-admin trying other company)

**Error response examples**

```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    { "field": "company_id", "message": "company_id is required" }
  ],
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Company not found",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "Access denied",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

---

### GET `/api/branches/paginated`

Paginated branches list.

**Permission**: `BRANCH:canView`

**Possible errors** (same shapes as `GET /api/branches` for `company_id`, missing company, cross-company access)

**Error response examples**

See **GET `/api/branches`** — this route uses the same company scoping and existence checks.

**Query params**
- `company_id` (required for SUPER_ADMIN; ignored/scoped for non-super-admin)
- `page`, `limit`
- `search` (name/code/city)
- `status`

**Success (200)**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Branches fetched successfully",
  "data": {
    "branches": [],
    "total": 0,
    "page": 1,
    "limit": 10,
    "totalPages": 0,
    "hasNext": false,
    "hasPrev": false
  },
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

---

### GET `/api/branches/:id`

Get branch by id.

**Permission**: `BRANCH:canView`

**Possible errors**
- **404 NOT_FOUND** (branch not found)
- **403 FORBIDDEN** (cross-company)

**Error response examples**

```json
{
  "success": false,
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Branch not found",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "You cannot access data from another company",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

---

### PUT `/api/branches/:id`

Update branch.

**Role**: `SUPER_ADMIN` or `BRANCH_ADMIN`  
**Permission**: `BRANCH:canEdit`

**Request body**

```json
{
  "name": "Main Branch 2",
  "status": "ACTIVE"
}
```

**Possible errors**
- **404 NOT_FOUND**
- **403 FORBIDDEN**
- **403 ROLE_NOT_ALLOWED** / **403 PERMISSION_DENIED**

**Error response examples**

```json
{
  "success": false,
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Branch not found",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "You cannot access data from another company",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

---

### POST `/api/branches/:id/assign-user`

Create a new user and assign them to this branch with a primary role.

**Role**: `SUPER_ADMIN` or `BRANCH_ADMIN`  
**Permission**: `BRANCH:canEdit`

**Request body**

```json
{
  "name": "Agent A",
  "email": "agent@example.com",
  "password": "Pass@123",
  "roleName": "ISE"
}
```

**Success (200)**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "User assigned to branch successfully",
  "data": { "user": { "id": 10, "email": "agent@example.com", "status": "ACTIVE" } },
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

**Possible errors**
- **400 VALIDATION_ERROR** (missing name/email/password/roleName)
- **404 NOT_FOUND** (branch not found / role not found)
- **409 CONFLICT** (email already registered)
- **403 FORBIDDEN**
  - cross-company scope
  - role creation guard: e.g. `BRANCH_ADMIN cannot create user with role CEO`
- **400 VALIDATION_ERROR** if role cannot be assigned to a branch (only `BRANCH_ADMIN`, `MANAGER`, `ISE`)

**Error response examples**

```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    { "field": "name", "message": "Name is required" },
    { "field": "email", "message": "Email is required" },
    { "field": "password", "message": "Password is required" },
    { "field": "roleName", "message": "Role is required" }
  ],
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Branch not found",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Role not found",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 409,
  "code": "CONFLICT",
  "message": "Email already registered",
  "details": { "field": "email" },
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "BRANCH_ADMIN cannot create user with role CEO",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Role CEO cannot be assigned to a branch directly",
  "details": [
    { "field": "roleName", "message": "Use BRANCH_ADMIN, MANAGER, or ISE" }
  ],
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

---

## 4) Lead Sources

Routes: `src/modules/leadsources/leadSource.routes.js`

All endpoints require **Auth**.
Some endpoints require `authorize("SUPER_ADMIN", "BRANCH_ADMIN")`.

### GET `/api/lead-sources`

List lead sources.

**Auth**: required

**Query params**
- `search`
- `isActive` (`"true"` / `"false"`)

**Success (200)**: returns an array in `data`.

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Lead sources fetched",
  "data": [
    { "id": 1, "name": "Instagram" }
  ],
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

**Possible errors**

- **401** / **TOKEN_**\* — not authenticated (route only uses `authenticate`; there is no `hasPermission` on this handler)

**Error response example**

See [GET `/api/auth/me`](#get-apiauthme) for `401` / `TOKEN_EXPIRED` / `TOKEN_INVALID` shapes.

---

### GET `/api/lead-sources/:id`

Get one lead source.

**Success (200)**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Lead source fetched",
  "data": { "leadSource": { "id": 1, "name": "Instagram", "type": "GLOBAL" } },
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

**Possible errors**
- **404 NOT_FOUND** (unknown id)
- **403 FORBIDDEN** — e.g. non–super-admin cannot read another company’s scoped lead source (`You cannot access lead sources from another company`)
- **401** / **TOKEN_**\* — not authenticated

**Error response examples**

```json
{
  "success": false,
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Lead source not found",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "You cannot access lead sources from another company",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

---

### POST `/api/lead-sources`

Create lead source.

**Role**: `SUPER_ADMIN` or `BRANCH_ADMIN`

**Request body**

```json
{
  "name": "WhatsApp",
  "isGlobal": false
}
```

**Possible errors**
- **400 VALIDATION_ERROR** (name missing/empty)
- **403 ROLE_NOT_ALLOWED**
- **403 FORBIDDEN** (non-super-admin trying `isGlobal: true`)
- **409 CONFLICT** (duplicate name in same scope)

**Error response examples**

```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    { "field": "name", "message": "Lead source name is required" }
  ],
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "Only Super Admin can create global lead sources",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 409,
  "code": "CONFLICT",
  "message": "Lead source \"WhatsApp\" already exists",
  "details": { "field": "name" },
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 403,
  "code": "ROLE_NOT_ALLOWED",
  "message": "Access denied. Required role: SUPER_ADMIN or BRANCH_ADMIN",
  "details": { "required": ["SUPER_ADMIN", "BRANCH_ADMIN"] },
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

---

### PUT `/api/lead-sources/:id`

Update lead source.

**Role**: `SUPER_ADMIN` or `BRANCH_ADMIN`

**Request body**

```json
{
  "name": "Facebook Ads",
  "isActive": true
}
```

**Possible errors**
- **404 NOT_FOUND**
- **403 FORBIDDEN** (global lead sources modifiable only by SUPER_ADMIN; cross-company blocked)
- **409 CONFLICT**

**Error response examples**

```json
{
  "success": false,
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Lead source not found",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "Only Super Admin can modify global lead sources",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "You cannot access lead sources from another company",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 409,
  "code": "CONFLICT",
  "message": "Lead source \"Facebook Ads\" already exists",
  "details": { "field": "name" },
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

---

## 5) Prospects

Routes: `src/modules/prospect/prospect.routes.js`

All endpoints require:
- **Auth**
- **Module permission**: `PROSPECT` via `hasPermission("PROSPECT", ...)`

### GET `/api/prospects/lead-sources`

Fetch **active** lead sources for a prospect dropdown (global + actor’s `companyId`). Same filtering idea as **`GET /api/lead-sources`**, but requires **`PROSPECT:canView`**.

**Permission**: `PROSPECT:canView`

**Request**: no body.

**Success (200)**: `data` is `{ "leadSources": [ … ] }` (array of lead source records from the prospect helper service).

---

### POST `/api/prospects`

Create a prospect.

**Permission**: `PROSPECT:canCreate`

**Request body**

```json
{
  "name": "John Doe",
  "mobile": "9999999999",
  "leadSourceId": 3,
  "assignedToId": 22,
  "duplicate_acknowledged": false
}
```

**Tenant vs super admin (where the prospect is created)**

- Users with a **company** on their account: `companyId` and `branchId` on the new prospect are always taken from the **authenticated user** (`req.user`). Values sent in the body for `companyId` / `branchId` are **ignored** (prevents spoofing another company).
- **Super admin** (and any account with **`companyId: null`** on the user): must send **`companyId`** and **`branchId`** in the body so the server knows which company/branch owns the prospect. `branchId` must belong to that `companyId`.
- **Company-level user without a branch** (`companyId` set, **`branchId: null`** on the user): must send **`branchId`** in the body; it must belong to their company.

Example for **super admin**:

```json
{
  "name": "John Doe",
  "mobile": "9999999999",
  "leadSourceId": 3,
  "companyId": 1,
  "branchId": 2,
  "assignedToId": 22,
  "duplicate_acknowledged": false
}
```

**Key rules / errors**
- **400 VALIDATION_ERROR** — missing `name`, `mobile`, and/or `leadSourceId`; or missing `companyId`/`branchId` for users with no company; or missing `branchId` for company users with no branch; or `branchId` not under the resolved company
- **404 NOT_FOUND** — `leadSourceId` does not exist, is inactive, or is not allowed for your company (global + your company only); response body does not distinguish which case
- **409 CONFLICT** — same `mobile` already exists in your company unless `"duplicate_acknowledged": true`
- **403 FORBIDDEN** — `assignedToId` is set but that user is not in your company

**Error response examples**

Missing required fields (`400`):

```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    { "field": "name", "message": "Name is required" },
    { "field": "mobile", "message": "Mobile is required" },
    { "field": "leadSourceId", "message": "Lead source is required" }
  ],
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

Lead source not usable (`404` — wrong id, inactive, or other company’s source all look the same):

```json
{
  "success": false,
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Lead source not found",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

Duplicate mobile without acknowledgement (`409`):

```json
{
  "success": false,
  "statusCode": 409,
  "code": "CONFLICT",
  "message": "Mobile already exists for prospect Jane Doe (PR-2026-00042)",
  "details": { "field": "mobile" },
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

Assignee not in company (`403`):

```json
{
  "success": false,
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "Assigned user does not belong to your company",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

Other responses on this route: **401** / **TOKEN_**\*; **403 PERMISSION_DENIED** with `details.required: "PROSPECT:canCreate"` if the actor lacks create permission.

---

### GET `/api/prospects/all`

List prospects with filters + pagination.

**Permission**: `PROSPECT:canView`

**Query params**
- `page`, `limit`
- `stage`
- `lead_source_id`
- `branch_id`
- `assigned_to`
- `start_date`, `end_date`
- `search` (name/mobile)

**Possible errors**
- **401** / **TOKEN_**\* / **403 PERMISSION_DENIED** (`PROSPECT:canView`)
- **403 FORBIDDEN** — `getScopeWhere` rejects actors with no prospect access (`You do not have access to prospects`)
- **403 FORBIDDEN** — `branch_id` filter: branch user cannot query another branch (`You cannot access prospects from another branch`)
- **403 FORBIDDEN** — company-level user: `branch_id` not in your company (`Branch does not belong to your company`)

**Error response examples**

```json
{
  "success": false,
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "You do not have access to prospects",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "You cannot access prospects from another branch",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "Branch does not belong to your company",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

---

### GET `/api/prospects/:id`

Get prospect by id (includes stage history).

**Permission**: `PROSPECT:canView`

**Possible errors**
- **404 NOT_FOUND** — id not found or outside your visibility scope
- **403 FORBIDDEN** — `You cannot access data from another company` (company isolation)
- **403 FORBIDDEN** — ISE-style scope: `You can only edit your own prospects` (when update permission is create-only)
- Same **401** / **PERMISSION_DENIED** as other prospect routes

**Error response examples**

```json
{
  "success": false,
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Prospect not found",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "You cannot access data from another company",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

---

### PUT `/api/prospects/:id`

Update prospect fields (protected fields are stripped: `prospectCode`, `currentStage`, `companyId`, `branchId`, `createdById`).

**Permission**: `PROSPECT:canEdit`

**Possible errors**
- **404 NOT_FOUND** — prospect not in scope
- **403 FORBIDDEN** — cross-company, or ISE-only-own-prospects rule (`You can only edit your own prospects`)
- **404 NOT_FOUND** — `leadSourceId` in body invalid/inactive/out of scope (`Lead source not found`)
- **403 FORBIDDEN** — `assignedToId` not in the **prospect’s** company (`Assigned user does not belong to the prospect's company`), including when the actor is super admin (`actor.companyId` is null)
- **401** / **403 PERMISSION_DENIED** (`PROSPECT:canEdit`)

**Error response examples**

Lead-source / assignee checks use the prospect’s `companyId`, not the actor’s, so super admin updates behave like tenant updates. Prospect not found:

```json
{
  "success": false,
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Prospect not found",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

```json
{
  "success": false,
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "You can only edit your own prospects",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

---

### POST `/api/prospects/:id/stage`

Transition a prospect stage and write stage history.

**Permission**: `PROSPECT:canEdit`

**Request body**

```json
{
  "new_stage": "ENGAGED",
  "note": "First call done",
  "manager_approval_id": 5
}
```

**Rules**
- `new_stage` required and must be one of:
  - `NEW`, `ENGAGED`, `STRATEGY_SCHEDULED`, `STRATEGY_COMPLETED`, `TOKEN_DISCUSSION`, `TOKEN_RECEIVED`, `WIN`, `ARCHIVED`
- Transition must match the allowed transitions in `src/modules/prospect/stageMachine.js`.
- If current stage is `ARCHIVED`, `manager_approval_id` is required and must reference a user in the prospect’s company with `PROSPECT:canDelete`. Any violation returns **`400 BAD_REQUEST`** with message **`Stage transition not allowed.`** (same as invalid transition / WIN rules below).
- For `WIN` stage: `tokenAmount > 0` and `joiningDate` must be set on the prospect; otherwise **`400 BAD_REQUEST`**, message **`Stage transition not allowed.`**
- Each successful transition inserts **`stage_history`**: `prospect_id`, `old_stage`, `new_stage`, `changed_by_id`, `changed_at` (and optional `note`).

**Possible errors**
- **400 VALIDATION_ERROR** — missing `new_stage` only
- **400 BAD_REQUEST** — unknown stage string; same stage; disallowed transition; **WIN** preconditions not met; **unarchive** without valid `manager_approval_id` / approver / permission — message **`Stage transition not allowed.`** where applicable
- **404 NOT_FOUND** — prospect not in scope
- **401** / **403 PERMISSION_DENIED** (`PROSPECT:canEdit`)

**Error response examples**

Missing `new_stage` (`400`):

```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    { "field": "new_stage", "message": "new_stage is required" }
  ],
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

Invalid stage (`400`):

```json
{
  "success": false,
  "statusCode": 400,
  "code": "BAD_REQUEST",
  "message": "Invalid stage. Must be one of: NEW, ENGAGED, STRATEGY_SCHEDULED, STRATEGY_COMPLETED, TOKEN_DISCUSSION, TOKEN_RECEIVED, WIN, ARCHIVED",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

Disallowed transition (`400`):

```json
{
  "success": false,
  "statusCode": 400,
  "code": "BAD_REQUEST",
  "message": "Stage transition not allowed.",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

WIN preconditions not met, or invalid unarchive from `ARCHIVED` (same shape as disallowed transition):

```json
{
  "success": false,
  "statusCode": 400,
  "code": "BAD_REQUEST",
  "message": "Stage transition not allowed.",
  "details": null,
  "timestamp": "2026-04-13T00:00:00.000Z"
}
```

