# Buybox Authentication & Authorization Architecture

This document describes the **actual current authentication and authorization architecture** implemented in the Buybox Node.js/Express backend (`backend/src/`). The frontend must align strictly with these mechanisms.

---

## 1. Overview & Token Architecture

Buybox uses a **dual-token JSON Web Token (JWT)** architecture:
1. **Access Token (Short-Lived):**
   * **Duration:** 15 minutes (`JWT_ACCESS_EXPIRES_IN=15m`).
   * **Signing Secret:** `JWT_ACCESS_SECRET`.
   * **Payload Structure:**
     ```json
     {
       "sub": "<userId: ObjectId>",
       "role": "customer | vendor | support | manager | admin | super_admin",
       "type": "access",
       "iat": 1789212000,
       "exp": 1789212900
     }
     ```
   * **Transmission:** Sent in the HTTP `Authorization` header as a Bearer token:
     ```http
     Authorization: Bearer <accessToken>
     ```
   * **Client Storage:** Managed in frontend memory (Zustand auth store) or client storage.

2. **Refresh Token (Long-Lived, Rotating & Tracked in Database):**
   * **Duration:** 7 days (`JWT_REFRESH_EXPIRES_IN=7d`).
   * **Signing Secret:** `JWT_REFRESH_SECRET`.
   * **Payload Structure:**
     ```json
     {
       "sub": "<userId: ObjectId>",
       "type": "refresh",
       "jti": "<uniqueTokenId: nanoid>",
       "iat": 1789212000,
       "exp": 1789218048
     }
     ```
   * **Storage in MongoDB:** Persisted in the `refreshtokens` collection hashed with SHA-256 (`tokenHash`). Tracks `userId`, `familyId`, `ipAddress`, `userAgent`, `expiresAt`, `revokedAt`, and `replacedByTokenHash`.
   * **Cookie Configuration (`backend/src/config/cookie.js`):**
     * **Name:** `refreshToken`
     * **HttpOnly:** `true` (Cannot be accessed by client-side JavaScript)
     * **Path:** `/api/v1/auth` (Browser automatically restricts cookie transmission exclusively to auth routes)
     * **Secure:** `true` in production (`env.NODE_ENV === "production"`)
     * **SameSite:** `strict` in production, `lax` in development/staging
     * **MaxAge:** 7 days (604,800,000 ms)
   * **Fallback Transmission:** The backend accepts `refreshToken` in the JSON request body (`req.body.refreshToken`) as a fallback if cookies are unavailable or blocked by cross-origin policies.

---

## 2. Authentication Flows (Step-by-Step)

### A. User Registration (`POST /api/v1/auth/register`)
1. Frontend sends:
   ```json
   {
     "email": "user@example.com",
     "password": "StrongPassword123!",
     "firstName": "Pritam",
     "lastName": "Mondal"
   }
   ```
2. Backend validates input with Zod (`register.validator.js`):
   * `email`: valid lowercase email
   * `password`: min 8 chars, max 128 chars, requires uppercase, lowercase, digit, and special symbol
   * `firstName`, `lastName`: 1–50 characters
3. Backend hashes password using `bcrypt` (10 rounds).
4. Backend assigns default role: `"customer"` (Users cannot register themselves as admin/vendor via this endpoint).
5. User is created in MongoDB (`isEmailVerified: false`).
6. A single-use email verification token is created in `emailverificationtokens` collection (valid for 24 hours).
7. A background job is enqueued in `notification-outbox` to dispatch an ElasticEmail verification link:
   `${EMAIL_VERIFICATION_BASE_URL}?token=${rawToken}`
8. **Response (HTTP 201):**
   ```json
   {
     "success": true,
     "message": "User registered successfully",
     "data": {
       "user": {
         "id": "65f1a2b3c4d5e6f7a8b9c0d1",
         "email": "user@example.com",
         "firstName": "Pritam",
         "lastName": "Mondal",
         "role": "customer",
         "isEmailVerified": false
       }
     }
   }
   ```
   *Note: Registration does not return tokens or automatically log the user in. The user must proceed to login.*

### B. User Login (`POST /api/v1/auth/login`)
1. Frontend sends credentials:
   ```json
   {
     "email": "user@example.com",
     "password": "StrongPassword123!"
   }
   ```
