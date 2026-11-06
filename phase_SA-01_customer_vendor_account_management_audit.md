# BUYBOX E-COMMERCE
# SUPERADMIN CUSTOMER & VENDOR ACCOUNT MANAGEMENT
## PHASE SA-01 — READ-ONLY FORENSIC AUDIT REPORT
### CUSTOMER/VENDOR SUSPEND • REACTIVATE • EDIT • PASSWORD RESET • DELETE
### INVESTIGATION, GAP ANALYSIS & IMPLEMENTATION PLAN

**Audit Phase:** SA-01  
**Execution Mode:** STRICTLY READ-ONLY FORENSIC AUDIT  
**Date:** October 29, 2026  
**Auditor:** Antigravity Forensic Engineering  
**Repository:** `d:\MERN Stack\Buybox-Ecommerce`  
**Git Branch / Commit:** `main` @ `2fb55203e48431095ec00f7bd2f1696ab5339bc1`

---

## 1. EXECUTIVE SUMMARY

This forensic audit was commissioned to evaluate the technical readiness of the Buybox E-Commerce platform for implementing comprehensive Customer and Vendor account management capabilities within the Superadmin dashboard. 

The audit targeted twelve essential administrative capabilities:
1. Suspend customer accounts.
2. Reactivate suspended customer accounts.
3. Edit permitted customer profile information.
4. Securely reset customer passwords.
5. Delete or deactivate customer accounts safely.
6. Suspend vendor accounts.
7. Reactivate suspended vendor accounts.
8. Edit permitted vendor and business profile information.
9. Securely reset vendor passwords.
10. Delete or deactivate vendor accounts safely.
11. Enforce mandatory administrative reasons for all sensitive operational actions.
12. Maintain immutable audit records and strictly enforce backend role- and permission-based authorization.

### Key Forensic Findings

1. **Unified Authentication Identity vs. Profile Decoupling:**  
   The platform implements a unified authentication identity model in [`backend/src/models/User.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/User.js). All actors (`customer`, `vendor`, `admin`, `super_admin`) authenticate against `User`. Role-specific operational profiles are stored in separate collections: [`backend/src/models/Customer.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/Customer.js) and [`backend/src/models/Vendor.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/Vendor.js), both establishing a 1-to-1 relationship via `userId`.
2. **Session Invalidation Discrepancy:**  
   Session revocation is governed by `User.authVersion`. Customer suspension in [`backend/src/controllers/admin-customer.controller.js:525`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/controllers/admin-customer.controller.js#L525) and vendor status suspension in [`backend/src/services/vendor.service.js:1179`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L1179) increment `authVersion`, invalidating active JWTs. However, when a vendor profile is modified via `updateVendorAdmin` ([`backend/src/services/vendor.service.js:1742`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L1742)), toggling `isActive` on the vendor document does *not* synchronize with `User.isActive` and does *not* bump `authVersion`, creating a critical session leak.
3. **Missing Administrative Capabilities for Customers:**  
   There is **NO** backend endpoint or frontend UI for administrative customer password reset (`POST /api/v1/admin/customers/:id/reset-password`). There is **NO** administrative delete or soft-deactivate endpoint (`DELETE /api/v1/admin/customers/:id`).
4. **Missing Administrative Capabilities for Vendors:**  
   There is **NO** administrative delete or soft-deactivate endpoint (`DELETE /api/v1/admin/vendors/:id`). Vendor suspension lacks a dedicated route and UI shortcut button; it is currently only available as an option inside a dropdown in the vendor edit modal.
5. **Absence of Server-Side Reason Enforcement:**  
   While an append-only audit system exists ([`backend/src/models/AuditLog.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/AuditLog.js)), administrative reasons are treated as purely optional (`reason || null`) across all customer and vendor status endpoints. The vendor password reset endpoint ([`backend/src/services/vendor.service.js:1776`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L1776)) does not accept a reason parameter at all. The frontend confirmation dialogs do not collect reasons.
6. **Data Retention & Referential Integrity Hazards:**  
   At least 19 models reference `Customer._id` (e.g., `Order`, `Review`, `Payment`, `Shipment`) and 12 models reference `Vendor._id` (e.g., `Product`, `Order.items.vendorId`, `VendorSettlement`, `FinancialLedgerEntry`). Hard deletion would cause catastrophic referential cascades and violate Indian GST / statutory tax compliance (which requires 7 years of order and invoicing retention). A soft-deactivation and PII-anonymization strategy is strictly mandatory.

---

## 2. REPOSITORY AND WORKING-TREE BASELINE

### 2.1 Project Environment
- **Repository Root:** `d:\MERN Stack\Buybox-Ecommerce`
- **Active Git Branch:** `main`
- **HEAD Commit:** `2fb55203e48431095ec00f7bd2f1696ab5339bc1`
- **Node.js Environment:** Windows x64, Node v20+
- **Architecture:** Full-stack MERN (MongoDB with Mongoose, Express backend, Next.js 14 frontend with TailwindCSS, Vanilla/Lucide UI).

### 2.2 Working Tree Inspection
A read-only baseline check (`git status --short`) confirmed that the repository contains pre-existing untracked and modified files from preceding phases (e.g., storefront merchandising SM1/SM2, fulfillment exceptions, and persistent media reports). 

**Preservation Invariant:**  
No existing files were modified, staged, deleted, or overwritten during this audit. All findings are derived through static code inspection and non-mutating unit tests.

---

## 3. CUSTOMER ACCOUNT FORENSIC AUDIT

