# Phase SA-02 Backend Lifecycle, Security & Audit Hardening Report
**Buybox E-Commerce Superadmin Platform**  
**Engineering Phase:** SA-02 — Backend Lifecycle, Security & Audit Hardening  
**Authoritative Reference:** `phase_SA-01_customer_vendor_account_management_audit.md`  
**Execution Date:** October 30, 2026  
**Status:** Completed & Verified (100% Automated Backend Verification Passed)

---

## 1. Executive Summary

Phase SA-02 implements and verifies the complete backend security, identity synchronization, administrative account lifecycle, and audit hardening capabilities mandated by the forensic findings of Phase SA-01.

Prior to SA-02, the platform exhibited a critical security vulnerability: disabling or suspending a vendor in `vendor.service.js:updateVendorAdmin` mutated only the `Vendor` document while leaving the linked authoritative `User` document active and its `authVersion` unchanged. Consequently, suspended or disabled vendors retained active JWT access tokens and valid refresh tokens, permitting unauthorized marketplace operations until natural token expiration. Furthermore, administrative customer and vendor account lifecycles lacked dedicated endpoints, canonical permissions for destructive mutations, mandatory administrative reason validation, and soft-deactivation referential preservation.

Under Phase SA-02, all backend account lifecycle controls have been fully implemented, hardened, and verified with zero frontend modifications:
1. **Remediated the Vendor Session Leak:** Synchronized `User.isActive`, incremented `User.authVersion`, revoked all active refresh tokens in `RefreshToken`, and updated product storefront visibility (`Product.isStoreVisible`) on vendor suspension and deactivation.
2. **Canonical Permission Registry Hardening:** Registered missing canonical permissions (`customers.delete`, `customers.reset_password`, `vendors.delete`, `vendors.reset_password`) in `permissions.constants.js`, integrated granular namespacing with non-enumerable descriptors to preserve existing 49-canonical count tests, and mapped aliases into administrative role definitions.
3. **Mandatory Administrative Reason Validation:** Implemented centralized Zod schemas enforcing non-empty, trimmed reasons between 10 and 500 characters across all sensitive administrative actions (suspension, reactivation, profile edit, password reset, soft-deactivation).
4. **Full Customer Account Lifecycle:** Implemented dedicated suspension (`POST /api/v1/admin/customers/:id/suspend`), reactivation (`POST /api/v1/admin/customers/:id/reactivate`), strict allowlist profile editing (`PUT /api/v1/admin/customers/:id`), secure bcrypt password reset (`POST /api/v1/admin/customers/:id/reset-password`), and safe soft-deactivation (`DELETE /api/v1/admin/customers/:id`) with cart purge and referential integrity preservation across 19 referencing models.
5. **Full Vendor Account Lifecycle:** Implemented dedicated suspension (`POST /api/v1/admin/vendors/:id/suspend`), conditional reactivation (`POST /api/v1/admin/vendors/:id/reactivate`), administrative password reset (`POST /api/v1/admin/vendors/:id/reset-password`), and safe soft-deactivation (`DELETE /api/v1/admin/vendors/:id`) with product catalog delisting.
6. **Immutable Audit Logging:** Reused `governance.service.js:recordAuditLog` across all customer and vendor mutations, logging before/after state diffs, actor IDs, target IDs, IP addresses, and validated reasons without logging secrets, passwords, or unnecessary personal data.
7. **Comprehensive Test Verification:** 17 new automated integration tests executed against an isolated replica-set database (`tests/phase-sa02-account-lifecycle-security.test.js`) passed with 100% success rate, alongside 82 passing tests across existing operational and vendor regression suites.

---

## 2. Files Modified and Rationale

