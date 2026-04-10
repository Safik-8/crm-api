# StackDot CRM Backend API Documentation

## Overview
This is the backend API for StackDot CRM, built with Node.js, Express, and Prisma ORM on PostgreSQL.

## Prerequisites
- Node.js 18+ installed
- PostgreSQL database available
- npm or yarn package manager

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd STACKDOT-CRM/BACKEND
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the `BACKEND` directory with:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/stackdot_crm?schema=public"
   DIRECT_URL="postgresql://username:password@localhost:5432/stackdot_crm?schema=public"
   JWT_ACCESS_SECRET="your-jwt-access-secret-key"
   JWT_REFRESH_SECRET="your-jwt-refresh-secret-key"
   JWT_ACCESS_EXPIRY="15m"
   JWT_REFRESH_EXPIRY="7d"
   PORT=5000
   CLIENT_URL=http://localhost:3000
   ```

4. **Database Setup**
   - Start PostgreSQL
   - Create the `stackdot_crm` database
   - Run Prisma migrations:
     ```bash
     npx prisma migrate dev
     ```
   - Generate Prisma client:
     ```bash
     npx prisma generate
     ```

5. **Start the Server**
   ```bash
   npm run dev
   ```

---

## API Base Path
All endpoints are mounted under the base path:

`/api`

So the login endpoint is:

`POST /api/auth/login`

---

## Authentication Endpoints

### 1. Login
**Endpoint:** `POST /api/auth/login`

**Description:** Authenticate a user with email and password. Returns user profile in response and sets `accessToken` and `refreshToken` cookies.

**Request Headers:**
```http
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "user@example.com",
      "status": "ACTIVE",
      "companyId": 1,
      "companyName": "Tech Corp",
      "companyCode": "TC001",
      "branchId": 1,
      "branchName": "Main Branch",
      "branchCode": "BR001",
      "primaryRole": "BRANCH_ADMIN",
      "roles": [
        {
          "role": "BRANCH_ADMIN",
          "companyId": 1,
          "branchId": 1,
          "isPrimary": true
        }
      ],
      "permissions": {
        "COMPANY": {
          "canView": false,
          "canCreate": false,
          "canEdit": false,
          "canDelete": false
        },
        "BRANCH": {
          "canView": true,
          "canCreate": false,
          "canEdit": true,
          "canDelete": false
        },
        "USER": {
          "canView": true,
          "canCreate": true,
          "canEdit": true,
          "canDelete": true
        }
      }
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "timestamp": "2026-04-08T10:30:25.123Z"
}
```

**Cookies Set:**
- `accessToken`: httpOnly cookie valid for 15 minutes
- `refreshToken`: httpOnly cookie valid for 7 days

**Error Responses:**
- `401 Unauthorized` when email or password is invalid
- `400 Validation Error` when required fields are missing

**Example Unauthorized Error:**
```json
{
  "success": false,
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "Invalid email or password",
  "details": null,
  "timestamp": "2026-04-08T10:30:25.123Z"
}
```

**Example Validation Error:**
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
  "timestamp": "2026-04-08T10:30:25.123Z"
}
```

---

### 2. Refresh Token
**Endpoint:** `POST /api/auth/refresh`

**Description:** Refresh the access token using the current refresh token. The refresh token may be supplied via cookie or request body.

**Request Headers:**
```http
Content-Type: application/json
Cookie: refreshToken=<refresh_token_value>
```