2. Backend checks if `email` exists and `isActive === true`.
3. Verifies password with `bcrypt.compare`.
4. Updates `lastLoginAt = new Date()`.
5. Generates an `accessToken` (15m) and `refreshToken` (7d).
6. Records the active session in `refreshtokens` collection with a new `familyId`.
7. Sets `Set-Cookie: refreshToken=...; HttpOnly; Path=/api/v1/auth; ...`.
8. **Response (HTTP 200):**
   ```json
   {
     "success": true,
     "message": "Login successful",
     "data": {
       "user": {
         "id": "65f1a2b3c4d5e6f7a8b9c0d1",
         "email": "user@example.com",
         "firstName": "Pritam",
         "lastName": "Mondal",
         "role": "customer",
         "isEmailVerified": true
       },
       "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     }
   }
   ```

### C. Token Rotation & Refresh (`POST /api/v1/auth/refresh`)
1. When the access token expires (or via an Axios response interceptor on HTTP 401 `INVALID_ACCESS_TOKEN`), frontend calls:
   `POST /api/v1/auth/refresh`
   * Browser includes `refreshToken` cookie automatically (or client sends `{ "refreshToken": "..." }` in body).
2. Backend validates token signature and looks up `tokenHash` in `refreshtokens`.
3. **Token Reuse Detection (Security):**
   If the presented refresh token was already revoked (`revokedAt !== null`), the backend detects a **token replay attack**, revokes the entire `familyId` token family, and rejects with HTTP 401 `REFRESH_TOKEN_REUSED`.
4. If valid:
   * Current refresh token is marked revoked and linked to `replacedByTokenHash`.
   * A new `accessToken` and new `refreshToken` are generated in the same family.
   * `Set-Cookie` updates the `refreshToken` cookie.
5. **Response (HTTP 200):**
   ```json
   {
     "success": true,
     "message": "Token refreshed successfully",
     "data": {
       "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     }
   }
   ```

### D. User Logout (`POST /api/v1/auth/logout`)
1. Frontend calls: `POST /api/v1/auth/logout` (with cookie or body `refreshToken`).
2. Backend marks the specific refresh token as revoked (`revokedAt = new Date()`).
3. Clears `refreshToken` cookie (`Max-Age=0`).
4. **Response (HTTP 200):**
   ```json
   {
     "success": true,
     "message": "Logout successful",
     "data": null
   }
   ```

### E. Global Logout / Revoke All Sessions (`POST /api/v1/auth/logout-all`)
1. Requires `Authorization: Bearer <accessToken>`.
2. Backend marks all active tokens for `req.user.id` as revoked in `refreshtokens`.
3. **Response (HTTP 200):**
   ```json
   {
     "success": true,
     "message": "All sessions logged out successfully",
     "data": {
       "revokedCount": 3
     }
   }
   ```

### F. Email Verification (`GET /api/v1/auth/verify-email?token=<token>`)
1. User clicks link from email or frontend passes query parameter `?token=...`.
2. Backend verifies SHA-256 hash of token in `emailverificationtokens`.
3. Checks `expiresAt > Date.now()` and `usedAt === null`.
4. Sets `User.isEmailVerified = true` and marks token as used.
5. **Response (HTTP 200):**
   ```json
   {
     "success": true,
     "message": "Email verified successfully",
     "data": {
       "user": { ... }
     }
   }
   ```

### G. Password Reset Flow
1. **Request Reset (`POST /api/v1/auth/forgot-password`):**
   * Body: `{ "email": "user@example.com" }`
   * Backend generates token in `passwordresettokens` (valid for 1 hour).
   * Enqueues transactional email to user.
   * Returns HTTP 200 with generic success message (to prevent email enumeration).
2. **Execute Reset (`POST /api/v1/auth/reset-password`):**
   * Body: `{ "token": "<tokenFromEmail>", "newPassword": "<NewStrongPassword123!>" }`
   * Backend verifies token hash, sets new bcrypt-hashed password, marks token used.
   * Revokes all existing refresh tokens for the user (forces re-login on all devices).
   * **Response (HTTP 200):** `{ "success": true, "message": "Password reset successfully", "data": { "user": ... } }`

---

## 3. Status of OTP & OAuth in Current Backend

| Mechanism | Current Implementation Status | Frontend Guidance |
| :--- | :--- | :--- |
| **Email Verification** | **IMPLEMENTED** (Token-based link via ElasticEmail) | Use `/auth/verify-email` page to read URL query `token` and trigger verification API. |
| **Password Reset** | **IMPLEMENTED** (Token-based link via ElasticEmail) | Use `/auth/forgot-password` and `/auth/reset-password?token=...`. |
| **Phone/SMS OTP** | **NOT IMPLEMENTED** | Do not invoke or design SMS OTP APIs in the frontend. |
| **Email OTP (6-digit code)** | **NOT IMPLEMENTED** | Token is an alphanumeric cryptographic string, not a numeric OTP. |
| **Google / Social OAuth** | **NOT IMPLEMENTED** | No `/auth/google` or passport/oauth routes exist in the backend. `/auth/callback` in the frontend must remain a placeholder until backend implements OAuth. |

