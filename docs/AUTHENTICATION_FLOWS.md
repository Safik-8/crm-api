# Frontend Integration Guide: Authentication & Password Reset Flows

This guide explains how to integrate the **Refresh Token** and **OTP-Based Forgot Password** APIs in your frontend application.

---

## 1. Refresh Token Flow

The backend uses a secure, rotated JWT authentication system. It supports both **cookies** (recommended for security) and **JSON body/Headers**.

### Endpoint: `POST /api/auth/refresh`

This endpoint issues a new `accessToken` and a rotated `refreshToken` when the current access token expires.

#### Request Headers & Body
The backend can read the refresh token from three locations (checked in this order):
1. **Cookie**: It looks for a `refreshToken` cookie.
2. **Body**: `{ "refreshToken": "..." }`
3. **Authorization Header**: `Bearer <refresh_token>`

#### Response Payload (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Token refreshed",
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "user": {
      "id": 2,
      "name": "Super Admin",
      "email": "superadmin@gmail.com",
      "primaryRole": "SUPER_ADMIN",
      "roles": [ ... ],
      "permissions": { ... }
    }
  }
}
```

> [!NOTE]
> The backend sets these new tokens in HTTP-only cookies (`accessToken` and `refreshToken`). It also returns them in the response JSON `data` block so you can store them in memory if your client uses Bearer Headers.

### Frontend Integration Best Practice (Axios Interceptors)
When an API request fails with a `401 Unauthorized` (access token expired), you should intercept the error, call the refresh endpoint to obtain a new access token, and retry the original request.

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  withCredentials: true // Essential to send/receive HTTP-only cookies
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If token expired and request hasn't been retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        // Call refresh endpoint
        const response = await axios.post(
          'http://localhost:5000/api/auth/refresh', 
          {}, 
          { withCredentials: true }
        );
        
        const newAccessToken = response.data.data.accessToken;
        
        // If you store token in memory or authorization header:
        api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        
        // Retry the original request
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh token expired too -> redirect to login
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);
```

---

## 2. Forgot Password (OTP) Flow

The password reset system uses a secure 3-step verification flow:

```
[ Step 1: Send OTP ] ──> [ Step 2: Verify OTP ] ──> [ Step 3: Reset Password ]
```

### Step 1: Request Password Reset Code
User enters their registered email address. The backend checks if the user exists, generates a 6-digit OTP code, saves it with a 10-minute expiry, and emails it to the user.

* **Endpoint**: `POST /api/auth/forgot-password`
* **Request Body**:
  ```json
  {
    "email": "superadmin@gmail.com"
  }
  ```
* **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "OTP sent successfully to your email",
    "data": {
      "email": "superadmin@gmail.com"
    }
  }
  ```
* **Error Response (`404 Not Found`)**: If no account exists with that email:
  ```json
  {
    "success": false,
    "statusCode": 404,
    "code": "NOT_FOUND",
    "message": "User with this email not found"
  }
  ```

---

### Step 2: Verify OTP
User enters the 6-digit code received in their email. The backend verifies the code matches, is not expired, and marks the session as `isVerified: true` in the database.

* **Endpoint**: `POST /api/auth/verify-otp`
* **Request Body**:
  ```json
  {
    "email": "superadmin@gmail.com",
    "otp": "570297"
  }
  ```
* **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "OTP verified successfully",
    "data": {
      "email": "superadmin@gmail.com",
      "verified": true
    }
  }
  ```
* **Error Response (`400 Bad Request`)**: If OTP is invalid or expired:
  ```json
  {
    "success": false,
    "statusCode": 400,
    "code": "BAD_REQUEST",
    "message": "Invalid OTP code" // or "OTP code has expired"
  }
  ```

---

### Step 3: Change Password
User sets their new password. The backend checks if the OTP session has been successfully verified (from Step 2), hashes the new password, updates the user's password, and deletes the OTP record.

* **Endpoint**: `POST /api/auth/reset-password`
* **Request Body**:
  ```json
  {
    "email": "superadmin@gmail.com",
    "otp": "570297",
    "newPassword": "supernewpassword123"
  }
  ```
* **Success Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Password reset successfully",
    "data": {
      "email": "superadmin@gmail.com",
      "success": true
    }
  }
  ```
* **Error Response (`400 Bad Request`)**: If attempting to reset without verifying OTP first:
  ```json
  {
    "success": false,
    "statusCode": 400,
    "code": "BAD_REQUEST",
    "message": "OTP has not been verified. Please verify OTP first."
  }
  ```
