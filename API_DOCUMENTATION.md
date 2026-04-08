# StackDot CRM Backend API Documentation

## Overview
This is the backend API for StackDot CRM, built with Node.js, Express, and Prisma ORM with PostgreSQL database.

## Prerequisites
- Node.js (version 18 or higher)
- PostgreSQL database
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
   Create a `.env` file in the BACKEND directory with the following variables:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/stackdot_crm?schema=public"
   DIRECT_URL="postgresql://username:password@localhost:5432/stackdot_crm?schema=public"
   JWT_ACCESS_SECRET="your-jwt-access-secret-key"
   JWT_REFRESH_SECRET="your-jwt-refresh-secret-key"
   JWT_ACCESS_EXPIRY="15m"
   JWT_REFRESH_EXPIRY="7d"
   PORT=5000
   ```

4. **Database Setup**
   - Ensure PostgreSQL is running
   - Create a database named `stackdot_crm`
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

## API Endpoints

### Authentication Endpoints

#### 1. Login
**Endpoint:** `POST /auth/login`

**Description:** Authenticate user with email and password. Returns access and refresh tokens as httpOnly cookies.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200 OK):**
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
- `accessToken`: JWT token with payload containing userId, email, name, company/branch info, roles, and permissions (valid for 15 minutes)
- `refreshToken`: JWT token with payload containing userId, email, and companyId (valid for 7 days)

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Invalid email or password",
  "data": null,
  "timestamp": "2026-04-08T10:30:25.123Z"
}
```

**Error Response (400 Validation Error):**
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "data": {
    "errors": [
      {
        "field": "email",
        "message": "Email is required"
      },
      {
        "field": "password",
        "message": "Password is required"
      }
    ]
  },
  "timestamp": "2026-04-08T10:30:25.123Z"
}
```

---

#### 2. Refresh Token
**Endpoint:** `POST /auth/refresh`

**Description:** Generate a new access token using the refresh token. Can be provided as a cookie or in request body.

**Request Headers:**
```
Content-Type: application/json
Cookie: refreshToken=<refresh_token_value>
```

**Request Body (Optional - if not using cookies):**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
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
- `accessToken`: New JWT token (valid for 15 minutes)

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Refresh token is invalid or expired",
  "data": null,
  "timestamp": "2026-04-08T10:31:25.123Z"
}
```

---

#### 3. Logout
**Endpoint:** `POST /auth/logout`

**Description:** Logout user by invalidating the refresh token and clearing cookies.

**Request Headers:**
```
Content-Type: application/json
Cookie: refreshToken=<refresh_token_value>
```

**Request Body:**
```json
{}
```

**Response (200 OK):**
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
- `accessToken`: Cleared
- `refreshToken`: Cleared

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Refresh token is missing or invalid",
  "data": null,
  "timestamp": "2026-04-08T10:32:25.123Z"
}
```

---

#### 4. Get Current User
**Endpoint:** `GET /auth/me`

**Description:** Fetch the currently authenticated user's profile information. Requires authentication.

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer <access_token>
Cookie: accessToken=<access_token_value>
```

**Request Body:**
```
(No body required)
```

**Response (200 OK):**
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
        },
        {
          "role": "Manager",
          "companyId": "company_id_uuid",
          "branchId": "branch_id_uuid",
          "isPrimary": false
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
        },
        "reports": {
          "canView": true,
          "canCreate": true,
          "canEdit": false,
          "canDelete": false
        }
      }
    }
  },
  "timestamp": "2026-04-08T10:33:25.123Z"
}
```

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Access token is missing or invalid",
  "data": null,
  "timestamp": "2026-04-08T10:33:25.123Z"
}
```

---

## Response Format

All API responses follow a consistent format:

```json
{
  "success": true|false,
  "statusCode": 200|201|400|401|403|500,
  "message": "Descriptive message",
  "data": {} | null,
  "timestamp": "ISO 8601 timestamp"
}
```

