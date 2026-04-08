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
      "id": "user_id_uuid",
      "name": "John Doe",
      "email": "user@example.com",
      "status": "ACTIVE",
      "companyId": "company_id_uuid",
      "companyName": "Tech Corp",
      "companyCode": "TC001",
      "branchId": "branch_id_uuid",
      "branchName": "Main Branch",
      "branchCode": "BR001",
      "primaryRole": "Admin",
      "roles": [
        {
          "role": "Admin",
          "companyId": "company_id_uuid",
          "branchId": "branch_id_uuid",
          "isPrimary": true
        }
      ],
      "permissions": {
        "dashboard": {
          "canView": true,
          "canCreate": false,
          "canEdit": false,
          "canDelete": false
        },
        "users": {
          "canView": true,
          "canCreate": true,
          "canEdit": true,
          "canDelete": true
        }
      }
    }
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
      "id": "user_id_uuid",
      "name": "John Doe",
      "email": "user@example.com",
      "status": "ACTIVE",
      "companyId": "company_id_uuid",
      "companyName": "Tech Corp",
      "companyCode": "TC001",
      "branchId": "branch_id_uuid",
      "branchName": "Main Branch",
      "branchCode": "BR001",
      "primaryRole": "Admin",
      "roles": [
        {
          "role": "Admin",
          "companyId": "company_id_uuid",
          "branchId": "branch_id_uuid",
          "isPrimary": true
        }
      ],
      "permissions": {
        "dashboard": {
          "canView": true,
          "canCreate": false,
          "canEdit": false,
          "canDelete": false
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
      "id": "user_id_uuid",
      "name": "John Doe",
      "email": "user@example.com",
      "status": "ACTIVE",
      "companyId": "company_id_uuid",
      "companyName": "Tech Corp",
      "companyCode": "TC001",
      "branchId": "branch_id_uuid",
      "branchName": "Main Branch",
      "branchCode": "BR001",
      "primaryRole": "Admin",
      "roles": [
        {
          "role": "Admin",
          "companyId": "company_id_uuid",
          "branchId": "branch_id_uuid",
          "isPrimary": true
        }
      ],
      "permissions": {
        "dashboard": {
          "canView": true,
          "canCreate": false,
          "canEdit": false,
          "canDelete": false
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

## Response Format
All API responses use this structure:

```json
{
  "success": true | false,
  "statusCode": 200 | 201 | 400 | 401 | 403 | 404 | 500,
  "message": "Descriptive message",
  "data": {} | null,
  "timestamp": "ISO 8601 timestamp"
}
```

**Response Fields:**
- `success`: boolean
- `statusCode`: HTTP status code
- `message`: human-readable message
- `data`: response payload or `null`
- `timestamp`: ISO 8601 timestamp

---

## Authentication Notes
- The API is mounted at `/api`.
- The auth routes are defined under `/api/auth/*`.
- `accessToken` and `refreshToken` are stored in httpOnly cookies.
- `accessToken` expires after 15 minutes.
- `refreshToken` expires after 7 days.
- The `refresh` endpoint returns only the refreshed user profile in the body; new tokens are set in cookies.
- The `logout` endpoint clears both auth cookies.

---

## Error Handling
When an error occurs, the API returns standard JSON with `success: false`.

**Example:**
```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    { "field": "email", "message": "Email is required" }
  ],
  "timestamp": "2026-04-08T10:30:25.123Z"
}
```

**Common error codes:**
- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `NO_ROLE_ASSIGNED`
- `ACCOUNT_INACTIVE`
- `NOT_FOUND`
- `CONFLICT`
- `SERVER_ERROR`