---

## 4. Protected Routes & Middleware Architecture

### Authentication Middleware (`backend/src/middlewares/authentication.middleware.js`)
* Validates `Authorization: Bearer <accessToken>`.
* Verifies JWT signature and `decoded.type === "access"`.
* Attaches user identity to request:
  ```javascript
  req.user = {
    id: decoded.sub,
    role: decoded.role
  };
  ```
* **Error codes:**
  * `401 AUTHENTICATION_REQUIRED`: Header missing.
  * `401 INVALID_AUTHORIZATION_HEADER`: Not `Bearer <token>`.
  * `401 INVALID_ACCESS_TOKEN`: Token expired, malformed, or wrong type.

---

## 5. Role-Based Access Control (RBAC) & Permissions

### Roles Defined in Backend (`backend/src/constants/auth.constants.js`)
1. **`customer`**: Standard storefront consumer.
2. **`vendor`**: Marketplace seller.
3. **`support`**: Customer support staff.
4. **`manager`**: Store and operational manager.
5. **`admin`**: Full platform administrator.
6. **`super_admin`**: Root platform administrator.

### Role Authorization Middleware (`backend/src/middlewares/authorization.middleware.js`)
* **`requireRoles(...allowedRoles)`**: Checks `allowedRoles.includes(req.user.role)`.
  * Failure returns: `403 INSUFFICIENT_ROLE`.
* **`requirePermissions(...requiredPermissions)`**: Resolves `ROLE_PERMISSIONS[req.user.role]` and verifies every required permission is present.
  * Failure returns: `403 INSUFFICIENT_PERMISSIONS`.

### Permissions Matrix (`ROLE_PERMISSIONS`)

| Permission Key | Customer | Vendor | Support | Manager | Admin / Super Admin |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `products:read` | Yes | Yes | Yes | Yes | Yes |
| `products:create` | - | Yes | - | Yes | Yes |
| `products:update` | - | Yes | - | Yes | Yes |
| `products:delete` | - | - | - | - | Yes |
| `orders:read` | Yes | Yes | Yes | Yes | Yes |
| `orders:manage` | - | - | - | Yes | Yes |
| `inventory:read` | - | Yes | - | Yes | Yes |
| `inventory:manage` | - | Yes | - | Yes | Yes |
| `warehouses:read` / `manage` | - | - | - | Yes | Yes |
| `shipments:read_own` / `manage_own` | - | Yes | - | - | Yes |
| `shipments:read` / `manage` | - | - | - | Yes | Yes |
| `users:read` / `users:manage` | - | - | Yes (read) | Yes (read) | Yes (read & manage) |
| `vendors:read` / `vendors:manage` | - | - | Yes (read) | Yes (read) | Yes (read & manage) |
| `payments:read` / `payments:manage` | - | - | - | Yes (read) | Yes (read & manage) |
| `finance:read` / `finance:manage` | - | - | - | Yes | Yes |
| `coupons:read` / `coupons:manage` | - | - | - | Yes | Yes |
| `campaigns:read` / `campaigns:manage` | - | - | - | Yes | Yes |
| `tax:read` / `tax:manage` | - | - | - | Yes | Yes |
| `support_tickets:read` / `manage` | - | - | Yes | Yes | Yes |
| `analytics:read_own` | - | Yes | - | - | Yes |
| `analytics:read` | - | - | - | Yes | Yes |
| `settings:read` / `settings:manage` | - | - | - | - | Yes |
| `reports:read` | - | - | - | Yes | Yes |
| `reviews:read` | Yes | Yes | Yes | Yes | Yes |
| `reviews:manage` | - | Yes | - | Yes | Yes |

---

## 6. Admin Authentication Strategy

There is **no separate admin login endpoint**. Admins, managers, vendors, and support staff log in via `POST /api/v1/auth/login`.

### Frontend Route Protection Strategy:
1. Decode JWT access token or read `user.role` from auth state.
2. If `user.role === 'customer'` attempts to access `/admin/*`:
   * Block access client-side and redirect to `/` or unauthorized page.
3. If `user.role` is `admin`, `manager`, `support`, or `super_admin`:
   * Allow access to `/admin` dashboard.
4. Gate individual admin sidebar modules and action buttons using the permissions array matching the role.