**Response Fields:**
- `success` (boolean): Indicates if the request was successful
- `statusCode` (number): HTTP status code
- `message` (string): Human-readable message about the response
- `data` (object|null): Response payload (null on error)
- `timestamp` (string): ISO 8601 formatted timestamp of when response was generated

---

## Authentication & Authorization

### Token Management

**Access Token:**
- Validity: 15 minutes
- Storage: httpOnly cookie (secure, sameSite: lax)
- Usage: Automatically sent with requests

**Refresh Token:**
- Validity: 7 days
- Storage: httpOnly cookie (secure, sameSite: lax)
- Usage: Used to obtain new access tokens

### JWT Payload Structure

**Access Token Payload:**
```json
{
  "userId": "user_id_uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "companyId": "company_id_uuid",
  "branchId": "branch_id_uuid",
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
    "COMPANY": { "canView": true, "canCreate": true, "canEdit": true, "canDelete": true },
    "USER": { "canView": true, "canCreate": true, "canEdit": true, "canDelete": true },
    "PROSPECT": { "canView": true, "canCreate": true, "canEdit": true, "canDelete": true }
  },
  "iat": 1712603425,
  "exp": 1712604325
}
```

**Refresh Token Payload:**
```json
{
  "userId": "user_id_uuid",
  "email": "user@example.com",
  "companyId": "company_id_uuid",
  "iat": 1712603425,
  "exp": 1713208225
}
```

**Payload Fields:**
- `userId`: Unique identifier for the user
- `email`: User email address
- `name`: Full name of the user (access token only)
- `companyId`: Associated company ID
- `branchId`: Associated branch ID (access token only)
- `primaryRole`: User's primary role name (access token only)
- `roles`: Array of all roles assigned to the user (access token only)
- `permissions`: Module-based permissions object (access token only)
- `iat`: Issued at timestamp
- `exp`: Expiration timestamp

### Authentication Middleware

Protected endpoints require the `authenticate` middleware which:
1. Extracts access token from cookies
2. Validates JWT signature and expiry
3. Retrieves fresh user data from database
4. Attaches user object to `req.user`

### Authorization

User actions are controlled by permission checks:
- Permissions are module-based (e.g., "users", "reports", "dashboard")
- Each permission has four levels: `canView`, `canCreate`, `canEdit`, `canDelete`
- Permissions are aggregated from all user roles
- A user can have multiple roles across different companies/branches

---

## Error Handling

The API uses standardized error responses:

**Validation Error (400):**
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "data": {
    "errors": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ]
  },
  "timestamp": "2026-04-08T10:30:25.123Z"
}
```

**Unauthorized Error (401):**
```json
{
  "success": false,
  "statusCode": 401,
  "message": "Unauthorized",
  "data": null,
  "timestamp": "2026-04-08T10:30:25.123Z"
}
```

**Forbidden Error (403):**
```json
{
  "success": false,
  "statusCode": 403,
  "message": "You do not have permission to perform this action",
  "data": null,
  "timestamp": "2026-04-08T10:30:25.123Z"
}
```

**Server Error (500):**
```json
{
  "success": false,
  "statusCode": 500,
  "message": "Internal server error",
  "data": null,
  "timestamp": "2026-04-08T10:30:25.123Z"
}
```

---

## Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Validation or request format error |
| 401 | Unauthorized | Authentication failed or token expired |
| 403 | Forbidden | User lacks required permissions |
| 500 | Server Error | Internal server error |

---

## Testing the API

### Using cURL

**Login:**
```bash
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123"
  }' \
  -c cookies.txt
```

**Get Current User (using cookies):**
```bash
curl -X GET http://localhost:5000/auth/me \
  -b cookies.txt
```

**Refresh Token:**
```bash
curl -X POST http://localhost:5000/auth/refresh \
  -b cookies.txt
```

**Logout:**
```bash
curl -X POST http://localhost:5000/auth/logout \
  -b cookies.txt
