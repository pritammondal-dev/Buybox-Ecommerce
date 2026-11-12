# CUSTOMER-PERMANENT-DELETE-02 — Completion Report

## Permanent Customer Account Deletion, Personal Data Erasure & Financial Record Preservation

### Including Bug Fix: CUSTOMER-PERMANENT-DELETE-02-GOOGLE-RECOVERY-01

**Project:** Buybox-Ecommerce (`pritammondal-dev/Buybox-Ecommerce`)  
**Branch:** `feature/customer-permanent-delete-02`  
**Base Branch:** `main` (`origin/main` at `e35d287d4096fb7cb767e5e012ccc86a0f926f61`)  
**Execution Date:** 2026-11-11  
**Status:** Implementation, Bug Fix & Multi-Tier Verification Complete — Ready for Review

---

## 1. Executive Summary

This phase implements a production-grade, privacy-compliant **Permanent Customer Account Deletion** lifecycle following **Option A Policy** (Personal Data Erasure with Financial & Tax Record Preservation).

Prior to this phase, soft deletion or account deactivation left customer documents, personal identifiers, and credentials dormant in MongoDB, and the administrative delete route (`DELETE /api/v1/admin/customers/:id`) merely unset customer references or executed partial record deletions. Furthermore, deleted Google accounts could be inadvertently resurrected upon subsequent OAuth logins, and JWT middleware lacked an explicit check to reject stale tokens when a user document no longer existed in MongoDB.

Under this implementation:

1. **Permanent Physical Erasure:** All customer-owned personal data (`User`, `Customer`, `Address`, `Cart`, `Wishlist`, `CustomerNotification`, `PaymentMethod`, `RewardAccount`, `RewardTransaction`, `DigitalEntitlement`, `RefreshToken`, `Otp`, `EmailVerificationToken`, `PasswordResetToken`) is permanently deleted from MongoDB.
2. **Financial & Tax Record Preservation (Option A):** Orders, Payments, Refunds, Return Requests, and Credit Notes are preserved to comply with Indian GST laws, Companies Act, and financial audit standards. All personal identity attributes on these records (`shippingAddress`, customer phone, recipient names, guest emails) are strictly scrubbed and replaced with generic anonymized tokens (`"Deleted Customer"`, `"0000000000"`), while tax-critical jurisdiction codes (`state`, `country`, `postalCode`) and ledger totals are preserved intact.
3. **Cryptographic Anti-Resurrection Tombstones:** Rather than storing plaintext emails or plain SHA-256 hashes (which are vulnerable to rainbow table attacks), the system records an HMAC-SHA-256 fingerprint in `DeletedAccountTombstone` with key rotation support (`keyVersion: 1`). Google Sign-In checks this tombstone registry and rejects deleted accounts with HTTP `403 ACCOUNT_DELETED`.
4. **Stale Token Invalidation:** The core authentication middleware (`authentication.middleware.js`) explicitly checks for missing database user documents and rejects stale tokens with HTTP `401 USER_NOT_FOUND`.
5. **Self-Service & Admin Workflows:** Customers can delete their accounts via `DELETE /api/v1/customers/account` (and `/me`) from the storefront account security settings with password verification or confirmation phrase (`"DELETE MY ACCOUNT"` for passwordless/Google accounts). Administrators invoke the same canonical deletion service via `DELETE /api/v1/admin/customers/:id`.
6. **Remediation for Residual Soft-Deleted Accounts (GOOGLE-RECOVERY-01):** Accounts deleted prior to this phase retained `deletedAt !== null` with unverified flags in MongoDB. The system now seamlessly detects, upgrades, purges, and blocks these residual identities without misclassifying them as active unverified accounts.

---

## 2. Architectural Design & Deletion Lifecycle

