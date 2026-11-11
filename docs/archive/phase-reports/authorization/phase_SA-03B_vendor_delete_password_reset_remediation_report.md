# BUYBOX E-COMMERCE
# SUPERADMIN VENDOR ACCOUNT MANAGEMENT
## PHASE SA-03B — MISSING DELETE ACCOUNT & RESET PASSWORD ACTIONS
### FORENSIC AUDIT • REMEDIATION • AUTOMATED VERIFICATION REPORT

---

## 1. EXECUTIVE SUMMARY

During operational inspection of the Buybox-Ecommerce Superadmin portal, administrators observed that the expected actions to **Reset Merchant Password** and **Soft-Deactivate Vendor Account** were not visible or operating correctly in the vendor account management workflows.

Following the forensic methodology established in Phases SA-01 through SA-04, an investigation across the frontend presentation, component hierarchies, state hooks, permission guards, API client contracts, and backend endpoint bindings was executed.

### Core Discoveries
1. **Vendor Detail Page Visibility Guard Bug (`vendors/[id]/page.js`)**:
   - The "Reset Password" button included an extraneous prerequisite guard: `linkedUserId`. In cases where `vendor.userId` was formatted as a complex object, an unpopulated ObjectId, or where the overview endpoint returned a different projection, `linkedUserId` evaluated to falsy, completely hiding the Reset Password trigger from authorized Superadmins.
   - The Reset Password modal lacked a confirmation field and matching password validation, presenting operational risk of credential lockout if a password was mistyped.
   - The Soft-Deactivation button lacked clear, distinct labeling and prominent visual post-deactivation indication.
2. **Vendor Directory Listing Omission (`vendors/page.js`)**:
   - In the primary vendor directory table (`frontend/src/app/administrator/vendors/page.js`), neither "Reset Password" nor "Deactivate Account" actions were exposed in the per-row actions menu.
   - Permissions `vendors.reset_password` and `vendors.delete` were not queried or evaluated on the directory page.
3. **API Client Export Divergence (`admin.service.js` & `vendor.service.js`)**:
   - In `frontend/src/services/admin/admin.service.js`, the legacy `adminVendorService` export was missing `resetPassword`, `delete`, and `reactivate` methods.
   - `frontend/src/services/admin/vendor.service.js` used `resetVendorPassword` and `deleteVendor` without uniform canonical aliases (`resetPassword`, `delete`).

All defects have been remediated with zero regressions. All unit, lifecycle, authorization, and end-to-end security test suites pass (100%), and the Next.js production build succeeded with zero errors across all 273 routes.

---

## 2. FORENSIC ROOT-CAUSE ANALYSIS

| Subsystem / File | Reported Finding | Forensic Root Cause | Severity | Remediation |
|---|---|---|---|---|
| `frontend/src/app/administrator/vendors/[id]/page.js` | "Reset Password" button not visible for some vendors | Line 484 evaluated `{!vendor.deletedAt && canResetPassword && linkedUserId && (`. Because the backend route `POST /api/v1/admin/vendors/:id/reset-password` handles resolving the vendor's user on the server, `linkedUserId` on the client was unnecessary and broke button visibility when `vendor.userId` projection varied. | **HIGH** | Removed `linkedUserId` requirement from the render guard. Button now reliably displays whenever `canResetPassword` is held and `!vendor.deletedAt`. |
| `frontend/src/app/administrator/vendors/[id]/page.js` | Password Reset Modal lacked confirmation | Modal only collected a single password input. If an admin mistyped the password, the merchant was locked out with no confirmation step. | **MEDIUM** | Added `confirmPassword` state, live matching check, and client-side complexity validator before network submission. |
| `frontend/src/app/administrator/vendors/[id]/page.js` | Soft-deactivation button lacked clear semantics | Button text was ambiguous ("Deactivate" vs Suspend). Post-deactivation UI lacked prominent soft-deactivation info banner. | **LOW** | Renamed button to "Deactivate Account". Added prominent info banner explaining storefront delisting, session revocation, and legal data preservation. |
| `frontend/src/app/administrator/vendors/page.js` | Directory table actions lacked Reset Password and Deactivate | Rows only rendered "Inspect Profile" and "Suspend/Reactivate". `canResetPassword` and `canDelete` permissions were not evaluated. | **HIGH** | Added `canResetPassword` and `canDelete` permission hooks, row action triggers, and dedicated modals for quick directory-level reset and soft-deactivation. |
| `frontend/src/services/admin/admin.service.js` | Incomplete `adminVendorService` export | `adminVendorService` in `admin.service.js` only defined `list`, `approve`, `reject`, `requestChanges`, and `suspend`. | **MEDIUM** | Added full lifecycle methods: `reactivate`, `resetPassword`, `resetVendorPassword`, `delete`, `deleteVendor`, and `updateVendor`. |
| `frontend/src/services/admin/vendor.service.js` | Missing canonical method aliases | Exposed `resetVendorPassword` and `deleteVendor`, but lacked canonical `resetPassword` and `delete` aliases. | **LOW** | Added `resetPassword`, `delete`, `suspend`, and `reactivate` canonical alias methods. |

