# CUSTOMER-PERMANENT-DELETE-02 — Completion Report
## Permanent Customer Account Deletion, Personal Data Erasure & Financial Record Preservation

**Project:** Buybox-Ecommerce (`pritammondal-dev/Buybox-Ecommerce`)  
**Branch:** `feature/customer-permanent-delete-02`  
**Verified Baseline:** `e35d287d4096fb7cb767e5e012ccc86a0f926f61` (`origin/main`)  
**Execution Date:** 2026-11-11  
**Status:** Verification Complete — Ready for Review & Authorization  

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

| Data Entity | Action | Retention / Anonymization Justification |
| :--- | :--- | :--- |
| `User` | **Permanently Deleted** | Erased from `users` collection. |
| `Customer` | **Permanently Deleted** | Erased from `customers` collection. |
| `Address` | **Permanently Deleted** | All customer addresses erased from `addresses` collection. |
| `Cart` & `Wishlist` | **Permanently Deleted** | Active shopping baskets and saved items erased. |
| `CustomerNotification` | **Permanently Deleted** | In-app alerts and notifications erased. |
| `PaymentMethod` | **Permanently Deleted** | Saved card/token references erased. |
| `RewardAccount` & `RewardTransaction` | **Permanently Deleted** | Loyalty points balance and ledger erased. |
| `DigitalEntitlement` | **Permanently Revoked** | Digital access terminated and record removed. |
| `RefreshToken`, `Otp`, `Tokens` | **Permanently Deleted** | All transient authentication state destroyed. |
| `Order` | **Preserved & Anonymized** | Preserved for GST audit. `shippingAddress` anonymized (`"Deleted Customer"`, `"0000000000"`, address line redacted; state/country kept for tax jurisdiction). |
| `Payment` & `Refund` | **Preserved As-Is** | Preserved for statutory ledger reconciliation; gateway payment IDs kept for accounting. |
| `ReturnRequest` | **Preserved & Anonymized** | Pickup address scrubbed; bank account / UPI details masked. |
| `CreditNote` | **Preserved As-Is** | Statutory GST tax credit document retained. |
| `DeletedAccountTombstone` | **Created** | HMAC-SHA-256 fingerprint created to prevent Google OAuth account resurrection. |

---

## 3. Cryptographic Security & Anti-Resurrection Design

### HMAC-SHA-256 Fingerprint vs Plain Hashes
Plain SHA-256 hashes of standard email formats can be reversed using precomputed rainbow tables or brute-force dictionaries. To prevent data leakage:
- Fingerprints are generated using `crypto.createHmac("sha256", secret)` where `secret` is loaded from `process.env.TOMBSTONE_HMAC_SECRET || process.env.JWT_SECRET`.
- The `DeletedAccountTombstone` schema stores:
  - `identityFingerprint`: Hex HMAC digest (unique index).
  - `fingerprintType`: `"email"` or `"google_sub"`.
  - `keyVersion`: Key rotation identifier (`1`).
  - `deletedAt`: Timestamp of deletion.
  - `reason`: Internal justification tag.
- Neither raw emails nor raw Google sub identifiers are ever written to the tombstone collection.

### Google Sign-In Rejection
In `backend/src/services/auth.service.js`, `authenticateGoogleUser` queries `isIdentityTombstoned(googleSub, "google_sub")` and `isIdentityTombstoned(email, "email")`. If either matches:
- An audit warning is logged: `[AUTH_AUDIT] GOOGLE_LOGIN_BLOCKED_ACCOUNT_DELETED`.
- The request is immediately rejected with HTTP `403` and error code `ACCOUNT_DELETED`.
- No `User` or `Customer` document is recreated.

### Stale JWT Middleware Rejection
In `backend/src/middlewares/authentication.middleware.js`, when a bearer token or session cookie is decoded:
- If `decoded.sub` is valid but `!dbUser`:
  - Returns HTTP `401` with code `USER_NOT_FOUND` and message `"User account no longer exists."`.

---

## 4. Modified & Created Files Inventory