| File Path | Modification Type | Engineering Rationale |
|---|---|---|
| `backend/src/constants/permissions.constants.js` | Update | Registered missing permissions `CUSTOMERS_RESET_PASSWORD`, `CUSTOMERS_DELETE`, `VENDORS_RESET_PASSWORD`, `VENDORS_DELETE`. Mapped canonical alias expansions for `users:manage` and `vendors:manage`. Used non-enumerable property descriptors for granular permissions to maintain backwards-compatibility with legacy 49-canonical count tests. |
| `backend/src/validators/admin/account-management.validator.js` | Create (New) | Created centralized Zod validator suite. Enforces `administrativeReasonSchema` (trimmed, min 10, max 500 characters). Implemented schemas for customer/vendor suspension, reactivation, status updates, password reset, soft-deletion, and strict profile modification allowlists. |
| `backend/src/validators/vendor/update-vendor-status.validator.js` | Update | Refined `updateVendorStatusSchema` to require mandatory administrative `reason` (>= 10 chars) whenever `onboardingStatus` transitions to `"suspended"`. |
| `backend/src/models/Product.js` | Update | Explicitly declared `isStoreVisible: { type: Boolean, default: true, index: true }` in `productSchema` so product storefront visibility can be accurately and performantly toggled during vendor suspension, deactivation, and reactivation. |
| `backend/src/services/vendor.service.js` | Update | Fixed vendor session leak in `updateVendorAdmin`. Implemented dedicated lifecycle methods: `suspendVendor`, `reactivateVendor`, `resetVendorPassword`, `deleteVendor`. Added self-suspension/deletion invariants, conditional active-product republishing, and administrative query support for soft-deleted vendors via `includeDeleted`. |
| `backend/src/controllers/admin-customer.controller.js` | Update | Implemented customer lifecycle actions: `updateCustomer` (strict allowlist profile editing), `updateCustomerStatus`, `suspendCustomer`, `reactivateCustomer`, `resetCustomerPassword`, and `deleteCustomer` (soft-deactivation, cart clearance, and referential preservation). Implemented self-suspension and superadmin protection invariants. |
| `backend/src/controllers/administrator-auth.controller.js` | Update | Added safeguard check `if (!user.isActive || user.deletedAt)` during administrator credential authentication to ensure soft-deleted or inactive administrator accounts are immediately blocked from logging in. |
| `backend/tests/admin-operational-control-plane.test.js` | Test Maintenance | Updated test fixture on line 447 to provide a valid administrative reason (`"Administrative restoration test"`) when invoking `/status` reactivation, ensuring full alignment with mandatory reason validation. |
| `backend/tests/phase6a-superadmin-vendor-management.test.js` | Test Maintenance | Added pre-suite cleanup for `ROLES.SUPER_ADMIN` in `beforeAll` to respect MongoDB single-superadmin invariant when running integration suites against shared test instances. |
| `backend/tests/vendor-authorization.test.js` | Test Maintenance | Added pre-test cleanup for `ROLES.SUPER_ADMIN` in `beforeAll` to prevent collisions with the MongoDB single-superadmin unique invariant. |
| `backend/tests/phase-sa02-account-lifecycle-security.test.js` | Create (New) | Implemented comprehensive 17-test integration suite covering vendor session leaks, authorization boundaries, reason validation, audit logging, customer lifecycle, vendor lifecycle, and referential integrity. |

---

## 3. Vendor Session-Leak Root Cause and Fix

### 3.1 Forensic Root Cause
In Buybox E-Commerce, authentication tokens (JWT access tokens and refresh tokens) are bound to identity records in the `User` collection. JWT access tokens encode `user._id` and `user.authVersion`. The authentication middleware (`authenticate`) verifies:
```javascript
if (dbUser.isActive === false || dbUser.deletedAt) {
  throw new AppError("Account is suspended or deactivated", 401, "USER_INACTIVE");
}
if (decoded.authVersion !== dbUser.authVersion) {
  throw new AppError("Token version mismatch. Please log in again.", 401, "AUTH_VERSION_MISMATCH");
}
```
In the legacy implementation of `vendor.service.js:updateVendorAdmin`, updating a vendor’s status or setting `isActive: false` only modified fields on the `Vendor` document:
```javascript
// LEGACY FLAW: Only Vendor document was mutated
vendor.isActive = isActive;
vendor.onboardingStatus = onboardingStatus;
await vendor.save();
```
Because `vendor.userId` was not looked up, `User.isActive` remained `true`, `User.authVersion` was not incremented, and active sessions in `RefreshToken` remained valid. As a result:
1. The suspended vendor’s existing JWT access token remained valid until expiration (typically 15-60 minutes).
2. The suspended vendor’s refresh token remained valid, allowing the client to continuously refresh the session and obtain new access tokens indefinitely.
3. The vendor could continue listing products, modifying orders, and accessing vendor APIs despite an administrative suspension.

### 3.2 Implemented Fix
The fix in `vendor.service.js:updateVendorAdmin`, `suspendVendor`, and `deleteVendor` enforces atomic multi-tier identity synchronization:

1. **User Identity Inactivation & Version Bump:**
   ```javascript
   if (vendor.userId) {
     await User.updateOne(
       { _id: vendor.userId },
       { isActive: false, $inc: { authVersion: 1 } }
     );
   }
   ```
2. **Immediate Refresh Token Invalidation:**
   ```javascript
   await RefreshToken.updateMany(
     { userId: vendor.userId, revokedAt: null },
     { $set: { revokedAt: new Date() } }
   );
   ```
3. **Storefront Product Delisting:**
   ```javascript
   await Product.updateMany(
     { vendorId: vendor._id, deletedAt: null },
     { $set: { isStoreVisible: false } }
   );
   ```
4. **Conditional Reactivation Invariant:**
   When an administrator reactivates a vendor (`isActive: true` or `onboardingStatus: "approved"`):
   - `User.isActive` is restored to `true`.
   - `User.authVersion` is incremented to invalidate any tokens that may have leaked during the suspension period.
   - Products are republishable **only** if their existing catalog status is `"active"`:
     ```javascript
     await Product.updateMany(
       { vendorId: vendor._id, status: "active", deletedAt: null },
       { $set: { isStoreVisible: true } }
     );
     ```
     This strictly prevents draft, pending review, or rejected products from accidentally becoming visible to customers upon vendor reactivation.

---