```
[ Customer / Admin ]
        │
        ▼
[ DELETE /api/v1/customers/account ]
        │
        ├── 1. Identity Verification (Password / "DELETE MY ACCOUNT")
        ├── 2. Operational Ineligibility Check:
        │      - In-flight Orders: ["pending", "confirmed", "processing", "shipped"]
        │      - Active Return Requests: not in ["completed", "rejected", "cancelled"]
        │      (Abort if active orders/returns exist -> 400 ACTIVE_ORDERS_IN_PROGRESS)
        │
        ├── 3. HMAC-SHA-256 Fingerprint Generation (email, google_sub)
        │      Upsert into DeletedAccountTombstone
        │
        ├── 4. Order & Financial Anonymization:
        │      - Order.shippingAddress: fullName -> "Deleted Customer", phone -> "0000000000", addressLine1 redacted
        │      - ReturnRequest: pickupAddress redacted, bankAccount/UPI masked
        │      - Tax jurisdiction (state, country) & financial totals preserved
        │
        ├── 5. Physical Document Purge:
        │      - User & Customer documents deleted
        │      - Address, Cart, Wishlist, Notifications, PaymentMethod, Rewards, Entitlements deleted
        │      - RefreshToken, Otp, Verification/Reset Tokens deleted
        │
        ├── 6. Post-Deletion Integrity Verification:
        │      Assert User, Customer, Addresses, Tokens == null
        │
        └── 7. Session Cleanup:
               Clear auth cookies (bb_customer_session, refreshToken) -> Return 200 OK
```

### Option A Data Partitioning Matrix

| Data Entity                           | Action                     | Retention / Anonymization Justification                                                                                                                       |
| :------------------------------------ | :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `User`                                | **Permanently Deleted**    | Erased from `users` collection.                                                                                                                               |
| `Customer`                            | **Permanently Deleted**    | Erased from `customers` collection.                                                                                                                           |
| `Address`                             | **Permanently Deleted**    | All customer addresses erased from `addresses` collection.                                                                                                    |
| `Cart` & `Wishlist`                   | **Permanently Deleted**    | Active shopping baskets and saved items erased.                                                                                                               |
| `CustomerNotification`                | **Permanently Deleted**    | In-app alerts and notifications erased.                                                                                                                       |
| `PaymentMethod`                       | **Permanently Deleted**    | Saved card/token references erased.                                                                                                                           |
| `RewardAccount` & `RewardTransaction` | **Permanently Deleted**    | Loyalty points balance and ledger erased.                                                                                                                     |
| `DigitalEntitlement`                  | **Permanently Revoked**    | Digital access terminated and record removed.                                                                                                                 |
| `RefreshToken`, `Otp`, `Tokens`       | **Permanently Deleted**    | All transient authentication state destroyed.                                                                                                                 |
| `Order`                               | **Preserved & Anonymized** | Preserved for GST audit. `shippingAddress` anonymized (`"Deleted Customer"`, `"0000000000"`, address line redacted; state/country kept for tax jurisdiction). |
| `Payment` & `Refund`                  | **Preserved As-Is**        | Preserved for statutory ledger reconciliation; gateway payment IDs kept for accounting.                                                                       |
| `ReturnRequest`                       | **Preserved & Anonymized** | Pickup address scrubbed; bank account / UPI details masked.                                                                                                   |
| `CreditNote`                          | **Preserved As-Is**        | Statutory GST tax credit document retained.                                                                                                                   |
| `DeletedAccountTombstone`             | **Created**                | HMAC-SHA-256 fingerprint created to prevent Google OAuth account resurrection.                                                                                |

---

## 3. Bug Fix: CUSTOMER-PERMANENT-DELETE-02-GOOGLE-RECOVERY-01

### 1. Problem Description

When attempting to sign in through Google OAuth for a previously deleted customer account, the system returned:
`403 ACCOUNT_LINKING_VERIFICATION_REQUIRED` (`"An unverified account exists with this email address. Please verify your email first before connecting Google Sign-In."`) instead of rejecting the deleted identity with `403 ACCOUNT_DELETED`.

### 2. Exact Root Cause & Forensic Findings