**Request Body (optional):**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Token refreshed",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "user@example.com",
      "status": "ACTIVE",
      "companyId": 1,
      "companyName": "Tech Corp",
      "companyCode": "TC001",
      "branchId": 1,
      "branchName": "Main Branch",
      "branchCode": "BR001",
      "primaryRole": "BRANCH_ADMIN",
      "roles": [
        {
          "role": "BRANCH_ADMIN",
          "companyId": 1,
          "branchId": 1,
          "isPrimary": true
        }
      ],
      "permissions": {
        "COMPANY": {
          "canView": false,
          "canCreate": false,
          "canEdit": false,
          "canDelete": false
        },
        "BRANCH": {
          "canView": true,
          "canCreate": false,
          "canEdit": true,
          "canDelete": false
        },
        "USER": {
          "canView": true,
          "canCreate": true,
          "canEdit": true,
          "canDelete": true
        }
      }
    }
  },
  "timestamp": "2026-04-08T10:31:25.123Z"
}
```

**Cookies Updated:**
- `accessToken`: refreshed token is set in cookie
- `refreshToken`: refreshed token is set in cookie

**Error Responses:**
- `400 Validation Error` when the refresh token is missing from both cookie and body
- `401 Unauthorized` when the refresh token is invalid or expired

**Example Validation Error:**
```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    { "field": "refreshToken", "message": "Refresh token is required" }
  ],
  "timestamp": "2026-04-08T10:31:25.123Z"
}
```

**Example Unauthorized Error:**
```json
{
  "success": false,
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "Invalid or expired refresh token",
  "details": null,
  "timestamp": "2026-04-08T10:31:25.123Z"
}
```

---

### 3. Logout
**Endpoint:** `POST /api/auth/logout`

**Description:** Logout the current user by invalidating the refresh token and clearing cookies.

**Request Headers:**
```http
Content-Type: application/json
Cookie: refreshToken=<refresh_token_value>
```

**Request Body:**
```json
{}
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Logged out successfully",
  "data": null,
  "timestamp": "2026-04-08T10:32:25.123Z"
}
```

**Cookies Cleared:**
- `accessToken`
- `refreshToken`

**Error Responses:**
- This endpoint returns `200 OK` even if the refresh token is missing or already invalidated.
- There is no required request body validation for logout.

---

### 4. Get Current User
**Endpoint:** `GET /api/auth/me`

**Description:** Retrieve the current authenticated user's profile. Requires a valid access token cookie.

**Request Headers:**
```http
Authorization: Bearer <access_token_value>
```

**Request Body:**
```
No body required
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User fetched",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "user@example.com",
      "status": "ACTIVE",
      "companyId": 1,
      "companyName": "Tech Corp",
      "companyCode": "TC001",
      "branchId": 1,
      "branchName": "Main Branch",
      "branchCode": "BR001",
      "primaryRole": "BRANCH_ADMIN",
      "roles": [
        {
          "role": "BRANCH_ADMIN",
          "companyId": 1,
          "branchId": 1,
          "isPrimary": true
        }
      ],
      "permissions": {
        "COMPANY": {
          "canView": false,
          "canCreate": false,
          "canEdit": false,
          "canDelete": false
        },
        "BRANCH": {
          "canView": true,
          "canCreate": false,
          "canEdit": true,
          "canDelete": false
        },
        "USER": {
          "canView": true,
          "canCreate": true,
          "canEdit": true,
          "canDelete": true
        }
      }
    }
  },
  "timestamp": "2026-04-08T10:33:25.123Z"
}
```

**Error Responses:**
- `401 Unauthorized` when the access token is missing, invalid, or expired
- `403 Forbidden` when the user account is inactive or has no assigned roles

**Example Unauthorized Error:**
```json
{
  "success": false,
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "Not authenticated",
  "details": null,
  "timestamp": "2026-04-08T10:33:25.123Z"
}
```

**Example Forbidden Error:**
```json
{
  "success": false,
  "statusCode": 403,
  "code": "ACCOUNT_INACTIVE",
  "message": "Your account has been deactivated. Contact admin.",
  "details": null,
  "timestamp": "2026-04-08T10:33:25.123Z"
}
```

---

## Company Endpoints

### 1. Create Company
**Endpoint:** `POST /api/companies`

**Description:** Create a new company. Only SUPER_ADMIN users can create companies.

**Authentication:** Required (SUPER_ADMIN role)

**Permissions:** `COMPANY:canCreate`

**Request Headers:**
```http
Content-Type: application/json
Authorization: Bearer <access_token_value>
```

**Request Body:**
```json
{
  "name": "Tech Solutions Inc",
  "code": "TSI",
  "status": "ACTIVE"
}
```

**Request Fields:**
- `name` (string, required): Company name
- `code` (string, required): Unique company code (will be converted to uppercase)
- `status` (string, optional): Company status, defaults to "ACTIVE"

**Success Response (201 Created):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Company created successfully",
  "data": {
    "company": {
      "id": 1,
      "name": "Tech Solutions Inc",
      "code": "TSI",
      "status": "ACTIVE",
      "createdAt": "2026-04-09T10:00:00.000Z",
      "updatedAt": "2026-04-09T10:00:00.000Z"
    }
  },
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Error Responses:**
- `400 Validation Error` when required fields are missing
- `401 Unauthorized` when not authenticated
- `403 Forbidden` when user lacks SUPER_ADMIN role or COMPANY:canCreate permission
- `409 Conflict` when company code already exists

**Example Validation Error:**
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
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Example Conflict Error:**
```json
{
  "success": false,
  "statusCode": 409,
  "code": "CONFLICT",
  "message": "Company code already exists",
  "details": { "field": "code" },
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

---

### 2. Get All Companies
**Endpoint:** `GET /api/companies`

**Description:** Retrieve all companies. Only SUPER_ADMIN users can view companies.

**Authentication:** Required (SUPER_ADMIN role)

**Permissions:** `COMPANY:canView`

**Request Headers:**
```http
Authorization: Bearer <access_token_value>
```

**Request Body:**
```
No body required
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Companies fetched",
  "data": {
    "companies": [
      {
        "id": 1,
        "name": "Tech Solutions Inc",
        "code": "TSI",
        "status": "ACTIVE",
        "createdAt": "2026-04-09T10:00:00.000Z",
        "updatedAt": "2026-04-09T10:00:00.000Z",
        "_count": {
          "branches": 3,
          "users": 15
        }
      },
      {
        "id": 2,
        "name": "Global Corp",
        "code": "GC",
        "status": "ACTIVE",
        "createdAt": "2026-04-09T09:00:00.000Z",
        "updatedAt": "2026-04-09T09:00:00.000Z",
        "_count": {
          "branches": 5,
          "users": 28
        }
      }
    ]
  },
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Error Responses:**
- `401 Unauthorized` when not authenticated
- `403 Forbidden` when user lacks SUPER_ADMIN role or COMPANY:canView permission

**Example Unauthorized Error:**
```json
{
  "success": false,
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "Not authenticated",
  "details": null,
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Example Forbidden Error:**
```json
{
  "success": false,
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "Access denied",
  "details": null,
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

### 3. Get Company by ID
**Endpoint:** `GET /api/companies/:id`

**Description:** Retrieve a specific company by ID. Only SUPER_ADMIN users can view companies.

**Authentication:** Required (SUPER_ADMIN role)

**Permissions:** `COMPANY:canView`

**Request Headers:**
```http
Authorization: Bearer <access_token_value>
```

**URL Parameters:**
- `id` (number, required): Company ID

**Request Body:**
```
No body required
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Company fetched",
  "data": {
    "company": {
      "id": 1,
      "name": "Tech Solutions Inc",
      "code": "TSI",
      "status": "ACTIVE",
      "createdAt": "2026-04-09T10:00:00.000Z",
      "updatedAt": "2026-04-09T10:00:00.000Z",
      "branches": [
        {
          "id": 1,
          "name": "Main Office",
          "code": "MAIN",
          "status": "ACTIVE"
        },
        {
          "id": 2,
          "name": "Downtown Branch",
          "code": "DT",
          "status": "ACTIVE"
        }
      ],
      "_count": {
        "branches": 3,
        "users": 15
      }
    }
  },
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Error Responses:**
- `401 Unauthorized` when not authenticated
- `403 Forbidden` when user lacks SUPER_ADMIN role or COMPANY:canView permission
- `404 Not Found` when company does not exist

**Example Unauthorized Error:**
```json
{
  "success": false,
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "Not authenticated",
  "details": null,
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Example Forbidden Error:**
```json
{
  "success": false,
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "Access denied",
  "details": null,
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Example Not Found Error:**
```json
{
  "success": false,
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Company not found",
  "details": null,
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

---

### 4. Update Company
**Endpoint:** `PUT /api/companies/:id`

**Description:** Update an existing company. Only SUPER_ADMIN users can update companies.

**Authentication:** Required (SUPER_ADMIN role)

**Permissions:** `COMPANY:canEdit`

**Request Headers:**
```http
Content-Type: application/json
Authorization: Bearer <access_token_value>
```

**URL Parameters:**
- `id` (number, required): Company ID

**Request Body:**
```json
{
  "name": "Updated Company Name",
  "status": "INACTIVE"
}
```

**Request Fields:**
- `name` (string, optional): Updated company name
- `status` (string, optional): Updated company status ("ACTIVE" or "INACTIVE")

**Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Company updated successfully",
  "data": {
    "company": {
      "id": 1,
      "name": "Updated Company Name",
      "code": "TSI",
      "status": "INACTIVE",
      "createdAt": "2026-04-09T10:00:00.000Z",
      "updatedAt": "2026-04-09T10:05:00.000Z"
    }
  },
  "timestamp": "2026-04-09T10:05:00.000Z"
}
```

**Error Responses:**
- `401 Unauthorized` when not authenticated
- `403 Forbidden` when user lacks SUPER_ADMIN role or COMPANY:canEdit permission
- `404 Not Found` when company does not exist

**Example Unauthorized Error:**
```json
{
  "success": false,
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "Not authenticated",
  "details": null,
  "timestamp": "2026-04-09T10:05:00.000Z"
}
```

**Example Forbidden Error:**
```json
{
  "success": false,
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "Access denied",
  "details": null,
  "timestamp": "2026-04-09T10:05:00.000Z"
}
```

**Example Not Found Error:**
```json
{
  "success": false,
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Company not found",
  "details": null,
  "timestamp": "2026-04-09T10:05:00.000Z"
}
```

## Branch Endpoints

### 1. Create Branch
**Endpoint:** `POST /api/branches`

**Description:** Create a new branch within a company. SUPER_ADMIN and BRANCH_ADMIN users can create branches.

**Authentication:** Required (SUPER_ADMIN or BRANCH_ADMIN role)

**Permissions:** `BRANCH:canCreate`

**Request Headers:**
```http
Content-Type: application/json
Authorization: Bearer <access_token_value>
```

**Request Body:**
```json
{
  "companyId": 1,
  "name": "Downtown Branch",
  "code": "DT",
  "status": "ACTIVE"
}
```

**Request Fields:**
- `companyId` (number, required): ID of the company this branch belongs to
- `name` (string, required): Branch name
- `code` (string, required): Unique branch code within the company (will be converted to uppercase)
- `status` (string, optional): Branch status, defaults to "ACTIVE"

**Success Response (201 Created):**
```json
{
  "success": true,
  "statusCode": 201,
  "message": "Branch created successfully",
  "data": {
    "branch": {
      "id": 2,
      "companyId": 1,
      "name": "Downtown Branch",
      "code": "DT",
      "status": "ACTIVE",
      "createdAt": "2026-04-09T10:00:00.000Z",
      "updatedAt": "2026-04-09T10:00:00.000Z",
      "company": {
        "id": 1,
        "name": "Tech Solutions Inc"
      }
    }
  },
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Error Responses:**
- `400 Validation Error` when required fields are missing or company is inactive
- `401 Unauthorized` when not authenticated
- `403 Forbidden` when user lacks required role or BRANCH:canCreate permission, or tries to create branch in another company
- `404 Not Found` when company does not exist
- `409 Conflict` when branch code already exists in the company

**Example Validation Error (Missing Fields):**
```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    { "field": "name", "message": "Branch name is required" },
    { "field": "code", "message": "Branch code is required" },
    { "field": "companyId", "message": "Company ID is required" }
  ],
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Example Validation Error (Inactive Company):**
```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Company is inactive",
  "details": null,
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Example Unauthorized Error:**
```json
{
  "success": false,
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "Not authenticated",
  "details": null,
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Example Forbidden Error:**
```json
{
  "success": false,
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "Access denied",
  "details": null,
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Example Not Found Error:**
```json
{
  "success": false,
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Company not found",
  "details": null,
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Example Conflict Error:**
```json
{
  "success": false,
  "statusCode": 409,
  "code": "CONFLICT",
  "message": "Branch code already exists in this company",
  "details": { "field": "code" },
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

---

### 2. Get Branches
**Endpoint:** `GET /api/branches?company_id={companyId}`

**Description:** Retrieve branches for a specific company. Users can only view branches in their own company unless they are SUPER_ADMIN.

**Authentication:** Required

**Permissions:** `BRANCH:canView`

**Request Headers:**
```http
Authorization: Bearer <access_token_value>
```

**Query Parameters:**
- `company_id` (number, required for SUPER_ADMIN, optional for others): Company ID to filter branches

**Request Body:**
```
No body required
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Branches fetched",
  "data": {
    "branches": [
      {
        "id": 1,
        "companyId": 1,
        "name": "Main Office",
        "code": "MAIN",
        "status": "ACTIVE",
        "createdAt": "2026-04-09T09:00:00.000Z",
        "updatedAt": "2026-04-09T09:00:00.000Z",
        "company": {
          "id": 1,
          "name": "Tech Solutions Inc"
        },
        "_count": {
          "users": 8
        }
      },
      {
        "id": 2,
        "companyId": 1,
        "name": "Downtown Branch",
        "code": "DT",
        "status": "ACTIVE",
        "createdAt": "2026-04-09T10:00:00.000Z",
        "updatedAt": "2026-04-09T10:00:00.000Z",
        "company": {
          "id": 1,
          "name": "Tech Solutions Inc"
        },
        "_count": {
          "users": 5
        }
      }
    ],
    "total": 2
  },
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Error Responses:**
- `400 Validation Error` when company_id is missing for SUPER_ADMIN
- `401 Unauthorized` when not authenticated
- `403 Forbidden` when user lacks BRANCH:canView permission or tries to access another company's branches
- `404 Not Found` when company does not exist

**Example Validation Error:**
```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    { "field": "company_id", "message": "company_id is required" }
  ],
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Example Unauthorized Error:**
```json
{
  "success": false,
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "Not authenticated",
  "details": null,
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Example Forbidden Error:**
```json
{
  "success": false,
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "Access denied",
  "details": null,
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Example Not Found Error:**
```json
{
  "success": false,
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Company not found",
  "details": null,
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

### 3. Get Branch by ID
**Endpoint:** `GET /api/branches/:id`

**Description:** Retrieve a specific branch by ID. Users can only view branches in their own company unless they are SUPER_ADMIN.

**Authentication:** Required

**Permissions:** `BRANCH:canView`

**Request Headers:**
```http
Authorization: Bearer <access_token_value>
```

**URL Parameters:**
- `id` (number, required): Branch ID

**Request Body:**
```
No body required
```

**Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Branch fetched",
  "data": {
    "branch": {
      "id": 2,
      "companyId": 1,
      "name": "Downtown Branch",
      "code": "DT",
      "status": "ACTIVE",
      "createdAt": "2026-04-09T10:00:00.000Z",
      "updatedAt": "2026-04-09T10:00:00.000Z",
      "company": {
        "id": 1,
        "name": "Tech Solutions Inc"
      },
      "_count": {
        "users": 5
      }
    }
  },
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Error Responses:**
- `401 Unauthorized` when not authenticated
- `403 Forbidden` when user lacks BRANCH:canView permission or tries to access branch from another company
- `404 Not Found` when branch does not exist

**Example Unauthorized Error:**
```json
{
  "success": false,
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "Not authenticated",
  "details": null,
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Example Forbidden Error:**
```json
{
  "success": false,
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "Access denied",
  "details": null,
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Example Not Found Error:**
```json
{
  "success": false,
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Branch not found",
  "details": null,
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

### 4. Update Branch
**Endpoint:** `PUT /api/branches/:id`

**Description:** Update an existing branch. SUPER_ADMIN and BRANCH_ADMIN users can update branches.

**Authentication:** Required (SUPER_ADMIN or BRANCH_ADMIN role)

**Permissions:** `BRANCH:canEdit`

**Request Headers:**
```http
Content-Type: application/json
Authorization: Bearer <access_token_value>
```

**URL Parameters:**
- `id` (number, required): Branch ID

**Request Body:**
```json
{
  "name": "Updated Branch Name",
  "status": "INACTIVE"
}
```

**Request Fields:**
- `name` (string, optional): Updated branch name
- `status` (string, optional): Updated branch status ("ACTIVE" or "INACTIVE")

**Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Branch updated successfully",
  "data": {
    "branch": {
      "id": 2,
      "companyId": 1,
      "name": "Updated Branch Name",
      "code": "DT",
      "status": "INACTIVE",
      "createdAt": "2026-04-09T10:00:00.000Z",
      "updatedAt": "2026-04-09T10:05:00.000Z",
      "company": {
        "id": 1,
        "name": "Tech Solutions Inc"
      }
    }
  },
  "timestamp": "2026-04-09T10:05:00.000Z"
}
```

**Error Responses:**
- `401 Unauthorized` when not authenticated
- `403 Forbidden` when user lacks required role or BRANCH:canEdit permission, or tries to update branch in another company
- `404 Not Found` when branch does not exist

**Example Unauthorized Error:**
```json
{
  "success": false,
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "Not authenticated",
  "details": null,
  "timestamp": "2026-04-09T10:05:00.000Z"
}
```

**Example Forbidden Error:**
```json
{
  "success": false,
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "Access denied",
  "details": null,
  "timestamp": "2026-04-09T10:05:00.000Z"
}
```

**Example Not Found Error:**
```json
{
  "success": false,
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Branch not found",
  "details": null,
  "timestamp": "2026-04-09T10:05:00.000Z"
}
```

### 5. Assign User to Branch
**Endpoint:** `POST /api/branches/:id/assign-user`

**Description:** Create a new user and assign them to a specific branch. SUPER_ADMIN and BRANCH_ADMIN users can assign users to branches.

**Authentication:** Required (SUPER_ADMIN or BRANCH_ADMIN role)

**Permissions:** `BRANCH:canEdit`

**Request Headers:**
```http
Content-Type: application/json
Authorization: Bearer <access_token_value>
```

**URL Parameters:**
- `id` (number, required): Branch ID

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john.doe@company.com",
  "password": "securePassword123",
  "roleName": "MANAGER"
}
```

**Request Fields:**
- `name` (string, required): User's full name
- `email` (string, required): User's email address (must be unique)
- `password` (string, required): User's password
- `roleName` (string, required): Role to assign ("BRANCH_ADMIN", "MANAGER", or "ISE")

**Success Response (200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "User assigned to branch successfully",
  "data": {
    "user": {
      "id": 5,
      "name": "John Doe",
      "email": "john.doe@company.com",
      "status": "ACTIVE",
      "createdAt": "2026-04-09T10:00:00.000Z",
      "company": {
        "id": 1,
        "name": "Tech Solutions Inc"
      },
      "branch": {
        "id": 2,
        "name": "Downtown Branch"
      },
      "userRoles": [
        {
          "isPrimary": true,
          "role": {
            "id": 3,
            "name": "MANAGER"
          }
        }
      ]
    }
  },
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Error Responses:**
- `400 Validation Error` when required fields are missing or invalid role specified
- `401 Unauthorized` when not authenticated
- `403 Forbidden` when user lacks required role or BRANCH:canEdit permission, tries to assign user to branch in another company, or tries to create role they cannot assign
- `404 Not Found` when branch or role does not exist
- `409 Conflict` when email is already registered

**Example Validation Error (Missing Fields):**
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
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Example Validation Error (Invalid Role):**
```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Role CEO cannot be assigned to a branch directly",
  "details": [
    { "field": "roleName", "message": "Use BRANCH_ADMIN, MANAGER, or ISE" }
  ],
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Example Unauthorized Error:**
```json
{
  "success": false,
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "Not authenticated",
  "details": null,
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Example Forbidden Error (Cannot Create Role):**
```json
{
  "success": false,
  "statusCode": 403,
  "code": "FORBIDDEN",
  "message": "BRANCH_ADMIN cannot create user with role SUPER_ADMIN",
  "details": null,
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Example Not Found Error (Branch):**
```json
{
  "success": false,
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Branch not found",
  "details": null,
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Example Not Found Error (Role):**
```json
{
  "success": false,
  "statusCode": 404,
  "code": "NOT_FOUND",
  "message": "Role not found",
  "details": null,
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

**Example Conflict Error:**
```json
{
  "success": false,
  "statusCode": 409,
  "code": "CONFLICT",
  "message": "Email already registered",
  "details": { "field": "email" },
  "timestamp": "2026-04-09T10:00:00.000Z"
}
```

---

## User Roles and Permissions Scenarios

This section explains the different user roles in the system and what actions they can perform regarding companies and branches. The system uses a hierarchical role-based access control (RBAC) with company and branch scoping.

### User Roles Hierarchy

1. **SUPER_ADMIN**
   - System-wide administrator
   - Can manage all companies and branches across the entire system
   - Can create new companies
   - Can view, create, edit all branches in any company
   - Can assign users to any branch with any allowed role

2. **CEO**
   - Company-level executive
   - Can manage their own company's branches and users
   - Cannot create new companies
   - Can view, create, edit branches within their company
   - Cannot assign users to branches (no BRANCH:canEdit permission)

3. **BRANCH_ADMIN**
   - Branch-level administrator
   - Can manage branches within their company
   - Cannot create new companies
   - Can view, create, edit branches within their company
   - Can assign users to branches within their company (with role restrictions)
   - Can create users with roles: MANAGER, ISE (but not SUPER_ADMIN, CEO, or BRANCH_ADMIN)

4. **MANAGER**
   - Branch manager
   - Limited permissions within their branch
   - Cannot create companies or branches
   - Cannot assign users to branches

5. **ISE** (Inside Sales Executive)
   - Sales representative
   - Limited permissions within their branch
   - Cannot create companies or branches
   - Cannot assign users to branches

### Company Management Scenarios

#### Creating a Company
- **Who can create:** Only SUPER_ADMIN users
- **Required permissions:** COMPANY:canCreate
- **Scenario:** A SUPER_ADMIN logs in and creates a new company with unique code
- **Example:** SUPER_ADMIN creates "Tech Solutions Inc" with code "TSI"

#### Viewing Companies
- **Who can view:** Only SUPER_ADMIN users
- **Required permissions:** COMPANY:canView
- **Scenario:** SUPER_ADMIN can list all companies in the system with user/branch counts

#### Updating a Company
- **Who can update:** Only SUPER_ADMIN users
- **Required permissions:** COMPANY:canEdit
- **Scenario:** SUPER_ADMIN can change company name or status (ACTIVE/INACTIVE)

### Branch Management Scenarios

#### Creating a Branch
- **Who can create:** SUPER_ADMIN or BRANCH_ADMIN users
- **Required permissions:** BRANCH:canCreate
- **Company scoping:** Users can only create branches in their own company (unless SUPER_ADMIN)
- **Scenario:** 
  - BRANCH_ADMIN in "Tech Solutions Inc" creates a new branch "Downtown Office" with code "DTO"
  - SUPER_ADMIN can create branches in any company

#### Viewing Branches
- **Who can view:** Any authenticated user with BRANCH:canView permission
- **Company scoping:** Non-SUPER_ADMIN users can only view branches in their company
- **Query parameter:** SUPER_ADMIN must specify `company_id`, others can optionally filter
- **Scenario:** BRANCH_ADMIN views all branches in their company

#### Updating a Branch
- **Who can update:** SUPER_ADMIN or BRANCH_ADMIN users
- **Required permissions:** BRANCH:canEdit
- **Company scoping:** Users can only update branches in their own company
- **Scenario:** BRANCH_ADMIN updates branch name or status

#### Assigning Users to Branches
- **Who can assign:** SUPER_ADMIN or BRANCH_ADMIN users
- **Required permissions:** BRANCH:canEdit
- **Role restrictions:** 
  - SUPER_ADMIN can assign any role (SUPER_ADMIN, CEO, BRANCH_ADMIN, MANAGER, ISE)
  - BRANCH_ADMIN can only assign MANAGER and ISE roles
- **Company scoping:** Users can only assign to branches in their company
- **Process:** Creates a new user account and assigns them to the specified branch with the given role
- **Email uniqueness:** Email must be unique across the entire system
- **Scenarios:**
  - BRANCH_ADMIN creates a new MANAGER user for their branch
  - SUPER_ADMIN creates a new BRANCH_ADMIN for any branch in any company

### Permission Matrix

| Action | SUPER_ADMIN | CEO | BRANCH_ADMIN | MANAGER | ISE |
|--------|-------------|-----|--------------|---------|-----|
| Create Company | ✅ | ❌ | ❌ | ❌ | ❌ |
| View All Companies | ✅ | ❌ | ❌ | ❌ | ❌ |
| Update Company | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create Branch (own company) | ✅ | ❌ | ✅ | ❌ | ❌ |
| View Branches (own company) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update Branch (own company) | ✅ | ❌ | ✅ | ❌ | ❌ |
| Assign Users to Branch | ✅ | ❌ | ✅ (limited roles) | ❌ | ❌ |

### Error Scenarios

- **403 Forbidden (Company Scope):** BRANCH_ADMIN tries to create branch in another company
- **403 Forbidden (Role Creation):** BRANCH_ADMIN tries to assign SUPER_ADMIN role
- **409 Conflict (Duplicate Code):** Creating company/branch with existing code
- **409 Conflict (Duplicate Email):** Assigning user with email that already exists
- **404 Not Found:** Accessing non-existent company/branch/role
- **400 Validation:** Missing required fields or invalid role for branch assignment

### Workflow Examples

1. **New Company Setup:**
   - SUPER_ADMIN creates company "ABC Corp"
   - SUPER_ADMIN creates branch "Head Office" for ABC Corp
   - SUPER_ADMIN assigns BRANCH_ADMIN to the head office

2. **Branch Expansion:**
   - BRANCH_ADMIN creates new branch "Regional Office" in their company
   - BRANCH_ADMIN assigns MANAGER to the new branch
   - MANAGER can now operate within their branch scope

3. **User Onboarding:**
   - BRANCH_ADMIN creates ISE user for their branch
   - New ISE gets permissions scoped to their branch and role

This documentation is actively maintained and reflects the current implementation in the codebase.

---

## Common Error Codes

**Authentication & Authorization:**
- `UNAUTHORIZED` (401): Not authenticated
- `FORBIDDEN` (403): Access denied due to insufficient permissions or roles
- `ACCOUNT_INACTIVE` (403): User account is deactivated
- `NO_ROLE_ASSIGNED` (403): User has no assigned roles
- `PERMISSION_DENIED` (403): Missing specific permission for action
- `ROLE_NOT_ALLOWED` (403): Access denied due to insufficient role requirements

**Example UNAUTHORIZED Error:**
```json
{
    "success": false,
    "statusCode": 401,
    "code": "UNAUTHORIZED",
    "message": "Not authenticated",
    "details": null,
    "timestamp": "2026-04-10T04:38:07.948Z"
}
```

**Example FORBIDDEN Error:**
```json
{
    "success": false,
    "statusCode": 403,
    "code": "FORBIDDEN",
    "message": "Access denied",
    "details": null,
    "timestamp": "2026-04-10T04:38:07.948Z"
}
```

**Example ACCOUNT_INACTIVE Error:**
```json
{
    "success": false,
    "statusCode": 403,
    "code": "ACCOUNT_INACTIVE",
    "message": "Your account has been deactivated. Contact admin.",
    "details": null,
    "timestamp": "2026-04-10T04:38:07.948Z"
}
```

**Example NO_ROLE_ASSIGNED Error:**
```json
{
    "success": false,
    "statusCode": 403,
    "code": "NO_ROLE_ASSIGNED",
    "message": "No role assigned to this account. Contact admin.",
    "details": null,
    "timestamp": "2026-04-10T04:38:07.948Z"
}
```

**Example PERMISSION_DENIED Error:**
```json
{
    "success": false,
    "statusCode": 403,
    "code": "PERMISSION_DENIED",
    "message": "You don't have permission to canCreate BRANCH",
    "details": {
        "required": "BRANCH:canCreate"
    },
    "timestamp": "2026-04-10T04:38:07.948Z"
}
```

**Example ROLE_NOT_ALLOWED Error:**
```json
{
    "success": false,
    "statusCode": 403,
    "code": "ROLE_NOT_ALLOWED",
    "message": "Access denied. Required role: SUPER_ADMIN",
    "details": {
        "required": [
            "SUPER_ADMIN"
        ]
    },
    "timestamp": "2026-04-10T04:38:07.948Z"
}
```

**Validation & Data:**
- `VALIDATION_ERROR` (400): Invalid input data
- `BAD_REQUEST` (400): Malformed request
- `NOT_FOUND` (404): Resource does not exist
- `CONFLICT` (409): Resource already exists (duplicate data)

**System Errors:**
- `SERVER_ERROR` (500): Internal server error
- `ROUTE_NOT_FOUND` (404): Invalid endpoint URL