### Backend
1. **New:** [`backend/src/models/DeletedAccountTombstone.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/DeletedAccountTombstone.js)  
   Mongoose schema with unique HMAC fingerprint index, key versioning, and indexed `deletedAt`.
2. **New:** [`backend/src/utils/tombstone.util.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/utils/tombstone.util.js)  
   Cryptographic HMAC-SHA-256 generation and query utilities.
3. **New:** [`backend/src/services/customer-deletion.service.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/customer-deletion.service.js)  
   Canonical deletion engine: eligibility verification, password/phrase authentication, data erasure, order anonymization, and verification assertions.
4. **New:** [`backend/src/validators/customer/delete-account.validator.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/validators/customer/delete-account.validator.js)  
   Zod schema for deletion payload (`password`, `confirmation`, `reason`).
5. **Modified:** [`backend/src/controllers/customer.controller.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/controllers/customer.controller.js)  
   Added `deleteMyAccount` endpoint handler with cookie clearance.
6. **Modified:** [`backend/src/routes/customer.routes.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/routes/customer.routes.js)  
   Mounted `DELETE /account` and `DELETE /me` with authentication and schema validation.
7. **Modified:** [`backend/src/controllers/admin-customer.controller.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/controllers/admin-customer.controller.js)  
   Routed `deleteCustomer` through `customerDeletionService.executePermanentDeletion({ skipIdentityVerification: true })`.
8. **Modified:** [`backend/src/middlewares/authentication.middleware.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/middlewares/authentication.middleware.js)  
   Added explicit `401 USER_NOT_FOUND` rejection when decoded JWT subject has no corresponding MongoDB user.
9. **Modified:** [`backend/src/services/auth.service.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/auth.service.js)  
   Added tombstone check to `authenticateGoogleUser` with `403 ACCOUNT_DELETED` rejection.
10. **New:** [`backend/tests/phase-customer-permanent-delete-02.test.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/tests/phase-customer-permanent-delete-02.test.js)  
    Comprehensive automated integration test suite covering 7 distinct test scenarios.

### Frontend
11. **Modified:** [`frontend/src/services/customer.service.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/services/customer.service.js)  
    Added `customerService.deleteAccount(payload)` API client method.
12. **Modified:** [`frontend/src/app/(storefront)/account/security/SecurityPageView.jsx`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/(storefront)/account/security/SecurityPageView.jsx)  
    Implemented "Danger Zone" card with permanent deletion modal, dynamic verification (password input or Google `"DELETE MY ACCOUNT"` confirmation phrase), state reset, token clearance, and redirect to `/?deleted=true`.

---

## 5. Automated Verification & Regression Audit

### 1. Phase Integration Test Suite
Command: `npm --prefix backend test -- phase-customer-permanent-delete-02.test.js`
- **Result:** **7 passed / 7 passed (100%)**
- **Duration:** 8.64s
- **Scenarios Verified:**
  1. `permanently purges User, Customer, Addresses, Cart, Wishlist, and transient auth while preserving and anonymizing Orders` (PASS)
  2. `rejects deletion when password is incorrect` (PASS - 401 INVALID_CREDENTIALS)
  3. `blocks deletion when customer has an order in 'processing' status` (PASS - 400 ACTIVE_ORDERS_IN_PROGRESS)
  4. `blocks deletion when customer has an active return request in 'requested' status` (PASS - 400 ACTIVE_RETURNS_IN_PROGRESS)
  5. `blocks Google Sign-In with 403 ACCOUNT_DELETED when Google sub was previously deleted` (PASS - 403 ACCOUNT_DELETED)
  6. `allows fresh and unrelated Google users to register normally` (PASS - 200 OK)
  7. `rejects access with 401 USER_NOT_FOUND when user document was permanently deleted` (PASS - 401 USER_NOT_FOUND)

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
- **Modified Tracked Files:** 7
- **Untracked Files:** 6 (service, model, utility, validator, test, audit doc)
- **Commit Status:** **Uncommitted** — Awaiting project owner authorization.