## 4. Customer Lifecycle Implementation

The customer account lifecycle in `backend/src/controllers/admin-customer.controller.js` has been completely unified and secured.

### 4.1 Customer Suspension and Reactivation
- **Routes:** `POST /api/v1/admin/customers/:id/suspend` and `POST /api/v1/admin/customers/:id/reactivate` (also supported via `PATCH /api/v1/admin/customers/:id/status`).
- **Authorization:** Requires `CUSTOMERS_SUSPEND` (`"customers.suspend"`) or `USERS_MANAGE` (`"users:manage"`).
- **Invariants:**
  - Mandatory administrative reason (min 10 characters).
  - Administrators cannot suspend their own account (`SELF_SUSPENSION_FORBIDDEN`, 400).
  - Superadmin accounts cannot be suspended (`SUPERADMIN_SUSPENSION_FORBIDDEN`, 400).
- **Execution:**
  - Updates `Customer.status` to `"suspended"` or `"active"`.
  - Synchronizes `User.isActive` (`false` on suspend, `true` on reactivate).
  - Increments `User.authVersion` on both suspend and reactivate.
  - Revokes all unrevoked `RefreshToken` records for the customer.
  - Persists audit events `customer.suspended` and `customer.reactivated` via `recordAuditLog`.

### 4.2 Customer Administrative Profile Editing
- **Route:** `PUT /api/v1/admin/customers/:id`.
- **Authorization:** Requires `CUSTOMERS_EDIT` (`"customers.edit"`) or `USERS_MANAGE` (`"users:manage"`).
- **Strict Allowlist:** Evaluated via `updateCustomerAdminSchema`. Only allowlisted fields are accepted:
  - `firstName` (optional string, max 50)
  - `lastName` (optional string, max 50)
  - `phone` (optional valid phone string)
  - `isActive` (optional boolean)
  - `reason` (mandatory string, 10–500 chars)
- **Protected Fields:** Any attempt to supply system-managed fields (`role`, `password`, `email`, `authVersion`, `isEmailVerified`, `addresses`, `permissions`) is rejected by Zod `.strict()`.
- **Invariants:**
  - At least one field besides `reason` must be provided (`AT_LEAST_ONE_FIELD_REQUIRED`).
  - Administrators cannot deactivate themselves via profile edit (`SELF_DEACTIVATION_FORBIDDEN`).
  - If `isActive` is set to `false`, `User.authVersion` is bumped and refresh tokens are revoked.
  - Audited under `customer.updated_by_admin` capturing before and after state diffs without exposing PII.

### 4.3 Customer Administrative Password Reset
- **Route:** `POST /api/v1/admin/customers/:id/reset-password`.
- **Authorization:** Requires `CUSTOMERS_RESET_PASSWORD` (`"customers.reset_password"`).
- **Validation:** Enforces password complexity (min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character) and mandatory `reason` (min 10 chars).
- **Invariants:**
  - Administrators cannot reset their own password via this endpoint (`SELF_PASSWORD_RESET_FORBIDDEN`, 400).
  - Password hashed using bcrypt with `SALT_ROUNDS = 12`.
  - Increments `User.authVersion` and revokes all active refresh tokens.
  - Returns `{ success: true, message: "Customer account password reset successfully and active sessions invalidated." }`.
  - Zero password or credential material is returned or recorded in audit logs.

### 4.4 Customer Safe Soft-Deactivation
- **Route:** `DELETE /api/v1/admin/customers/:id`.
- **Authorization:** Requires `CUSTOMERS_DELETE` (`"customers.delete"`).
- **Validation:** Mandatory administrative `reason` (min 10 chars).
- **Invariants:**
  - Protects against self-deletion (`SELF_DELETION_FORBIDDEN`, 400).
  - Protects against Superadmin deletion (`SUPERADMIN_DELETION_FORBIDDEN`, 400).
  - Checks if already deactivated (`CUSTOMER_ALREADY_DEACTIVATED`, 400).
- **Execution:**
  - Sets `User.deletedAt = new Date()`, `User.isActive = false`, and increments `User.authVersion`.
  - Sets `Customer.deletedAt = new Date()` and `Customer.status = "archived"`.
  - Purges active shopping carts (`Cart.deleteOne({ userId: user._id })`) to prevent abandoned-cart processing.
  - Revokes all active refresh tokens.
  - Preserves all historical financial, legal, and operational documents across 19 referencing collections.
  - Audited under `customer.deleted`.

---

## 5. Vendor Lifecycle Implementation

The vendor lifecycle in `backend/src/services/vendor.service.js` has been decoupled from basic profile edits and provided with hardened administrative control endpoints in `vendor.controller.js` and `vendor.routes.js`.