---

## 3. IMPLEMENTATION DETAILS

### 3.1 Vendor Detail Page (`frontend/src/app/administrator/vendors/[id]/page.js`)
- **Render Guard Correction**:
  ```jsx
  {/* Reset Password Button (gated by vendors.reset_password) */}
  {!vendor.deletedAt && canResetPassword && (
    <button
      onClick={() => {
        setNewPassword("");
        setConfirmPassword("");
        setModalError(null);
        setShowPasswordModal(true);
      }}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-xs transition-colors"
    >
      <Lock className="h-3.5 w-3.5 text-amber-600" />
      Reset Password
    </button>
  )}
  ```
- **Password Confirmation & Validation**:
  ```javascript
  const handleResetPassword = async ({ reason }) => {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
    if (!newPassword || !passwordRegex.test(newPassword)) {
      setModalError("Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setModalError("New password and confirmation password do not match.");
      return;
    }
    // Proceed with secure API submission
  };
  ```
- **Modal Input Pair**:
  The modal collects `New Merchant Password` and `Confirm New Password`, displaying live mismatch warnings and enforcing password complexity guidelines.
- **Soft-Deactivation Notice Banner**:
  When `vendor.deletedAt` is present, all mutations are hidden or disabled, and a prominent banner informs the operator:
  > **Merchant Account Safely Soft-Deactivated**: This vendor account was deactivated on [Date]. Merchant console access has been revoked and all catalog listings were unpublished from the storefront. In accordance with platform tax and financial policies, all historical orders, shipments, customer returns, and financial settlements are preserved.

### 3.2 Vendor Directory Listing Page (`frontend/src/app/administrator/vendors/page.js`)
- **Permission Hooks**:
  ```javascript
  const canResetPassword = hasPermission("vendors.reset_password");
  const canDelete = hasPermission("vendors.delete");
  ```
- **Directory Table Actions**:
  - Gated Reset Password button (`Lock` icon) for active/suspended merchants.
  - Gated Deactivate button (`Trash2` icon) for non-deactivated merchants.
  - "Deactivated" disabled tag for soft-deactivated merchants.
- **Inline Modals**:
  - Integrated `ReasonConfirmModal` for Reset Password with `newPassword`, `confirmPassword`, and 10–500 character administrative reason requirement.
  - Integrated `ReasonConfirmModal` for Soft-Deactivation with `isDestructive={true}`, `requireAcknowledgment={true}`, and 10–500 character reason requirement.

### 3.3 Service API Contracts
- **`frontend/src/services/admin/vendor.service.js`**:
  Added aliases `resetPassword`, `delete`, `suspend`, and `reactivate` to complement `resetVendorPassword`, `deleteVendor`, etc.
- **`frontend/src/services/admin/admin.service.js`**:
  Expanded `adminVendorService` to expose:
  - `list` -> `GET /admin/vendors`
  - `get` -> `GET /admin/vendors/:id`
  - `approve` -> `POST /admin/vendors/:id/approve`
  - `reject` -> `POST /admin/vendors/:id/reject`
  - `requestChanges` -> `POST /admin/vendors/:id/request-changes`
  - `suspend` / `suspendVendor` -> `POST /admin/vendors/:id/suspend`
  - `reactivate` / `reactivateVendor` -> `POST /admin/vendors/:id/reactivate`
  - `resetPassword` / `resetVendorPassword` -> `POST /admin/vendors/:id/reset-password`
  - `delete` / `deleteVendor` -> `DELETE /admin/vendors/:id` with `{ data: { reason } }`
  - `updateVendor` -> `PATCH /admin/vendors/:id`

---

## 4. SECURITY & DATA INTEGRITY VERIFICATION

1. **Soft-Delete Policy Compliance**:
   - Deactivating a vendor sets `deletedAt = new Date()` on the `Vendor` document, sets `User.isActive = false`, revokes active refresh tokens, and delists public products (`isStoreVisible = false`).
   - Zero physical deletions occur; historical orders, fulfillment records, customer return requests, and vendor financial settlements remain intact.
2. **Credential Secrecy**:
   - Administrative password resets generate bcrypt hashes with >= 12 salt rounds on the backend.
   - Zero credentials or password hashes are written to audit logs or HTTP response bodies.
   - Both client and server reject passwords that do not satisfy complexity criteria.