### 3.1 Customer Data Models

#### Unified Authentication: `User.js`
- **File Location:** [`backend/src/models/User.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/User.js)
- **Shared Model:** Customers, vendors, staff, and superadmins share the `User` schema.
- **Roles Representation:**
  - `role`: String enum (`customer`, `vendor`, `support`, `manager`, `editor`, `admin`, `super_admin`). Default: `"customer"` ([Line 42-54](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/User.js#L42-L54)).
  - `roles`: Array of String enums. Default: `["customer"]` ([Line 56-69](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/User.js#L56-L69)). Synchronized via `pre('validate')` hook ([Line 135-140](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/User.js#L135-L140)).
- **Account Status Fields:**
  - `isActive`: Boolean, default `true`, indexed ([Line 71-75](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/User.js#L71-L75)).
  - There is **NO** string enum status field (e.g., `suspended`, `banned`, `deleted`) on `User`.
  - There is **NO** `deletedAt` field on `User`.
- **Verification Fields:**
  - `isEmailVerified`: Boolean, default `false` ([Line 77-80](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/User.js#L77-L80)).
  - `isPhoneVerified`: Boolean, default `false` ([Line 82-85](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/User.js#L82-L85)).
- **Security & Versioning Fields:**
  - `password`: String with `{ select: false }` ([Line 21-25](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/User.js#L21-L25)).
  - `authVersion`: Number, default `1`, min `1` ([Line 106-110](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/User.js#L106-L110)). Validated in JWT authentication middleware to revoke sessions upon increment.
  - `permissionVersion`: Number, default `1`, min `1` ([Line 112-116](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/User.js#L112-L116)).
- **Unique Indexes:**
  - `email`: Sparse unique index (`sparse: true, unique: true`, [Line 5-12](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/User.js#L5-L12)).
  - `phone`: Partial unique index (`phone_1`, only indexed when string, [Line 143-150](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/User.js#L143-L150)).
  - `unique_active_superadmin_idx`: Enforces single active superadmin invariant ([Line 163-170](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/User.js#L163-L170)).

#### Customer Domain Profile: `Customer.js`
- **File Location:** [`backend/src/models/Customer.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/Customer.js)
- **Linkage:** 1-to-1 relationship via `userId` (`type: ObjectId, ref: 'User', unique: true, required: true`, [Line 5-11](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/Customer.js#L5-L11)).
- **Profile Fields:** `phone`, `dateOfBirth`, `gender` (enum), `avatar` (`url`, `publicId`), `preferences` (`marketingEmails`, `marketingSms`, `marketingPush`).
- **Status & Deletion:**
  - `isActive`: Boolean, default `true`, indexed ([Line 60-64](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/Customer.js#L60-L64)).
  - `deletedAt`: Date, default `null`, indexed ([Line 66-70](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/Customer.js#L66-L70)).

### 3.2 Backend Lifecycle Implementation

- **Routes:** [`backend/src/routes/admin-customer.routes.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/routes/admin-customer.routes.js)
  - `GET /` — `listCustomers` (requires `CUSTOMERS_VIEW`)
  - `GET /:id` — `getCustomer` (requires `CUSTOMERS_VIEW`)
  - `POST /:id/gift-card` — `issueGiftCard` (requires `CUSTOMERS_EDIT`)
  - `PATCH /:id` — `updateCustomer` (requires `CUSTOMERS_EDIT`)
  - `PATCH /:id/status` — `updateCustomerStatus` (requires `CUSTOMERS_SUSPEND`)
  - `POST /:id/suspend` — `suspendCustomer` (requires `CUSTOMERS_SUSPEND`)
  - `POST /:id/reactivate` — `reactivateCustomer` (requires `CUSTOMERS_SUSPEND`)
- **Controller:** [`backend/src/controllers/admin-customer.controller.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/controllers/admin-customer.controller.js)
  - **Account Status Modification:**  
    [`updateCustomerStatus`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/controllers/admin-customer.controller.js#L507) toggles `User.isActive` and `Customer.isActive`. If `isActive === false`, it increments `user.authVersion` ([Line 525](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/controllers/admin-customer.controller.js#L525)), terminating all active customer JWTs.
  - **Audit Logging:**  
    Records `customer.suspended` or `customer.reactivated` via `recordAuditLog` ([Line 533-541](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/controllers/admin-customer.controller.js#L533-L541)).
  - **DEFECT / GAP 1 — Optional Reason:**  
    `reason` is extracted from `req.body.reason` ([Line 510](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/controllers/admin-customer.controller.js#L510)) and stored as `reason: reason || null`. It is completely optional; no validation schema or length check is enforced.
  - **DEFECT / GAP 2 — No Password Reset Endpoint:**  
    Neither `admin-customer.routes.js` nor `admin-customer.controller.js` implements an administrative password reset endpoint for customers.
  - **DEFECT / GAP 3 — No Deletion / Deactivation Endpoint:**  
    No `DELETE /:id` route exists in `admin-customer.routes.js`. Neither `User` nor `Customer` can be soft-deleted or deactivated through the admin API.
  - **Permitted Fields for Edit:**  
    [`updateCustomer`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/controllers/admin-customer.controller.js#L419) accepts `firstName`, `lastName`, `phone`, and `isActive`. It does not accept `email` (protecting against account takeover). It records `customer.updated_by_admin` audit log, but does not capture or validate an administrative reason.

### 3.3 Superadmin Frontend Customer Interface

- **List Page:** [`frontend/src/app/administrator/customers/page.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/customers/page.js)
  - Displays customer directory table with search, status filters (Active/Suspended, Verified/Pending), order count, total spend, and registration date.
  - Row actions ([Line 261-279](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/customers/page.js#L261-L279)): "Inspect" link and "Suspend" / "Reactivate" button.
  - Status confirmation is handled by `ConfirmDialog` ([Line 321-338](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/customers/page.js#L321-L338)), which **does not provide any text input to collect an administrative reason**.
  - No delete action or password reset action exists in the table.
- **Detail Page:** [`frontend/src/app/administrator/customers/[id]/page.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/customers/%5Bid%5D/page.js)
  - Provides rich tabs: Customer Overview (KPIs), Orders, Addresses, Gift Cards, and Coupons.
  - Action Header: "Edit Customer" button and "Suspend" / "Reactivate" button.
  - Edit Modal ([Line 475-550](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/customers/%5Bid%5D/page.js#L475-L550)): Allows editing First Name, Last Name, Phone, and Account Status (`isActive`). **Does not collect a reason for profile edits.**
  - **MISSING in UI:** No "Reset Password" button or modal. No "Delete Customer" button or modal.
- **Frontend Service:** [`frontend/src/services/admin/admin.service.js:123`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/services/admin/admin.service.js#L123) (`adminCustomerService`):
  - Exposes `list`, `get`, `updateStatus`, `suspend`, `reactivate`, `issueGiftCard`, `update`.
  - Lacks `resetPassword` and `delete`.

---

## 4. VENDOR ACCOUNT FORENSIC AUDIT

### 4.1 Vendor Data Model & Ownership Architecture

- **File Location:** [`backend/src/models/Vendor.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/Vendor.js)
- **Identity Linkage:**
  - `userId`: `type: ObjectId, ref: 'User', required: true, unique: true` ([Line 5-11](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/Vendor.js#L5-L11)). 
  - Each vendor organization is strictly owned by one canonical `User` record. (There is currently no multi-user / team access model on the `Vendor` document; vendor staff delegation is handled through `Employee` or separate modules).
- **Onboarding & Account Lifecycle States:**
  - `onboardingStatus`: String enum ([Line 50-61](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/Vendor.js#L50-L61)):
    - `pending`
    - `under_review`
    - `approved`
    - `rejected`
    - `changes_requested`
    - `suspended`
    - `inactive`
  - `isActive`: Boolean, default `false`, indexed ([Line 87-91](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/Vendor.js#L87-L91)).
  - `deletedAt`: Date, default `null`, indexed ([Line 93-97](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/Vendor.js#L93-L97)).
  - Specific reason fields: `rejectionReason` (String), `changesRequestedReason` (String).
- **Operational Settings:**
  - `commissionRate`: Number, default `10`, min `0`, max `100` ([Line 78-85](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/Vendor.js#L78-L85)).
  - `taxInformation`: `{ taxId, taxType }`.
  - `businessAddress`: Subdocument with street, city, state, postalCode, country.
- **Identification & Slugs:**
  - `businessName`: String, required.
  - `businessSlug`: Unique slug generated from `businessName`.
  - Secure Obfuscation: Uses `encodeSecureId('vendor', _id)` / `decodeSecureId` for external API routing.

### 4.2 Vendor Operational Dependencies & Lifecycle Impacts

Vendor suspension or deletion directly impacts critical commerce operations across the repository:

1. **Catalog Products & Storefront Visibility:**  
   In [`backend/src/services/vendor.service.js:1184-1195`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L1184-L1195), when a vendor's status changes to `suspended` or `rejected`, the service executes:
   ```javascript
   await Product.updateMany(
     { vendorId: vendor._id, deletedAt: null },
     { $set: { isStoreVisible: false } }
   );
   ```
   This immediately hides all catalog items from search, category browsing, and merchandising carousels.
2. **Session Invalidation:**  
   In [`backend/src/services/vendor.service.js:1172-1182`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L1172-L1182), status transitions to suspended update `User.isActive = false` and `$inc: { authVersion: 1 }`, instantly terminating merchant dashboard sessions.
3. **DEFECT — Session Leak on Profile Edit:**  
   In [`backend/src/services/vendor.service.js:1742`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L1742) (`updateVendorAdmin`), if an administrator toggles `isActive: false`, the code only mutates `vendor.isActive`. It fails to update `User.isActive` and fails to bump `User.authVersion`. The vendor user can continue to authenticate and operate!
4. **Active Orders & Fulfillments:**  
   Orders reference `items.vendorId` ([`backend/src/models/Order.js:30`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/Order.js#L30)). Existing placed orders must continue fulfillment or undergo administrative re-routing / cancellation. Suspending a vendor must not invalidate pending order history.
5. **Settlements, Balances & Payouts:**  
   [`backend/src/models/VendorSettlement.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/VendorSettlement.js) and [`backend/src/models/FinancialLedgerEntry.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/FinancialLedgerEntry.js) maintain immutable accounting balances. Suspending a vendor pauses future payout disbursements without destroying the accrued ledger balances.

### 4.3 Vendor Administration Interface

- **List Page:** [`frontend/src/app/administrator/vendors/page.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/vendors/page.js)
  - Features status filter tabs (All, Pending, Approved, Changes Requested, Suspended/Inactive).
  - Row actions: Only provides "Inspect Profile" / "Review Application".
  - **MISSING:** No quick row actions for Suspend, Reactivate, Password Reset, or Delete.
- **Detail Page:** [`frontend/src/app/administrator/vendors/[id]/page.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/vendors/%5Bid%5D/page.js)
  - Provides comprehensive overview tabs: Overview (12 KPIs), Contact & Identity, Business & Tax, Documents, Financial, Products, and Orders.
  - Action Modals:
    - Approve Modal ([Line 1553-1590](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/vendors/%5Bid%5D/page.js#L1553-L1590))
    - Request Changes Modal ([Line 1593-1644](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/vendors/%5Bid%5D/page.js#L1593-L1644)) — mandates change reason.
    - Reject Modal ([Line 1647-1698](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/vendors/%5Bid%5D/page.js#L1647-L1698)) — mandates rejection reason.
    - Reset Password Modal ([Line 1700-1764](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/vendors/%5Bid%5D/page.js#L1700-L1764)) — prompts for new password (min 8 chars), **but does not collect an administrative reason**.
    - Edit Vendor Modal ([Line 1380-1549](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/vendors/%5Bid%5D/page.js#L1380-L1549)) — contains an `onboardingStatus` dropdown including "suspended".
  - **MISSING in UI:**
    - No dedicated, prominent "Suspend Vendor" button with confirmation and reason prompt.
    - No dedicated "Reactivate Vendor" button.
    - No "Delete / Deactivate Vendor" action.

---

## 5. PASSWORD MANAGEMENT AND AUTHENTICATION SECURITY

### 5.1 Architecture & Password Hashing
- **Hashing Algorithm:** Uses `bcrypt` with `SALT_ROUNDS = 12` ([`backend/src/utils/password.js:4`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/utils/password.js#L4)).
- **Leakage Prevention:** `password` in `User.js` has `{ select: false }`. All controller projections explicitly omit passwords. Audit log scrubbers in [`backend/src/services/governance.service.js:37-65`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/governance.service.js#L37-L65) strip `password`, `passwordHash`, `refreshToken`, and tokens before writing logs.
- **Plaintext Password Prohibition:** Plaintext passwords are never returned in APIs or retained in client state.

### 5.2 Password Reset Flows

1. **Self-Service Customer / Vendor Reset (Tokens):**  
   Implemented via `POST /api/v1/auth/forgot-password` and `POST /api/v1/auth/reset-password` ([`backend/src/services/auth.service.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/auth.service.js)). Generates a cryptographic SHA-256 token with a 1-hour expiration window.
2. **Administrative Direct Set-Password (Vendor):**  
   - Implemented at `POST /api/v1/admin/vendors/:id/reset-password` ([`backend/src/routes/vendor.routes.js:420`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/routes/vendor.routes.js#L420)).
   - In [`backend/src/services/vendor.service.js:1776-1808`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L1776-L1808):
     - Validates that actor is `super_admin` or `admin`.
     - Hashes new password via `hashPassword(newPassword)`.
     - Increments `user.authVersion = (user.authVersion || 1) + 1`.
     - Records audit log `vendor.password_reset`.
   - **DEFECT:** Does not accept, require, or log an administrative reason for the credential reset.
3. **Administrative Direct Set-Password (Customer):**  
   - **MISSING:** Completely absent in backend routes and controllers.

---

## 6. RBAC/PBAC AND SUPERADMIN AUTHORIZATION

### 6.1 Role & Permission Model
- **Canonical & Granular Permissions:** Defined in [`backend/src/constants/permissions.constants.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/constants/permissions.constants.js).
  - Customer permissions:
    - `customers.view` (alias: `users:read`)
    - `customers.create` (alias: `users:manage`)
    - `customers.edit` (alias: `users:manage`)
    - `customers.suspend` (alias: `users:manage`)
    - `customers.export` (alias: `users:read`)
    - **MISSING:** No canonical `customers.delete` or `customers.reset_password`.
  - Vendor permissions:
    - `vendors.view` (alias: `vendors:read`)
    - `vendors.approve` (alias: `vendors:manage`)
    - `vendors.reject` (alias: `vendors:manage`)
    - `vendors.request_changes` (alias: `vendors:manage`)
    - `vendors.suspend` (alias: `vendors:manage`)
    - `vendors.edit` (alias: `vendors:manage`)
    - `vendors.export` (alias: `vendors:read`)
    - **MISSING:** No canonical `vendors.delete` or `vendors.reset_password`.
- **Enforcement Middleware:** [`backend/src/middlewares/authorization.middleware.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/middlewares/authorization.middleware.js)
  - `requirePermissions(...requiredPermissions)`:
    - Normalizes and checks Superadmin bypass via `isSuperAdmin(req.user.role)` ([Line 46-52](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/middlewares/authorization.middleware.js#L46-L52)).
    - For employees, dynamically resolves active roles, direct grants, and direct restrictions via `getEffectivePermissions(req.user.id)`.
    - If `isPermissionFresh === false`, rejects stale token claims and re-verifies directly against the database.
    - Prevents cross-domain privilege escalation (never grants staff privileges to customer or vendor accounts).
- **Single Active Superadmin Invariant:**  
  [`backend/src/models/User.js:163-186`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/User.js#L163-L186) enforces via unique partial index and `pre('save')` hook that exactly one active Superadmin may exist on the platform.

---

## 7. REASONS, AUDIT LOGGING, AND ACCOUNTABILITY

### 7.1 Authoritative Audit Model
- **File Location:** [`backend/src/models/AuditLog.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/AuditLog.js)
- **Schema Fields:**
  - `actorId`: ObjectId (ref: `User`), required, indexed.
  - `targetId`: ObjectId (indexed).
  - `action`: String, required, indexed.
  - `entityType`: String, required, indexed.
  - `beforeState`: Mixed.
  - `afterState`: Mixed.
  - `ipAddress`: String.
  - `userAgent`: String.
  - `createdAt`: Date, immutable.
- **Append-Only Immutability Enforcement:**  
  Mongoose pre-hooks throw fatal errors if updates or deletions are attempted:
  - `pre('save')` rejects if `!this.isNew` ([Line 65-71](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/AuditLog.js#L65-L71)).
  - `pre(['updateOne', 'updateMany', ...])` throws error ([Line 73-80](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/AuditLog.js#L73-L80)).
  - `pre(['deleteOne', 'deleteMany', ...])` throws error ([Line 82-89](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/AuditLog.js#L82-L89)).

### 7.2 Reason Capture Gap Analysis
- While `beforeState` and `afterState` capture changed state, the system currently embeds reasons haphazardly inside `afterState.reason`.
- **CRITICAL GAP:** There is no server-side validator requiring `reason` for sensitive mutations:
  - Customer suspension: `reason: reason || null` (optional).
  - Customer profile edit: reason omitted entirely.
  - Vendor suspension: reason omitted or optional.
  - Vendor password reset: reason parameter not accepted.
  - Vendor profile edit: reason omitted.
- **Architecture Recommendation:** Sensitive administrative mutations must mandate a validated `reason` string (min 10 characters, max 500 characters) on the backend, persisting it into `afterState.reason` and dedicated audit records.

---

## 8. DELETE, DEACTIVATE, AND DATA RETENTION

### 8.1 Foreign Key & Document Dependency Topology

An exhaustive audit of collection references reveals heavy relational dependencies:

| Entity Type | Dependent Collections & References | Consequences of Hard Deletion |
|---|---|---|
| **Customer** (`User._id` / `Customer._id`) | 19 Models: `Order.customerId`, `Cart.customerId`, `Wishlist.customerId`, `Review.customerId`, `Refund.customerId`, `ReturnRequest.customerId`, `SupportTicket.customerId`, `Shipment.customerId`, `GiftCard.customerId`, `Address.userId`, etc. | Broken customer order history, orphaned returns/refunds, invalid review attributions, crashes on order detail rendering (`Order.customerId` populated). Violates GST retention requirements. |
| **Vendor** (`User._id` / `Vendor._id`) | 12 Models: `Product.vendorId`, `Order.items.vendorId`, `VendorSettlement.vendorId`, `VendorPayout.vendorId`, `FinancialLedgerEntry.vendorId`, `Shipment.vendorId`, `ReturnRequest.vendorId`, `FulfillmentException.vendorId`, etc. | Orphaned catalog listings, broken order item seller attribution, corrupted accounting ledgers and settlement disputes, loss of audit trail for payout disbursement. |

### 8.2 Lifecycle & Retention Recommendations

1. **Strict Prohibition of Hard Deletion:**  
   Hard deletion (`User.deleteOne` / `Customer.deleteOne` / `Vendor.deleteOne`) is strictly prohibited for any account that has transaction history, orders, products, or financial entries.
2. **Safe Deactivation / Soft Deletion Lifecycle:**
   - Set `isActive: false`.
   - Set `deletedAt: new Date()` on both `Customer`/`Vendor` and `User`. (Requires adding `deletedAt` to `User.js`).
   - Bump `authVersion: (authVersion || 1) + 1` to immediately reject existing authentication tokens.
   - For Vendors: Automatically unpublish products (`Product.updateMany({ vendorId }, { isStoreVisible: false })`), set `onboardingStatus: 'inactive'`, and flag pending orders for operational review.
   - For Customers: Invalidate active carts and checkout sessions.
3. **Anonymization for "Right to be Forgotten" (GDPR / DPDP Compliance):**  
   If an account deletion is legally requested:
   - Scrub personally identifiable information (PII) from `User` and `Customer`: replace name with `Deactivated Customer`, wipe avatar, date of birth, addresses.
   - Free unique constraints: update `email` to `deleted_${Date.now()}_${user._id}@deleted.buybox.internal` and `phone = null`, allowing the former customer to register anew if desired.
   - Retain immutable financial records (`Order`, `VendorSettlement`, `FinancialLedgerEntry`) for the statutory 7-year retention period.

---

## 9. CUSTOMER CAPABILITY GAP MATRIX

| Capability | Existing UI | Existing API | Backend Authorization | Audit / Reason | Finding | Evidence |
|---|---|---|---|---|---|---|
| **List & Search** | `frontend/.../customers/page.js` | `GET /api/v1/admin/customers` | `CUSTOMERS_VIEW` | N/A | **IMPLEMENTED** | [`admin-customer.controller.js:24`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/controllers/admin-customer.controller.js#L24) |
| **Detail View** | `frontend/.../customers/[id]/page.js` | `GET /api/v1/admin/customers/:id` | `CUSTOMERS_VIEW` | N/A | **IMPLEMENTED** | [`admin-customer.controller.js:154`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/controllers/admin-customer.controller.js#L154) |
| **Edit Profile** | Modal in `customers/[id]/page.js` | `PATCH /api/v1/admin/customers/:id` | `CUSTOMERS_EDIT` | Logged / No Reason | **PARTIAL** | [`admin-customer.controller.js:419`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/controllers/admin-customer.controller.js#L419) (No reason field) |
| **Suspend Account** | Table button & detail button | `POST /:id/suspend` & `PATCH /:id/status` | `CUSTOMERS_SUSPEND` | Logged / Optional Reason | **PARTIAL** | [`admin-customer.controller.js:507`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/controllers/admin-customer.controller.js#L507) (`reason || null`) |
| **Reactivate Account** | Table button & detail button | `POST /:id/reactivate` & `PATCH /:id/status` | `CUSTOMERS_SUSPEND` | Logged / Optional Reason | **PARTIAL** | [`admin-customer.controller.js:567`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/controllers/admin-customer.controller.js#L567) |
| **Password Reset** | None | None | None | None | **MISSING** | No route in [`admin-customer.routes.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/routes/admin-customer.routes.js) |
| **Delete / Deactivate** | None | None | None | None | **MISSING** | No delete route or soft-delete handler |
| **Action Reason Capture** | None | Optional on status endpoint | N/A | Missing server validation | **DEFECTIVE** | `ConfirmDialog` collects no text input; API accepts empty reason |
| **Session Invalidation** | N/A | `user.authVersion` bumped on suspend | N/A | Logged in status update | **IMPLEMENTED** | [`admin-customer.controller.js:525`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/controllers/admin-customer.controller.js#L525) |

---

## 10. VENDOR CAPABILITY GAP MATRIX

| Capability | Existing UI | Existing API | Backend Authorization | Audit / Reason | Finding | Evidence |
|---|---|---|---|---|---|---|
| **List & Search** | `frontend/.../vendors/page.js` | `GET /api/v1/admin/vendors` | `VENDORS_VIEW` | N/A | **IMPLEMENTED** | [`vendor.routes.js:351`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/routes/vendor.routes.js#L351), [`vendor.service.js:498`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L498) |
| **Detail & Overview** | `frontend/.../vendors/[id]/page.js` | `GET /api/v1/admin/vendors/:id/overview` | `VENDORS_VIEW` | N/A | **IMPLEMENTED** | [`vendor.routes.js:400`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/routes/vendor.routes.js#L400), [`vendor.service.js:1214`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L1214) |
| **Edit Profile & Business** | Modal in `vendors/[id]/page.js` | `PATCH /api/v1/admin/vendors/:id` | `VENDORS_MANAGE` | Logged / No Reason | **PARTIAL** | [`vendor.service.js:1727`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L1727) (Does not sync User status) |
| **Suspend Vendor** | Dropdown option in Edit modal | `PATCH /api/v1/admin/vendors/:id/status` | `VENDORS_MANAGE` | Logged / No Reason | **PARTIAL** | [`vendor.service.js:1137`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L1137) (No dedicated route or UI button) |
| **Reactivate Vendor** | Set status to approved in Edit modal | `PATCH /api/v1/admin/vendors/:id/status` | `VENDORS_MANAGE` | Logged / No Reason | **PARTIAL** | [`vendor.service.js:1166`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L1166) |
| **Reset Password** | Modal in `vendors/[id]/page.js` | `POST /:id/reset-password` | `VENDORS_MANAGE` | Logged / No Reason | **PARTIAL** | [`vendor.service.js:1776`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L1776) (Omits reason; lacks tests) |
| **Delete / Deactivate** | None | None | None | None | **MISSING** | No route in [`vendor.routes.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/routes/vendor.routes.js) |
| **Action Reason Capture** | Rejection/Changes modals collect reason | Enforced only on reject/request-changes | N/A | Unenforced on suspend/reset | **DEFECTIVE** | Suspend, reactivate, and reset-password do not enforce reason |
| **Session Invalidation** | N/A | Bumps `authVersion` on status update & reset | N/A | Tested | **PARTIAL** | Works in `updateVendorStatus`, but omitted in `updateVendorAdmin` |

---

## 11. SECURITY RISKS RANKED BY SEVERITY

### CRITICAL SEVERITY
1. **Vendor Deactivation Bypass via Profile Edit (`updateVendorAdmin`):**  
   If an administrator sets `isActive: false` via `PATCH /api/v1/admin/vendors/:id`, [`backend/src/services/vendor.service.js:1742`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L1742) updates `Vendor.isActive = false`, but **fails** to update `User.isActive = false` and **fails** to increment `User.authVersion`. The vendor's access tokens remain fully active, allowing unauthorized catalog mutations.

### HIGH SEVERITY
2. **Missing Customer Password Reset Endpoint:**  
   Superadmins cannot assist locked-out or compromised customers via the admin console, leading to support blockages or potential temptation to employ un-audited manual database manipulations.
3. **Absence of Server-Side Reason Validation on Sensitive Operations:**  
   Account suspension, reactivation, and credential resets can currently be triggered with null or empty reasons. In an enterprise governance context, unaccountable administrative actions create severe liability and hinder internal audit tracing.
4. **Hard-Deletion Referential Cascade Hazard:**  
   Because no safe administrative soft-deletion workflow exists, any developer or administrator attempting to purge accounts via database scripts risks orphaning 19 customer-linked collections and 12 vendor-linked collections, violating Indian tax regulations and breaking order processing.

### MEDIUM SEVERITY
5. **No Dedicated Superadmin UI Buttons for Vendor Suspension/Reactivation:**  
   Vendor suspension is buried within the `onboardingStatus` select dropdown in the Edit Vendor modal, creating operational confusion and risking accidental status changes.
6. **Customer Edit Omits Audit Reason:**  
   When updating customer contact information (`phone`, `name`), no administrative justification is recorded.

### LOW SEVERITY
7. **Permission Key Discrepancies:**  
   In [`admin-customer.routes.js:29`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/routes/admin-customer.routes.js#L29), `PERMISSIONS.CUSTOMERS_MANAGE` is referenced but is not defined in `CANONICAL_PERMISSIONS` (evaluating to `undefined` and falling back to `CUSTOMERS_EDIT`).

---

## 12. EXISTING TESTS AND VERIFIED RESULTS

### 12.1 Static Code & Suite Audit
- **Customer Tests:**  
  [`backend/tests/admin-operational-control-plane.test.js:415-461`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/tests/admin-operational-control-plane.test.js#L415-L461) tests customer detail retrieval and status toggling. Line 447 confirms that status restore succeeds without supplying a reason.
- **Vendor Tests:**  
  [`backend/tests/phase6a-superadmin-vendor-management.test.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/tests/phase6a-superadmin-vendor-management.test.js) tests listing, overview KPIs, and data sanitization.  
  [`backend/tests/phase6c-vendor-lifecycle-identity-access.test.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/tests/phase6c-vendor-lifecycle-identity-access.test.js) tests onboarding status transitions.
- **Test Gap:**  
  There are **ZERO** tests for administrative vendor password reset (`POST /api/v1/admin/vendors/:id/reset-password`). There are **ZERO** tests for customer password reset or account deletion.

### 12.2 Safe Unit Test Execution
- **Command:** `node --test frontend/tests/unit/production-defects-frontend.test.js`
- **Result:** **PASSED** (7 tests, 5 suites, 0 failed, 529ms). Verified that `adminCustomerService.get` unwraps customer details correctly without blank states.
- **Integration Tests:** Integration tests requiring write operations to MongoDB test instances were marked **NOT EXECUTED** in accordance with Section 2 rules.

---

## 13. EXACT IMPLEMENTATION FILES REQUIRING CHANGES

### Backend Implementation Targets
1. [`backend/src/constants/permissions.constants.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/constants/permissions.constants.js) — Add explicit canonical permissions: `CUSTOMERS_DELETE: 'customers.delete'`, `CUSTOMERS_RESET_PASSWORD: 'customers.reset_password'`, `VENDORS_DELETE: 'vendors.delete'`, `VENDORS_RESET_PASSWORD: 'vendors.reset_password'`.
2. [`backend/src/models/User.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/User.js) — Add `deletedAt: { type: Date, default: null, index: true }`.
3. [`backend/src/routes/admin-customer.routes.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/routes/admin-customer.routes.js) — Add `POST /:id/reset-password` and `DELETE /:id`.
4. [`backend/src/controllers/admin-customer.controller.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/controllers/admin-customer.controller.js) — Implement `resetCustomerPassword`, `deleteCustomer`, and enforce mandatory `reason` on status changes.
5. [`backend/src/routes/vendor.routes.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/routes/vendor.routes.js) — Add `POST /:id/suspend`, `POST /:id/reactivate`, `DELETE /:id`.
6. [`backend/src/controllers/vendor.controller.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/controllers/vendor.controller.js) — Add suspend/reactivate handlers, delete handler, and pass `reason` to reset password.
7. [`backend/src/services/vendor.service.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js) — Fix `updateVendorAdmin` session leak; update `resetVendorPassword` to mandate `reason`; implement `deleteVendor`.

### Frontend Implementation Targets
1. [`frontend/src/services/admin/admin.service.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/services/admin/admin.service.js) — Add `resetPassword(id, newPassword, reason)` and `delete(id, reason)` to `adminCustomerService`.
2. [`frontend/src/services/admin/vendor.service.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/services/admin/vendor.service.js) — Add `suspendVendor(id, reason)`, `reactivateVendor(id, reason)`, `deleteVendor(id, reason)`, and update `resetVendorPassword(id, newPassword, reason)`.
3. [`frontend/src/app/administrator/customers/page.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/customers/page.js) — Update `ConfirmDialog` or add ReasonModal for Suspend/Reactivate.
4. [`frontend/src/app/administrator/customers/[id]/page.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/customers/%5Bid%5D/page.js) — Add "Reset Password" and "Delete Account" buttons, modals with mandatory reason inputs.
5. [`frontend/src/app/administrator/vendors/page.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/vendors/page.js) — Add table row actions for Suspend/Reactivate with reason prompt.
6. [`frontend/src/app/administrator/vendors/[id]/page.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/vendors/%5Bid%5D/page.js) — Add dedicated "Suspend Vendor", "Reactivate Vendor", and "Deactivate/Delete Vendor" action buttons and modals. Update Reset Password modal to require an administrative reason.

---

## 14. RECOMMENDED IMPLEMENTATION ROADMAP (SA-02 → SA-03 → SA-04)

### Phase SA-02: Backend Lifecycle, Security & Audit Hardening
1. **Permissions & Model Extensions:**
   - Define `customers.delete`, `customers.reset_password`, `vendors.delete`, `vendors.reset_password` in `permissions.constants.js`.
   - Add indexed `deletedAt: Date` to `User.js`.
2. **Authoritative Reason Enforcement:**
   - Create a reusable request validator `validateReason({ minLength: 10, maxLength: 500 })` for sensitive admin actions.
3. **Customer Account Endpoints:**
   - Implement `POST /api/v1/admin/customers/:id/reset-password`: Hashing with bcrypt (12 rounds), session invalidation (`authVersion++`), mandatory reason, audit log.
   - Implement `DELETE /api/v1/admin/customers/:id`: Safe soft-deactivation (`deletedAt: new Date()`, `isActive: false`, `authVersion++`, cart invalidation, mandatory reason, audit log).
   - Enforce mandatory `reason` on `POST /:id/suspend`, `POST /:id/reactivate`, and `PATCH /:id/status`.
4. **Vendor Account Endpoints & Bug Fixes:**
   - Fix session leak in `vendor.service.js:updateVendorAdmin` by synchronizing `User.isActive` and incrementing `User.authVersion`.
   - Update `vendor.service.js:resetVendorPassword` to accept, validate, and record `reason`.
   - Add dedicated endpoints `POST /api/v1/admin/vendors/:id/suspend` and `POST /api/v1/admin/vendors/:id/reactivate`.
   - Implement `DELETE /api/v1/admin/vendors/:id`: Soft-deactivate (`deletedAt: new Date()`, `isActive: false`, `onboardingStatus: 'inactive'`, `Product.isStoreVisible = false`, `authVersion++`, mandatory reason, audit log).

### Phase SA-03: Superadmin UI & Workflow Integration
1. **Reason Modal Component:**
   - Create/reuse an accessible confirmation modal that collects a required text reason (`minLength >= 10`).
2. **Customer Management UI:**
   - Update `frontend/.../customers/page.js` to collect reasons on suspend/reactivate.
   - Update `frontend/.../customers/[id]/page.js`:
     - Add "Reset Password" button and modal (prompting for secure password and administrative reason).
     - Add "Delete / Deactivate Account" button and modal with destructive confirmation styling and reason requirement.
     - Mandate reason on "Suspend" / "Reactivate".
3. **Vendor Management UI:**
   - Update `frontend/.../vendors/page.js`: Add quick Suspend/Reactivate row actions with reason dialog.
   - Update `frontend/.../vendors/[id]/page.js`:
     - Add dedicated "Suspend Vendor" and "Reactivate Vendor" buttons in the top action bar.
     - Add "Delete / Deactivate Vendor" button and modal with destructive warning regarding product catalog delisting.
     - Update "Reset Password" modal to require an administrative reason.

### Phase SA-04: Regression & Acceptance Verification
1. **Automated Test Suite:**
   - Backend integration tests for:
     - Customer suspend/reactivate reason enforcement and session revocation.
     - Customer administrative password reset and login verification with new credentials.
     - Customer soft-deletion and order preservation.
     - Vendor suspend/reactivate reason enforcement and product catalog visibility toggle.
     - Vendor administrative password reset with reason and token invalidation.
     - Vendor soft-deletion and product delisting.
     - Role and permission boundaries (prevent unauthorized staff access).
2. **Manual Regression Checks:**
   - Customer checkout and storefront logins.
   - Merchant portal logins.
   - Order history and invoice generation.

---

## 15. ACCEPTANCE CRITERIA

1. **Authentication Invalidation:** Any suspension, deactivation, or administrative password reset immediately invalidates all active JWT sessions for the target account by incrementing `User.authVersion`.
2. **Reason Enforcement:** Requests to suspend, reactivate, reset password, or delete an account without a valid string reason (minimum 10 characters) return `400 Bad Request` with an informative error code.
3. **Audit Trail Completeness:** All administrative actions produce an immutable record in `AuditLog` containing `actorId`, `targetId`, `action`, `beforeState`, `afterState` (including `reason`), `ipAddress`, and `userAgent`.
4. **Data Integrity & Retention:** Soft deletion sets `deletedAt` and disables authentication without removing records from `User`, `Customer`, `Vendor`, `Order`, `Product`, or `FinancialLedgerEntry`. Historical orders continue to correctly attribute customer and vendor identities.
5. **Catalog Synchronization:** Suspending or deactivating a vendor immediately sets `isStoreVisible: false` across all vendor products in MongoDB.
6. **No Plaintext Passwords:** No API response, error payload, audit log, or frontend state returns or logs plaintext passwords.
7. **Authorization Boundaries:** Non-superadmin / non-authorized staff are rejected with `403 Forbidden` if attempting any customer or vendor mutation.

---

## 16. UNRESOLVED QUESTIONS AND UNVERIFIED AREAS

1. **GDPR / DPDP Anonymization Trigger:**  
   Should the Superadmin UI distinguish between standard "Account Deactivation" (disabling login and catalog while preserving names for support) and "Full Anonymization / Right to be Forgotten" (overwriting names and email addresses)?  
   *Recommendation:* Implement "Deactivate" as the default administrative action in SA-02/SA-03, reserving full data anonymization for an explicit secondary workflow.
2. **Self-Deletion Protection:**  
   The platform enforces a single active superadmin invariant (`unique_active_superadmin_idx`). Can an admin target another admin or themselves?  
   *Finding:* [`backend/src/controllers/admin-customer.controller.js:425`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/controllers/admin-customer.controller.js#L425) verifies `user.role === 'customer'`. Admin users cannot be targeted through customer endpoints. Explicit checks preventing self-suspension should nonetheless be enforced.

---

## 17. FINAL GIT STATUS COMPARISON

Executing `git status --short` confirms:
- **Zero application source files modified.**
- **Zero database migrations or records mutated.**
- **Only Deliverable Created:** `phase_SA-01_customer_vendor_account_management_audit.md`.
- **Integrity Status:** Complete forensic audit completed in read-only mode.