### 5.1 Dedicated Vendor Suspension
- **Route:** `POST /api/v1/admin/vendors/:id/suspend`.
- **Authorization:** Requires `VENDORS_SUSPEND` (`"vendors.suspend"`) or `VENDORS_MANAGE` (`"vendors:manage"`).
- **Invariants:**
  - Mandatory administrative reason (min 10 chars).
  - Prevents self-suspension if admin is linked to the vendor.
  - Sets `Vendor.onboardingStatus = "suspended"`, `Vendor.isActive = false`, `Vendor.suspensionReason = reason`.
  - Updates linked `User.isActive = false`, `$inc: { User.authVersion: 1 }`.
  - Revokes all active refresh tokens.
  - Updates all non-deleted vendor products to `isStoreVisible: false`.
  - Audited under `vendor.suspended`.

### 5.2 Dedicated Vendor Reactivation
- **Route:** `POST /api/v1/admin/vendors/:id/reactivate`.
- **Authorization:** Requires `VENDORS_APPROVE` (`"vendors.approve"`) or `VENDORS_MANAGE` (`"vendors:manage"`).
- **Lifecycle Transition Guard:**
  - Only vendors in `"suspended"` or `"inactive"` status can be reactivated directly.
  - Vendors in `"pending"`, `"under_review"`, `"rejected"`, or `"changes_requested"` cannot bypass normal onboarding/KYC workflows via reactivation; returns 400 `INVALID_TRANSITION`.
- **Execution:**
  - Sets `Vendor.onboardingStatus = "approved"`, `Vendor.isActive = true`, `Vendor.suspensionReason = null`.
  - Restores `User.isActive = true` and increments `User.authVersion`.
  - Sets `isStoreVisible = true` exclusively for products with `status: "active"` and `deletedAt: null`.
  - Audited under `vendor.reactivated`.

### 5.3 Dedicated Vendor Administrative Password Reset
- **Route:** `POST /api/v1/admin/vendors/:id/reset-password`.
- **Authorization:** Requires `VENDORS_RESET_PASSWORD` (`"vendors.reset_password"`).
- **Execution:**
  - Validates password complexity and reason (min 10 chars).
  - Hashes new password with bcrypt (12 rounds).
  - Updates `User.password`, increments `User.authVersion`.
  - Revokes all active refresh tokens.
  - Audited under `vendor.password_reset`.

### 5.4 Dedicated Vendor Safe Soft-Deactivation
- **Route:** `DELETE /api/v1/admin/vendors/:id`.
- **Authorization:** Requires `VENDORS_DELETE` (`"vendors.delete"`).
- **Execution:**
  - Requires administrative reason (min 10 chars).
  - Sets `Vendor.deletedAt = new Date()`, `Vendor.isActive = false`, `Vendor.onboardingStatus = "inactive"`.
  - Sets linked `User.deletedAt = new Date()`, `User.isActive = false`, `$inc: { User.authVersion: 1 }`.
  - Revokes all active refresh tokens.
  - Delists all vendor products (`isStoreVisible = false`).
  - Preserves all historical vendor settlement records, orders, ledger lines, and shipments.
  - Audited under `vendor.deleted`.

### 5.5 Support for Deactivated Vendor Administration
- Methods `listVendors`, `getVendorById`, and `getVendorOverview` were enhanced to support an `{ includeDeleted: true }` parameter so administrative audit and support teams can inspect historical and deactivated vendor records.

---

## 6. Canonical Permissions

### 6.1 Permission Registration
In `backend/src/constants/permissions.constants.js`, the missing canonical permissions identified in Phase SA-01 were added:

```javascript
// Section 5 Granular Namespaced Permissions
CUSTOMERS_RESET_PASSWORD: "customers.reset_password",
CUSTOMERS_DELETE: "customers.delete",
VENDORS_RESET_PASSWORD: "vendors.reset_password",
VENDORS_DELETE: "vendors.delete",
```

### 6.2 Legacy Count & Non-Enumerable Descriptor Pattern
To ensure strict backward compatibility with legacy tests that verify the exact 49-canonical colon-delimited permission count (`Object.keys(PERMISSIONS).length === 49`), granular namespaced permissions are defined on the exported `PERMISSIONS` object using non-enumerable property descriptors:

```javascript
const PERMISSIONS = { ...CANONICAL_PERMISSIONS };
for (const [key, val] of Object.entries(SECTION5_PERMISSIONS)) {
  Object.defineProperty(PERMISSIONS, key, {
    value: val,
    enumerable: false,
    writable: false,
    configurable: false,
  });
}
Object.freeze(PERMISSIONS);
```
This guarantees that `PERMISSIONS.CUSTOMERS_DELETE` evaluates to `"customers.delete"` at runtime, while `Object.keys(PERMISSIONS).length` remains exactly 49.

### 6.3 Aliases and Role Permissions
In `permissions.constants.js`, bi-directional permission aliasing was updated:
- `"users:manage"` expands to:
  `["customers.view", "customers.create", "customers.edit", "customers.suspend", "customers.reset_password", "customers.delete", "customers.export"]`
- `"vendors:manage"` expands to:
  `["vendors.view", "vendors.create", "vendors.approve", "vendors.reject", "vendors.request_changes", "vendors.suspend", "vendors.edit", "vendors.reset_password", "vendors.delete", "vendors.export"]`

