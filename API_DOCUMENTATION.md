# StackDot CRM Backend API Documentation

Base URL prefix: `/api`

This documentation reflects the current implementation in:
- `src/modules/auth/*`
- `src/modules/company/*`
- `src/modules/branch/*`
- `src/modules/leadsources/*`
- `src/modules/pipeline/*`
- `src/modules/stage/*`
- `src/modules/lead/*`
- `src/modules/daily_branch_reports/*`
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
- [5) Pipelines](#5-pipelines)
  - [Pipeline stages (how it works)](#pipeline-stages-how-it-works)
  - [POST `/api/pipelines`](#post-apipipelines)
  - [GET `/api/pipelines`](#get-apipipelines)
  - [GET `/api/pipelines/:id`](#get-apipipelinesid)
  - [PUT `/api/pipelines/:id`](#put-apipipelinesid)
  - [DELETE `/api/pipelines/:id`](#delete-apipipelinesid)
  - [POST `/api/pipelines/:id/stages`](#post-apipipelinesidstages)
  - [PUT `/api/pipelines/:id/stages/order`](#put-apipipelinesidstagesorder)
- [6) Stages (Master)](#6-stages-master)
  - [POST `/api/stages`](#post-apistages)
  - [GET `/api/stages`](#get-apistages)
  - [PUT `/api/stages/:id`](#put-apistagesid)
  - [DELETE `/api/stages/:id`](#delete-apistagesid)
  - [GET `/api/stages/pipeline/:pipelineId`](#get-apistagespipelinepipelineid)
- [7) Leads + Comments](#7-leads--comments)
  - [POST `/api/leads`](#post-apileads)
  - [GET `/api/leads`](#get-apileads)
  - [PATCH `/api/leads/:id/stage`](#patch-apileadsidstage)
  - [POST `/api/leads/:id/comments`](#post-apileadsidcomments)
  - [GET `/api/leads/:id/comments`](#get-apileadsidcomments)
- [8) Daily Branch Reports](#8-daily-branch-reports)
  - [POST `/api/daily-branch-reports/submit`](#post-apidaily-branch-reportssubmit)
  - [GET `/api/daily-branch-reports/get-reports`](#get-apidaily-branch-reportsget-reports)

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

For lead sources, a missing/inactive/out-of-scope record may still return this way: the server may not distinguish “wrong id” vs “inactive” vs “other company’s source” in the payload (all resolve to **404** with the same shape).

**Conflict (`409`, `CONFLICT`)** — often includes `details.field` (example message):

```json
{
  "success": false,
  "statusCode": 409,
  "code": "CONFLICT",
  "message": "Resource already exists",
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

## 5) Pipelines

Routes: `src/modules/pipeline/pipeline.routes.js`

All endpoints require:
- **Auth** (`authenticate`)
- **Module permission**: `PIPELINE` via `hasPermission("PIPELINE", ...)`

Important rules implemented:
- Every pipeline **automatically includes** the global **"Prospect"** stage (mapped in `pipeline_stages` with `order_no = 1`).
- Stages are global (master) but assigned per pipeline via `pipeline_stages`.

### Pipeline stages (how it works)

There are **two tables/models** involved:

- **`stages` (Stage master)**: global list shared by all pipelines (example: `Prospect`, `Follow Up`, `Qualified`).
- **`pipeline_stages` (PipelineStage mapping)**: connects one `pipeline_id` to many `stage_id` rows and stores `order_no`.

**Rules**

- **Prospect is mandatory**: every pipeline must contain the **default** stage `Prospect`.
  - On pipeline creation, the backend automatically assigns `Prospect` with `order_no = 1`.
  - When assigning stages to a pipeline, the backend always forces `Prospect` to be included (even if the frontend doesn’t send it).
- **Stages are global, assignment is per pipeline**: creating a stage does not add it to any pipeline until you assign it.
- **Ordering is per pipeline**: same stage can have different `order_no` in different pipelines.

**Frontend flow (recommended)**

- **Step 1 (show stage list)**: call `GET /api/stages` to show all global stage options (multi-select).
- **Step 2 (assign + create new + order)**: call `POST /api/pipelines/:id/stages` with:
  - `stageIds`: existing selected stage ids
  - `newStages`: any new stage names created from “+ Create New Stage”
  - `orderedStageIds`: final drag/drop order (must include exactly the same stage ids being assigned)
- **Step 3 (reuse on screens)**: call `GET /api/stages/pipeline/:pipelineId` to fetch ordered stages for Kanban columns.

### POST `/api/pipelines`

Create a pipeline.

**Permission**: `PIPELINE:canCreate`

**Request body**

```json
{
  "name": "Admissions 2026"
}
```

**Notes**
- Branch/Company are resolved from logged-in user:
  - Branch user → uses `req.user.companyId` + `req.user.branchId`
  - Company-level user (no branch) → must send `branchId`
  - Super admin → must send `companyId` + `branchId`

**Success (201)**: `data = { "pipeline": { ... } }`

---

### GET `/api/pipelines`

List pipelines (scoped by company/branch of the logged-in user).

**Permission**: `PIPELINE:canView`

**Success (200)**: `data = { "pipelines": [ ... ] }`

---

### GET `/api/pipelines/:id`

Get pipeline details **including assigned stages + leads**.

**Permission**: `PIPELINE:canView`

**Success (200)**: `data = { "pipeline": { "stages": [ ... ], "leads": [ ... ] } }`

---

### PUT `/api/pipelines/:id`

Update pipeline name.

**Permission**: `PIPELINE:canEdit`

**Body**

```json
{ "name": "Admissions 2026 - Updated" }
```

---

### DELETE `/api/pipelines/:id`

Soft delete a pipeline.

**Permission**: `PIPELINE:canDelete`

---

### POST `/api/pipelines/:id/stages`

Assign stages to pipeline (core logic).

**Permission**: `PIPELINE:canEdit`

Rules:
- Always includes **"Prospect"** stage.
- Can assign existing stages and/or create new ones.
- Can save ordering.

**Body**

```json
{
  "stageIds": [1, 2],
  "newStages": [{ "name": "Follow Up" }],
  "orderedStageIds": [1, 3, 2]
}
```

---

### PUT `/api/pipelines/:id/stages/order`

Update order of already-assigned pipeline stages.

**Permission**: `PIPELINE:canEdit`

**Body**

```json
{ "orderedStageIds": [1, 3, 2] }
```

---

## 6) Stages (Master)

Routes: `src/modules/stage/stage.routes.js`

All endpoints require:
- **Auth**
- **Module permission**: `STAGE` (except the pipeline stages list uses `PIPELINE:canView`)

### POST `/api/stages`

Create stage (global).

**Permission**: `STAGE:canCreate`

**Body**

```json
{ "name": "Follow Up" }
```

---

### GET `/api/stages`

Get all stages (global).

**Permission**: `STAGE:canView`

---

### PUT `/api/stages/:id`

Rename stage (default stage "Prospect" cannot be renamed).

**Permission**: `STAGE:canEdit`

**Body**

```json
{ "name": "Qualified" }
```

---

### DELETE `/api/stages/:id`

Soft delete stage (default stage "Prospect" cannot be deleted).

**Permission**: `STAGE:canDelete`

---

### GET `/api/stages/pipeline/:pipelineId`

Reusable frontend endpoint: get **ordered assigned stages** for a pipeline.

**Permission**: `PIPELINE:canView`

**Success (200)**: `data = { "stages": [ { id, name, isDefault, orderNo } ] }`

---

## 7) Leads + Comments

Routes: `src/modules/lead/lead.routes.js`

All endpoints require:
- **Auth**
- **LEAD** module permission for lead actions
- **ACTIVITY** module permission for comments

### POST `/api/leads`

Create lead.

**Permission**: `LEAD:canCreate`

Rule:
- Lead default stage is always **Prospect**.

**Body**

```json
{
  "pipelineId": 1,
  "name": "Aman",
  "mobile": "9999999999",
  "date": "2026-04-16T00:00:00.000Z",
  "interested_for": "MBA"
}
```

---

### GET `/api/leads`

Get leads (supports filters).

**Permission**: `LEAD:canView`

**Query params (optional)**:
- `pipelineId`
- `stageId`
- `page`, `limit`

---

### PATCH `/api/leads/:id/stage`

Update lead stage (Kanban move).

**Permission**: `LEAD:canEdit`

Rule:
- target `stageId` must be assigned to the lead’s pipeline.

**Body**

```json
{ "stageId": 2 }
```

---

### POST `/api/leads/:id/comments`

Add comment to lead.

**Permission**: `ACTIVITY:canCreate`

**Body**

```json
{ "comment": "Called the lead, interested." }
```

---

### GET `/api/leads/:id/comments`

Get comments of a lead.

**Permission**: `ACTIVITY:canView`

---

## 8) Daily Branch Reports

Routes: `src/modules/daily_branch_reports/dailyBranchReport.routes.js`

All endpoints require:
- **Auth**
- **Role authorization** (via `authorize(...)` middleware in the route). These endpoints currently use role-gates (not `hasPermission("<MODULE>", "<action>")`).

### POST `/api/daily-branch-reports/submit`

Submit daily performance numbers for the authenticated user’s branch for a given date.

**Authorization**: role must include `ISE`

**What this endpoint does**
- Takes daily numeric counters for a single day.
- Stores the report under your `branchId` (from token) and your `userId` (createdBy).
- You can submit **only once** per date. If you submit again for the same date, it returns **409 CONFLICT**.

**How it works (important)**
- Backend reads `branchId` from `req.user.branchId` (it is not taken from request body).
- It enforces uniqueness on:
  - `branchId + reportDate + createdById`
- Implementation is **create-only** (no update / no upsert).

**Request body (all required)**

```json
{
  "reportDate": "2026-04-27",
  "callsReceived": 20,
  "qualifiedLeads": 5,
  "counsellingDone": 3,
  "counsellingBooked": 2,
  "officeVisits": 1,
  "closures": 1,
  "revenue": 50000,
  "followupsDone": 10,
  "pendingFollowups": 4,
  "seminarTasks": 2,
  "joiningFormalities": 1
}
```

Notes:
- `reportDate` should be an ISO date (e.g. `YYYY-MM-DD`) or ISO datetime string.
- Current validation uses “required” checks that treat `0` as missing, so sending `0` will throw a `VALIDATION_ERROR`. Use positive values.

**Success (201)**

```json
{
  "success": true,
  "statusCode": 201,
  "message": "Form filled successfully",
  "data": {},
  "timestamp": "2026-04-27T00:00:00.000Z"
}
```

**Error cases**
- `400 VALIDATION_ERROR`: missing/empty required fields (`details` array contains `field` + `message`)
- `400 BAD_REQUEST`: e.g. no branch on user token (`"Branch is required"`)
- `401 UNAUTHORIZED`: missing/invalid token
- `409 CONFLICT`: daily report already submitted for this date
- `403 ROLE_NOT_ALLOWED`: not an ISE user (blocked by `authorize("ISE")`)

Example validation error (400):

```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    { "field": "reportDate", "message": "Report date is required" },
    { "field": "callsReceived", "message": "Calls received is required" }
  ],
  "timestamp": "2026-04-27T00:00:00.000Z"
}
```

---

### GET `/api/daily-branch-reports/get-reports`

Fetch daily report dashboard analytics for the authenticated user’s branch for a date range (default: today).

**Authorization**: role must include `BRANCH_ADMIN`

**What this endpoint returns**
- `range`: normalized date range (start at 00:00:00.000, end at 23:59:59.999)
- `reportsCount`: how many report rows were included
- `cards`: one card per metric (11 cards). Each card includes:
  - `metric`: metric key
  - `total`: sum of that metric across all matching reports
  - `topPerformers`: list of users in **DESC** order for that metric (users only; no per-user value in response)

**How it works (important)**
- Backend reads `branchId` from `req.user.branchId`.
- Includes reports where:
  - `isDeleted = false`
  - `reportDate` falls within the computed range
  - and (to handle older data inconsistencies) either:
    - `daily_branch_reports.branch_id = req.user.branchId`, OR
    - the creator user’s `users.branch_id = req.user.branchId`

**Query params (optional)**
- `startDate`: date/datetime (defaults to today)
- `endDate`: date/datetime (defaults to today)

Metrics returned (11):
`callsReceived`, `qualifiedLeads`, `counsellingDone`, `counsellingBooked`, `officeVisits`, `closures`, `revenue`, `followupsDone`, `pendingFollowups`, `seminarTasks`, `joiningFormalities`

Example:
- `/api/daily-branch-reports/get-reports?startDate=2026-04-01&endDate=2026-04-27`

**Success (200)**

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Daily branch reports fetched successfully",
  "data": {
    "range": {
      "startDate": "2026-04-01T00:00:00.000Z",
      "endDate": "2026-04-27T23:59:59.999Z"
    },
    "reportsCount": 24,
    "cards": [
      {
        "metric": "callsReceived",
        "total": 135,
        "topPerformers": [
          { "user": { "id": 23, "name": "ise", "email": "ise@gmail.com" } }
        ]
      },
      {
        "metric": "joiningFormalities",
        "total": 1,
        "topPerformers": [
          { "user": { "id": 23, "name": "ise", "email": "ise@gmail.com" } }
        ]
      }
    ]
  },
  "timestamp": "2026-04-27T00:00:00.000Z"
}
```

**Error cases**
- `400 BAD_REQUEST`: invalid `startDate`/`endDate` or missing branch
- `401 UNAUTHORIZED`: missing/invalid token
- `403 ROLE_NOT_ALLOWED`: not a branch admin (blocked by `authorize("BRANCH_ADMIN")`)