```

### Using Postman

1. Set request method and URL
2. For login: Add JSON body with email and password
3. After login, Postman will automatically manage cookies
4. For protected endpoints, cookies are automatically included

---

## Database Schema

### User Table
Stores user account information and authentication details.

### RefreshToken Table
Stores issued refresh tokens with expiry dates for logout functionality.

### Company & Branch Tables
Store organizational hierarchy information.

### Role & Permission Tables
Define user roles and their associated permissions across modules.

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- Tokens are JWT-based and signed with HS256 algorithm
- Cookies use secure settings: httpOnly, sameSite=lax
- Passwords are hashed using bcryptjs before storage
- API uses additive permissions model (permissions from all roles are combined)
- Last login timestamp is updated on successful authentication
   ```
   On first run, the system will automatically initialize roles, permissions, and create an initial SuperAdmin user.

## Initial SuperAdmin Account

When the server starts for the first time, it automatically creates a SuperAdmin user:

- **Email**: `superadmin@stackdot.com`
- **Password**: `superadmin123`
- **Company**: null (system-wide access)
- **Branch**: null (system-wide access)

⚠️ **Important**: Change the default password immediately after first login in production environments.

### Development Mode
```bash
npm run dev
```
This starts the server with nodemon for auto-reloading.

### Production Mode
```bash
npm start
```
This starts the server with Node.js.

The server will run on `http://localhost:5000` by default.

## API Documentation

### Base URL
```
http://localhost:5000
```

### Authentication
Currently, the API uses simple email/password authentication. JWT tokens will be implemented in future updates.

### Endpoints

#### Health Check
- **GET** `/`
- **Description**: Check if the API is running
- **Response**:
  ```json
  {
    "success": true,
    "message": "StackDot CRM API ✅",
    "version": "1.0.0",
    "timestamp": "2026-04-07T12:00:00.000Z"
  }
  ```

#### User Login
- **POST** `/auth/login`
- **Description**: Authenticate a user and return user details, company, branches, roles, and permissions
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "password123"
  }
  ```
- **Response (Success)**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": 1,
        "name": "John Doe",
        "email": "user@example.com"
      },
      "company": {
        "id": 1,
        "name": "Example Company"
      },
      "branches": [
        {
          "id": 1,
          "name": "Main Branch"
        },
        {
          "id": 2,
          "name": "Secondary Branch"
        }
      ],
      "roles": [
        "admin",
        "manager"
      ],
      "permissions": [
        {
          "id": 1,
          "name": "read_users",
          "description": "Can read user data"
        },
        {
          "id": 2,
          "name": "write_users",
          "description": "Can modify user data"
        }
      ]
    }
  }
  ```
- **Response (Error)**:
  ```json
  {
    "success": false,
    "error": {
      "type": "ValidationError",
      "message": "Validation failed",
      "details": [
        {
          "field": "email",
          "message": "Email is required"
        }
      ]
    }
  }
  ```

### Error Handling
The API uses consistent error responses:
- **ValidationError**: For input validation failures
- **UnauthorizedError**: For authentication failures
- **NotFoundError**: When requested resource is not found
- **Generic errors**: For other server errors

Error response format:
```json
{
  "success": false,
  "error": {
    "type": "ErrorType",
    "message": "Error message",
    "details": [...] // optional
  }
}
```

## Database Schema
The application uses Prisma ORM with PostgreSQL. Key models include:
- **Company**: Company information
- **Branch**: Branch locations under companies
- **User**: User accounts with company/branch associations
- **Role**: User roles
- **Permission**: Granular permissions
- **UserRole**: Junction table for user-role assignments with company/branch context

## Development Notes
- The application uses ES6 modules (`"type": "module"` in package.json)
- Password hashing is currently disabled (plain text comparison) - implement bcrypt in production
- CORS is configured to allow all origins - restrict in production
- Database migrations are handled by Prisma

## Troubleshooting
- If `npm run dev` fails, ensure all environment variables are set
- If database connection fails, verify DATABASE_URL and PostgreSQL is running
- For Prisma issues, try `npx prisma generate` after schema changes