3. **Audit Trail Accountability**:
   - Every mutation mandates an administrative reason between 10 and 500 characters.
   - Reasons are captured immutably in `AuditLog` along with `actorId`, `targetId`, action name, and IP address.
4. **Self-Protection Guards**:
   - Administrators cannot use administrative reset or soft-deactivation endpoints on their own accounts.

---

## 5. AUTOMATED TEST SUITE EXECUTION RESULTS

### 5.1 Account Lifecycle UI Unit Tests (`frontend/tests/unit/admin-account-lifecycle-ui.test.js`)
```
▶ Phase SA-03: Superadmin Customer & Vendor Account Management Frontend Workflows
  ▶ 1. Customer API Client Contract & Lifecycle Methods (7 tests passed)
  ▶ 2. Vendor API Client Contract & Lifecycle Methods (5 tests passed)
  ▶ 3. Administrative Reason Validation Rules (4 tests passed)
  ▶ 4. Password Complexity Validation Rules (2 tests passed)
  ▶ 5. Permission Aliasing and Role-Based Access Control (4 tests passed)
  ▶ 6. Frontend Component & Page File Structure Verification (3 tests passed)
  ▶ 7. Phase SA-03B: Vendor Delete & Reset Password Actions Integration
    ✔ adminVendorService exports canonical aliases for resetPassword and delete
    ✔ adminVendorService in admin.service.js provides full account lifecycle methods
    ✔ Password matching check rejects mismatched passwords before network call
    ✔ Vendor directory page (vendors/page.js) integrates Reset Password and Deactivate actions
    ✔ Vendor detail page (vendors/[id]/page.js) exposes Reset Password without linkedUserId dependency
  ✔ 7. Phase SA-03B: Vendor Delete & Reset Password Actions Integration (5 tests passed)

ℹ tests 30 | suites 8 | pass 30 | fail 0 | cancelled 0 | skipped 0
```

### 5.2 Full Frontend Regression Suite (`npm --prefix frontend test`)
```
ℹ tests 616 | suites 200 | pass 616 | fail 0 | duration_ms 3136.74
```

### 5.3 Backend Account Lifecycle Security Suite (`phase-sa02-account-lifecycle-security.test.js`)
```
PASS tests/phase-sa02-account-lifecycle-security.test.js (11.117 s)
  Phase SA-02: Backend Account Lifecycle, Security & Audit Hardening
    1. SA-02A: Vendor Session Leak Regression & Identity Sync (4 tests passed)
    2. SA-02B & SA-02C: Authorization Boundaries & Reason Validation (6 tests passed)
    3. SA-02D: Customer Account Lifecycle (5 tests passed)
    4. SA-02E: Vendor Account Lifecycle (2 tests passed)

Test Suites: 1 passed, 1 total
Tests:       17 passed, 17 total
```

### 5.4 Backend End-to-End Acceptance Suite (`phase-sa04-e2e-security-acceptance.test.js`)
```
PASS tests/phase-sa04-e2e-security-acceptance.test.js (16.587 s)
  Phase SA-04: End-to-End Security & Acceptance Verification
    1. Reason Validation Boundary & Zero-Mutation Matrix (8 tests passed)
    2. Authoritative Granular RBAC/PBAC & Permission Aliasing (8 tests passed)
    3. Customer Lifecycle, Session Invalidation & Data Integrity (5 tests passed)
    4. Vendor Lifecycle, Product Moderation & Settlements (5 tests passed)
    5. Audit Log Immutability & Credential Secrecy (2 tests passed)

Test Suites: 1 passed, 1 total
Tests:       28 passed, 28 total
```

### 5.5 Next.js Production Build (`npm --prefix frontend run build`)
```
▲ Next.js 16.3.5 (webpack)
✓ Compiled successfully in 24.7s
✓ Generating static pages using 11 workers (273/273) in 9.4s
✓ Finalizing page optimization
Exit Code: 0 (0 compilation errors across 273 routes)
```

---

## 6. VERIFICATION SUMMARY & RELEASE READINESS

All requirements of Phase SA-03B have been fulfilled:
- **Reset Password**: Available in both the vendor directory listing and the vendor detail view, gated by `vendors.reset_password` or `vendors:manage`, with double-password validation, complexity checks, and mandatory reason logging.
- **Delete / Deactivate Vendor**: Available in both the vendor directory listing and the vendor detail view, gated by `vendors.delete` or `vendors:manage`, with destructive acknowledgment modal, soft-delete data preservation, and complete session revocation.
- **Deactivated State**: Deactivated vendors display clear notice banners, and further mutations are prevented.
- **Working Tree Integrity**: All uncommitted changes, configuration files, and untracked artifacts were preserved. No Git commit, reset, or discard operations were performed.