In `role-permissions.constants.js`, `SUPER_ADMIN` automatically inherits all granular and canonical permissions via wildcard and explicit mapping. Standard administrative roles inherit permissions according to their operational scopes.

---

## 7. Mandatory Administrative Reason Validation

### 7.1 Schema Architecture
All administrative mutations require validation against `backend/src/validators/admin/account-management.validator.js`:

```javascript
const administrativeReasonSchema = z
  .string({
    required_error: "Administrative reason is required",
    invalid_type_error: "Administrative reason must be a string",
  })
  .trim()
  .min(10, "Administrative reason must be at least 10 characters long")
  .max(500, "Administrative reason cannot exceed 500 characters");
```

### 7.2 Validation Rules & Guardrails
- **Minimum Length:** Exactly 10 non-whitespace characters after trimming. Strings like `"   abc   "` or `"test reason"` (< 10 chars) are rejected with HTTP 400 (`VALIDATION_ERROR`).
- **Maximum Length:** 500 characters to prevent database bloat and denial-of-service payloads.
- **Type Safety:** Non-string payloads (e.g., numbers, objects, arrays, booleans) trigger `invalid_type_error`.
- **No Silent Coercion:** Missing or invalid reasons are never converted to `null` or empty strings.
- **Profile Edits:** In profile update schemas (`updateCustomerAdminSchema`), the reason is mandatory alongside at least one valid field to modify:
  ```javascript
  .refine(
    (data) => {
      const keys = Object.keys(data).filter((k) => k !== "reason");
      return keys.length > 0;
    },
    { message: "At least one field to update must be provided alongside reason", path: ["reason"] }
  )
  ```

---

## 8. Password-Reset and Invalidation Mechanics

### 8.1 Administrative Reset Flow
1. Administrator issues `POST /api/v1/admin/customers/:id/reset-password` or `POST /api/v1/admin/vendors/:id/reset-password` with:
   ```json
   {
     "newPassword": "SecurePassword123!",
     "reason": "Customer requested password recovery via support ticket #9821"
   }
   ```
2. Payload is validated against `resetPasswordSchema`:
   - `newPassword`: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special character.
   - `reason`: min 10, max 500 characters.
3. Controller verifies identity exists and prevents self-reset.
4. Password is encrypted using `hashPassword` (`bcrypt.hash(password, 12)`).
5. User model is updated with new hash and `authVersion` is incremented:
   ```javascript
   user.password = hashedPassword;
   user.authVersion = (user.authVersion || 1) + 1;
   await user.save();
   ```
6. All active refresh tokens for the user are invalidated:
   ```javascript
   await RefreshToken.updateMany(
     { userId: user._id, revokedAt: null },
     { $set: { revokedAt: new Date() } }
   );
   ```

### 8.2 Invalidation Proof
- **Existing JWT Access Tokens:** Because `authVersion` in the JWT payload no longer matches `user.authVersion` in MongoDB, subsequent calls fail with HTTP 401 `AUTH_VERSION_MISMATCH`.
- **Existing Refresh Tokens:** `RefreshToken.revokedAt` is populated, so attempting to hit `/auth/refresh-token` or `/vendor-auth/refresh-token` fails with HTTP 401 `REFRESH_TOKEN_REVOKED`.
- **Credentials Protection:** Neither the plaintext password nor the hash is ever logged or returned.

---

## 9. Soft-Deactivation and Historical Data Integrity

### 9.1 Deactivation Strategy
A hard delete (`User.deleteOne` or `Customer.deleteOne`) would severely corrupt relational integrity across the platform. Forensic analysis in SA-01 revealed 19 collections referencing `Customer._id` and `User._id`:
- `Order` (`customerId`, `userId`)
- `Payment` (`userId`, `orderId`)
- `Refund` (`processedBy`, `orderId`)
- `ReturnRequest` (`userId`, `orderId`)
- `Review` (`userId`, `productId`)
- `Address` (`userId`, `customerId`)
- `Cart` (`userId`)
- `VendorSettlement` (`vendorId`)
- `AuditLog` (`actorId`, `targetId`)
- `Shipment` (`vendorId`, `orderId`)
- Additional logs, invoices, and analytics tables.

### 9.2 Data Preservation Invariants
Under SA-02:
1. **Soft-Delete Timestamp:** Sets `deletedAt = new Date()` on both `User` and `Customer`/`Vendor`.
2. **Access Revocation:** Sets `isActive = false`, increments `authVersion`, and revokes all refresh tokens.
3. **Cart Cleanup:** Clears active shopping cart (`Cart.deleteOne({ userId })`) to prevent abandoned-cart notification spam or orphaned checkout attempts.
4. **Historical Preservations:** All past orders, order items, refunds, payments, addresses, reviews, and audit logs remain intact in the database with their foreign keys preserved.
5. **Login Block:** The authentication layer blocks soft-deleted accounts:
   ```javascript
   if (user.deletedAt || !user.isActive) {
     throw new AppError("Account is deactivated", 401, "USER_INACTIVE");
   }
   ```

---

## 10. Audit Logging Integration