- **Location:** [`backend/src/services/auth.service.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/auth.service.js#L1180-L1190) and [`backend/src/utils/tombstone.util.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/utils/tombstone.util.js#L63-L85).
- **Forensic Discovery:** Database forensic analysis identified that customer accounts deleted _prior_ to `CUSTOMER-PERMANENT-DELETE-02` (e.g. target ID `6ab0c6be92ddda89a389c2ae` deleted on 2026-11-10) had been soft-deleted (`deletedAt: 2026-11-10T11:13:16.929Z`, `isActive: false`, `isEmailVerified: false`). Because they were deleted prior to tombstone registry inception, no tombstone record existed in `DeletedAccountTombstone`.
- **Failure Flow:**
  1. `isIdentityTombstoned` checked only `DeletedAccountTombstone` collection; returned `false`.
  2. `User.findOne({ "authProviders.google.id": payload.sub })` returned `null`.
  3. `User.findOne({ email: payload.email })` matched the residual soft-deleted user document.
  4. The code checked `if (!existingEmailUser.isEmailVerified)` **before** checking whether the user was deleted (`deletedAt`).
  5. Because the legacy user had `isEmailVerified: false`, it misclassified the deleted account as an active unverified registration, throwing `ACCOUNT_LINKING_VERIFICATION_REQUIRED`.

### 3. Implementation of the Fix

1. **Dynamic Legacy Tombstone Upgrade in [`tombstone.util.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/utils/tombstone.util.js):**
   - In `isIdentityTombstoned`, if no explicit tombstone is found, the system queries for any legacy/residual soft-deleted user (`deletedAt: { $ne: null }`).
   - If found, it automatically upgrades the record to an Option A tombstone (upserting HMAC-SHA-256 digests into `DeletedAccountTombstone`) and permanently deletes the residual `User` and `Customer` documents.
   - Returns `true`, triggering immediate HTTP `403 ACCOUNT_DELETED`.
2. **Defensive Guards in [`auth.service.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/auth.service.js):**
   - Added `if (user.deletedAt || !user.isActive)` check to provider lookup.
   - Added `if (existingEmailUser.deletedAt || !existingEmailUser.isActive)` check prior to checking email verification.
   - Normalized email strings with `.trim().toLowerCase()`.
3. **Preservation of Legitimate Unverified Accounts:**
   - Active, non-deleted unverified accounts (`!existingEmailUser.deletedAt && !existingEmailUser.isEmailVerified`) continue to throw `ACCOUNT_LINKING_VERIFICATION_REQUIRED`, preventing account hijacking without weakening security.

---

## 4. Modified & Created Files Inventory

### Backend

1. **New:** [`backend/src/models/DeletedAccountTombstone.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/DeletedAccountTombstone.js) — Mongoose schema with unique HMAC fingerprint index, key versioning, and indexed `deletedAt`.
2. **New:** [`backend/src/utils/tombstone.util.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/utils/tombstone.util.js) — Cryptographic HMAC-SHA-256 generation, query, and legacy soft-delete upgrade utilities.
3. **New:** [`backend/src/services/customer-deletion.service.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/customer-deletion.service.js) — Canonical deletion engine: eligibility verification, password/phrase authentication, data erasure, order anonymization, and verification assertions.
4. **New:** [`backend/src/validators/customer/delete-account.validator.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/validators/customer/delete-account.validator.js) — Zod schema for deletion payload (`password`, `confirmation`, `reason`).
5. **Modified:** [`backend/src/controllers/customer.controller.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/controllers/customer.controller.js) — Added `deleteMyAccount` endpoint handler with cookie clearance.
6. **Modified:** [`backend/src/routes/customer.routes.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/routes/customer.routes.js) — Mounted `DELETE /account` and `DELETE /me` with authentication and schema validation.
7. **Modified:** [`backend/src/controllers/admin-customer.controller.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/controllers/admin-customer.controller.js) — Routed `deleteCustomer` through `customerDeletionService.executePermanentDeletion({ skipIdentityVerification: true })`.
8. **Modified:** [`backend/src/middlewares/authentication.middleware.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/middlewares/authentication.middleware.js) — Added explicit `401 USER_NOT_FOUND` rejection when decoded JWT subject has no corresponding MongoDB user.
9. **Modified:** [`backend/src/services/auth.service.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/auth.service.js) — Added tombstone check and deleted-account guards to `authenticateGoogleUser` with `403 ACCOUNT_DELETED` rejection.
10. **New:** [`backend/tests/phase-customer-permanent-delete-02.test.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/tests/phase-customer-permanent-delete-02.test.js) — Comprehensive automated integration test suite covering 12 distinct scenarios.

### Frontend

11. **Modified:** [`frontend/src/services/customer.service.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/services/customer.service.js) — Added `customerService.deleteAccount(payload)` API client method.
12. **Modified:** [`frontend/src/app/(storefront)/account/security/SecurityPageView.jsx`](<file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/(storefront)/account/security/SecurityPageView.jsx>) — Implemented "Danger Zone" card with permanent deletion modal, dynamic verification (password input or Google `"DELETE MY ACCOUNT"` confirmation phrase), state reset, token clearance, and redirect to `/?deleted=true`.

---

## 5. Automated Verification & Regression Audit

### 1. Expanded Phase Integration Test Suite

Command: `npm --prefix backend test -- phase-customer-permanent-delete-02.test.js`

- **Result:** **12 passed / 12 passed (100%)**
- **Duration:** 10.27s
- **Scenarios Verified:**
  1. `permanently purges User, Customer, Addresses, Cart, Wishlist, and transient auth while preserving and anonymizing Orders` (PASS)
  2. `rejects deletion when password is incorrect` (PASS - 401 INVALID_CREDENTIALS)
  3. `blocks deletion when customer has an order in 'processing' status` (PASS - 400 ACTIVE_ORDERS_IN_PROGRESS)
  4. `blocks deletion when customer has an active return request in 'requested' status` (PASS - 400 ACTIVE_RETURNS_IN_PROGRESS)
  5. `blocks Google Sign-In with 403 ACCOUNT_DELETED when Google sub was previously deleted` (PASS - 403 ACCOUNT_DELETED)
  6. `allows fresh and unrelated Google users to register normally` (PASS - 200 OK)
  7. `blocks repeat Google Sign-In attempts consistently without recreating documents` (PASS - 403 ACCOUNT_DELETED across 3 consecutive calls)
  8. `preserves 403 ACCOUNT_LINKING_VERIFICATION_REQUIRED for legitimate unverified active accounts` (PASS - 403 preserved)
  9. `successfully links and logs in legitimate verified active accounts` (PASS - 200 OK)
  10. `rejects residual soft-deleted accounts with 403 ACCOUNT_DELETED and does NOT throw unverified account error` (PASS - 403 ACCOUNT_DELETED, residual purged)
  11. `matches tombstone fingerprints across email case and whitespace normalization` (PASS - 403 ACCOUNT_DELETED)
  12. `rejects access with 401 USER_NOT_FOUND when user document was permanently deleted` (PASS - 401 USER_NOT_FOUND)

### 2. Backend Authentication Regression Tests

Command: `npm --prefix backend test -- customer-auth-lifecycle.test.js customer-multi-method-auth.test.js`

- **Result:** **32 passed / 32 passed (100%)**
- **Suites:** 2 passed, 2 total

### 3. Frontend Unit Tests

Command: `npm --prefix frontend test`

- **Result:** **782 passed / 782 passed (100%)**
- **Suites:** 254 passed, 254 total

### 4. Frontend Production Build

Command: `npm --prefix frontend run build` (`next build --webpack`)

- **Result:** **Success**
- **Routes Compiled:** 292/292 static & dynamic routes compiled with zero errors.

---

## 6. Git Status & Safety Baseline

- **Current Branch:** `feature/customer-permanent-delete-02`
- **Baseline Commit:** `e35d287d4096fb7cb767e5e012ccc86a0f926f61` (`origin/main`)
- **Open Pull Request:** [#2](https://github.com/pritammondal-dev/Buybox-Ecommerce/pull/2)
- **Modified Tracked Files:** 3 files modified locally (`backend/src/utils/tombstone.util.js`, `backend/src/services/auth.service.js`, `backend/tests/phase-customer-permanent-delete-02.test.js`)
- **Untracked Residual Artifacts:** `PROJECT_DOCS_CLEANUP_01_COMPLETION_REPORT.md` (preserved untracked)
- **Status:** All fixes validated, verified, and uncommitted. Awaiting user authorization.