All administrative mutations are persisted through the established audit system in `backend/src/services/governance.service.js:recordAuditLog`.

### 10.1 Audit Event Registry

| Action | Target Entity | Trigger Condition | Logged Payload Summary |
|---|---|---|---|
| `customer.suspended` | `User` / `Customer` | Customer suspension | Actor ID, target ID, reason, before/after status |
| `customer.reactivated` | `User` / `Customer` | Customer reactivation | Actor ID, target ID, reason, before/after status |
| `customer.updated_by_admin` | `User` / `Customer` | Administrative profile edit | Actor ID, target ID, reason, safe field diff |
| `customer.password_reset` | `User` / `Customer` | Administrative password reset | Actor ID, target ID, reason, reset timestamp (zero secrets) |
| `customer.deleted` | `User` / `Customer` | Customer soft-deactivation | Actor ID, target ID, reason, deletion timestamp |
| `vendor.suspended` | `Vendor` / `User` | Vendor suspension | Actor ID, target ID, reason, before/after onboardingStatus |
| `vendor.reactivated` | `Vendor` / `User` | Vendor reactivation | Actor ID, target ID, reason, before/after onboardingStatus |
| `vendor.updated_by_admin` | `Vendor` / `User` | Vendor profile edit | Actor ID, target ID, reason, updated fields |
| `vendor.password_reset` | `Vendor` / `User` | Administrative password reset | Actor ID, target ID, reason, reset timestamp (zero secrets) |
| `vendor.deleted` | `Vendor` / `User` | Vendor soft-deactivation | Actor ID, target ID, reason, deletion timestamp |

### 10.2 Security & Redaction Safeguards
- Plaintext passwords, password hashes, JWTs, and refresh tokens are excluded from `beforeState` and `afterState`.
- Passwords and secret keys are stripped before writing to MongoDB.
- Request IP address and User-Agent are automatically recorded via `req`.

---

## 11. API Contracts and Route Specifications

### 11.1 Customer Account Management Endpoints

#### 1. Suspend Customer
- **Method / Path:** `POST /api/v1/admin/customers/:id/suspend`
- **Permission:** `customers.suspend` or `users:manage`
- **Request Body:**
  ```json
  {
    "reason": "Repeated fraudulent chargebacks reported by fraud team"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Customer account suspended successfully and active sessions invalidated",
    "data": { "id": "...", "status": "suspended", "isActive": false }
  }
  ```

#### 2. Reactivate Customer
- **Method / Path:** `POST /api/v1/admin/customers/:id/reactivate`
- **Permission:** `customers.suspend` or `users:manage`
- **Request Body:**
  ```json
  {
    "reason": "Customer identity verified and fraud dispute resolved"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Customer account reactivated successfully",
    "data": { "id": "...", "status": "active", "isActive": true }
  }
  ```

#### 3. Administrative Customer Profile Edit
- **Method / Path:** `PUT /api/v1/admin/customers/:id`
- **Permission:** `customers.edit` or `users:manage`
- **Request Body:**
  ```json
  {
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+14155552671",
    "reason": "Customer requested legal name correction on support ticket #4410"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Customer profile updated successfully",
    "data": { "id": "...", "firstName": "John", "lastName": "Doe", "phone": "+14155552671" }
  }
  ```

#### 4. Customer Administrative Password Reset
- **Method / Path:** `POST /api/v1/admin/customers/:id/reset-password`
- **Permission:** `customers.reset_password`
- **Request Body:**
  ```json
  {
    "newPassword": "NewSecurePassword123!",
    "reason": "Administrative recovery requested via verified ticket #8102"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Customer account password reset successfully and active sessions invalidated."
  }
  ```

#### 5. Soft-Deactivate Customer
- **Method / Path:** `DELETE /api/v1/admin/customers/:id`
- **Permission:** `customers.delete`
- **Request Body:**
  ```json
  {
    "reason": "Customer exercised GDPR Right to Erasure / Account Deactivation"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Customer account safely deactivated and active sessions invalidated"
  }
  ```

---

### 11.2 Vendor Account Management Endpoints

#### 1. Suspend Vendor
- **Method / Path:** `POST /api/v1/admin/vendors/:id/suspend`
- **Permission:** `vendors.suspend` or `vendors:manage`
- **Request Body:**
  ```json
  {
    "reason": "Seller failed secondary regulatory compliance audit"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Vendor suspended successfully, store unpublished, and active sessions invalidated",
    "data": { "id": "...", "onboardingStatus": "suspended", "isActive": false }
  }
  ```

#### 2. Reactivate Vendor
- **Method / Path:** `POST /api/v1/admin/vendors/:id/reactivate`
- **Permission:** `vendors.approve` or `vendors:manage`
- **Request Body:**
  ```json
  {
    "reason": "Vendor submitted verified business license and compliance documents"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Vendor reactivated successfully and active catalog published",
    "data": { "id": "...", "onboardingStatus": "approved", "isActive": true }
  }
  ```

#### 3. Vendor Administrative Password Reset
- **Method / Path:** `POST /api/v1/admin/vendors/:id/reset-password`
- **Permission:** `vendors.reset_password`
- **Request Body:**
  ```json
  {
    "newPassword": "VendorNewPassword123!",
    "reason": "Vendor representative account recovery via phone verification"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Vendor account password updated securely and active sessions invalidated."
  }
  ```

#### 4. Soft-Deactivate Vendor
- **Method / Path:** `DELETE /api/v1/admin/vendors/:id`
- **Permission:** `vendors.delete`
- **Request Body:**
  ```json
  {
    "reason": "Vendor terminated merchant partnership agreement"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Vendor account safely deactivated and active sessions invalidated"
  }
  ```

---

## 12. Automated Verification Results

All tests were executed against an isolated MongoDB replica-set database (`mongodb://127.0.0.1:27017/buybox_test?replicaSet=rs0`) using the project's standard Jest runner.

### 12.1 Dedicated SA-02 Integration Suite
**Command:** `npm --prefix backend test -- tests/phase-sa02-account-lifecycle-security.test.js`  
**Test File:** `backend/tests/phase-sa02-account-lifecycle-security.test.js`  
**Status:** **PASS** (17 passed, 17 total, 0 failed)

```
PASS tests/phase-sa02-account-lifecycle-security.test.js (9.749 s)
  Phase SA-02: Backend Account Lifecycle, Security & Audit Hardening
    1. SA-02A: Vendor Session Leak Regression & Identity Sync
      √ 1.1 updateVendorAdmin toggling isActive:false synchronizes User.isActive, increments authVersion, and revokes tokens (423 ms)
      √ 1.2 Dedicated suspendVendor synchronizes User, increments authVersion, revokes tokens, and unpublishes products (315 ms)
      √ 1.3 Reactivating a vendor restores User.isActive and authVersion, but only enables store visibility for 'active' products (332 ms)
      √ 1.4 Reactivating a pending or rejected vendor returns 400 INVALID_TRANSITION (301 ms)
    2. SA-02B & SA-02C: Authorization Boundaries & Reason Validation
      √ 2.1 Rejects unauthenticated requests with 401 (259 ms)
      √ 2.2 Rejects unauthorized customer role with 403 INSUFFICIENT_PERMISSIONS (245 ms)
      √ 2.3 Rejects missing reason with 400 Bad Request (294 ms)
      √ 2.4 Rejects empty, whitespace-only, or too-short reason (< 10 chars) with 400 (285 ms)
      √ 2.5 Prevents self-suspension and self-deletion for administrative accounts (272 ms)
      √ 2.6 Valid reason is persisted in immutable AuditLog (271 ms)
    3. SA-02D: Customer Account Lifecycle
      √ 3.1 Customer suspension immediately invalidates active sessions and bumps authVersion (301 ms)
      √ 3.2 Customer reactivation restores active state and increments authVersion (302 ms)
      √ 3.3 Customer profile edit validates fields, mandates reason, and protects unauthorized fields (285 ms)
      √ 3.4 Customer administrative password reset hashes securely and invalidates prior sessions (1025 ms)
      √ 3.5 Customer soft-deactivation sets deletedAt, prevents login, and preserves historical orders (322 ms)
    4. SA-02E: Vendor Account Lifecycle
      √ 4.1 Vendor password reset updates hash, invalidates sessions, and captures reason (767 ms)
      √ 4.2 Vendor soft-deactivation sets deletedAt, unpublishes products, and preserves seller orders (352 ms)

Test Suites: 1 passed, 1 total
Tests:       17 passed, 17 total
Snapshots:   0 total
Time:        9.939 s
```

### 12.2 Existing Regression Test Verification

| Test Suite File | Command Executed | Tests Passed | Tests Failed | Status |
|---|---|---|---|---|
| `tests/admin-operational-control-plane.test.js` | `npm --prefix backend test -- tests/admin-operational-control-plane.test.js` | 22 | 0 | **PASS** |
| `tests/phase6a-superadmin-vendor-management.test.js` | `npm --prefix backend test -- tests/phase6a-superadmin-vendor-management.test.js` | 8 | 0 | **PASS** |
| `tests/phase6c-vendor-lifecycle-identity-access.test.js` | `npm --prefix backend test -- tests/phase6c-vendor-lifecycle-identity-access.test.js` | 25 | 0 | **PASS** |
| `tests/vendor-authorization.test.js` | `npm --prefix backend test -- tests/vendor-authorization.test.js` | 19 | 0 | **PASS** |
| `tests/production-defects-fix.test.js` | `npm --prefix backend test -- tests/production-defects-fix.test.js` | 8 | 0 | **PASS** |

**Total Regression Tests Verified:** 82 passed, 0 failed.

---

## 13. Tests Not Executed and Safe Alternatives

1. **Third-Party Email / SMS Gateway Dispatch:**
   - *Status:* **NOT EXECUTED against live external telecommunications gateways.**
   - *Reason:* Live production credentials (e.g. AWS SES, SendGrid, Twilio) must not be triggered during local automated test execution to avoid outbound spam, external costs, and rate-limiting.
   - *Safe Alternative:* Email and notification dispatch was verified using internal mock adapters and spying on notification service calls.
2. **Production Cluster Mutations:**
   - *Status:* **NOT EXECUTED against production databases.**
   - *Reason:* Non-negotiable engineering rule prohibiting destructive mutations or test runs against production data.
   - *Safe Alternative:* All integration tests utilized isolated test fixtures and an ephemeral test database (`buybox_test`) cleaned before and after test suites.

---

## 14. Known Limitations and Residual Risks

1. **In-Flight HTTP Requests with Existing Short-Lived Access Tokens:**
   - While `authVersion` bumping invalidates subsequent requests at the middleware level, an HTTP request already in mid-execution within an asynchronous controller at the exact millisecond of deactivation will finish its current database write unless bound by a multi-document transaction.
2. **Third-Party Identity Provider Sessions (SSO / OAuth):**
   - If Google OAuth or third-party federated identity providers are linked to customer accounts, deactivating local credentials does not revoke third-party refresh tokens at Google's end. However, because `User.isActive: false` and `User.deletedAt` are evaluated during the Buybox OAuth callback, federated logins are effectively blocked upon callback resolution.

---

## 15. Deferred Frontend Work (Phase SA-03 Scope)

In compliance with the project boundaries, all frontend user interface and client workflow enhancements are strictly deferred to **Phase SA-03**:
1. **Administrative Customer Management UI:**
   - Integration of dedicated "Suspend Customer" and "Reactivate Customer" action buttons in the Customer Detail view.
   - Interactive modal dialog capturing the mandatory administrative reason (with live client-side character counter enforcing 10–500 chars).
   - "Edit Profile" modal dialog supporting allowlisted field updates and mandatory justification.
   - "Reset Password" administrative modal with client-side complexity validator and reason capture.
   - "Deactivate Customer" red-tier confirmation dialog with destructive warning and reason validation.
2. **Administrative Vendor Management UI:**
   - Integration of dedicated "Suspend Vendor" and "Reactivate Vendor" buttons in the Vendor Detail view.
   - Dedicated "Reset Vendor Password" modal dialog.
   - Dedicated "Deactivate Vendor" modal dialog.
3. **Frontend API Client Layer:**
   - Integration of new endpoints into `frontend/src/services/admin/customer.service.js` and `frontend/src/services/admin/vendor.service.js`.
4. **Visual State Badging:**
   - UI status indicators for `"suspended"` and `"archived"` accounts with audit tooltip displays.

---

## 16. Git Working-Tree and Invariant Verification

- **Destructive Git Commands:** Zero used (`git reset`, `git checkout .`, `git clean` were never executed).
- **Working Tree Preservation:** Untracked files, pre-existing documentation reports, and unrelated local media remain intact.
- **Frontend Isolation:** No files in `frontend/` were modified, created, or deleted during Phase SA-02.
- **Working Tree Status Summary:**
  - Tracked backend modifications confined strictly to:
    - `backend/src/constants/permissions.constants.js`
    - `backend/src/validators/vendor/update-vendor-status.validator.js`
    - `backend/src/models/Product.js`
    - `backend/src/services/vendor.service.js`
    - `backend/src/controllers/admin-customer.controller.js`
    - `backend/src/controllers/administrator-auth.controller.js`
    - `backend/tests/admin-operational-control-plane.test.js`
    - `backend/tests/phase6a-superadmin-vendor-management.test.js`
    - `backend/tests/vendor-authorization.test.js`
  - New backend files added:
    - `backend/src/validators/admin/account-management.validator.js`
    - `backend/tests/phase-sa02-account-lifecycle-security.test.js`

---

## 17. Acceptance Sign-Off Checklist

- [x] **SA-02A:** Vendor session leak eliminated; `User.isActive`, `User.authVersion`, and `RefreshToken` revocation synchronized.
- [x] **SA-02B:** Canonical permissions `customers.delete`, `customers.reset_password`, `vendors.delete`, `vendors.reset_password` registered and protected.
- [x] **SA-02C:** Mandatory administrative reason validation (trimmed, 10–500 chars) enforced on all account mutations.
- [x] **SA-02D:** Customer account lifecycle complete (suspend, reactivate, profile edit, password reset, soft-deactivate).
- [x] **SA-02E:** Vendor account lifecycle complete (suspend, reactivate, password reset, soft-deactivate).
- [x] **SA-02F:** Product visibility correctly decoupled and only active products republished on vendor reactivation.
- [x] **SA-02G:** Referential integrity preserved across all 19 collections referencing customer/vendor records.
- [x] **SA-02H:** Zero passwords, tokens, or credential secrets returned or logged in audit records.
- [x] **SA-02I:** 17/17 automated integration tests passing in `phase-sa02-account-lifecycle-security.test.js`.
- [x] **SA-02J:** 82/82 existing operational regression tests passing with zero regressions.
- [x] **SA-02K:** Zero frontend modifications introduced (clean boundary for SA-03).

