# BUYBOX E-COMMERCE
# VENDOR BANK ACCOUNT MANAGEMENT
## PHASE VB-04 — SUPERADMIN REVIEWER & COMPLIANCE CONSOLE
### FORENSIC AUDIT + IMPLEMENTATION + SECURITY VERIFICATION REPORT

**Document ID:** `BUYBOX-REPORT-VB-04-2026-10-30`  
**Phase:** VB-04  
**Status:** COMPLETE & VERIFIED  
**Date:** October 30, 2026  
**Audience:** Platform Architecture, Security Engineering, Core Development Team

---

## 1. EXECUTIVE SUMMARY

Phase **VB-04** completes the administrative and compliance capabilities of the **Vendor Bank Account Management** module in **Buybox E-Commerce**. Building upon the cryptographic foundations delivered in Phase VB-02 and the merchant self-service workflows delivered in Phase VB-03, this phase establishes a unified Superadmin compliance portal.

Administrators and compliance officers now have complete operational oversight, granular governance controls, privileged audit unmasking, and dedicated reviewer queues to review, approve, reject, edit, activate, and safely archive merchant settlement accounts across the marketplace.

### Key Capabilities Delivered:
1. **Centralized Application Reviewer Queue (`/administrator/bank-accounts`)**:
   - High-throughput operational dashboard displaying pending and active bank account applications across all vendors.
   - Comprehensive status filtering (`Pending Review`, `Under Review`, `Approved`, `Changes Required`, `All Applications`).
   - Integrated search across bank name, IFSC, account holder, and merchant business name.
2. **Individual Application Review & Approval/Rejection Workflow**:
   - Independent verification interface with quick "Approve", "Reject", and "Mark Under Review" operations.
   - Enforced client and server-side mandatory justification (10–500 characters) on rejection.
   - Strict adherence to the platform rule separating approval from active payout status: approval auto-activates only if the vendor currently maintains zero live payout destinations; otherwise, the account enters verified standby status.
3. **Privileged Account Number Unmasking (`PrivilegedUnmaskModal.jsx`)**:
   - High-security on-demand decryption tool protected by `vendors.bank_accounts.view_unmasked` RBAC permissions and Superadmin role checks.
   - Enforced mandatory audit justification (min 10 chars) writing an immutable audit record to `AuditLog`.
   - Zero-plaintext client guarantee: decrypted numbers exist strictly in ephemeral component memory and are purged immediately when the dialog is closed or unmounted. No caching or persistence in browser storage (`localStorage`, `sessionStorage`, cookies) or query params.
4. **Superadmin Vendor Detail Page Integration (`/administrator/vendors/[id]`)**:
   - Dedicated **Bank Accounts** tab added to the vendor management view alongside Overview, Compliance, Catalog, and Financials.
   - Comprehensive 3-slot capacity gauge displaying active settlement destinations, available slots, and verification queue counts.
   - Dedicated `AdminBankAccountCard` rendering every registered account individually with masked credentials, timestamps, and reviewer attribution.
   - Embedded Settlement Destination summary card in the Financials & Settlements tab.
5. **Administrative Bank Account Lifecycle Operations**:
   - **Admin Add Account**: Enables Superadmin to register accounts on behalf of vendors with optional `autoApprove` and `setActive` flags (enforcing the strict max-3 rule).
   - **Admin Edit Account**: Allows metadata updates. Changes to critical credentials (account number or IFSC) trigger a prominent UI warning, revoke existing approvals, deactivate the account if active, and reset status to `pending`.
   - **Activate / Deactivate Payout**: Safely toggles primary payout routing with warnings that future settlements route to the new account while in-flight disbursements retain their original snapshot.
   - **Safe Soft-Deletion / Archival**: Enforces soft-deletion (`deletedAt`, `deletedReason`) with strict backend protection preventing deletion of accounts linked to pending or in-flight payouts.
6. **Automated Verification & Zero Regression**:
   - 654 frontend tests passing (100% pass rate).
   - 22 backend VB-02 bank integration tests passing.
   - 17 backend SA-02 lifecycle security tests passing.
   - 28 backend SA-04 security acceptance tests passing.
   - Next.js production build compiled cleanly across 276 static and dynamic routes.

---

## 2. INITIAL FORENSIC AUDIT FINDINGS

Prior to code modifications, a complete read-only forensic inspection was conducted across all backend routes, controllers, models, validators, permissions, and frontend services:

### 2.1 Backend Route & Permission Mapping
- `backend/src/routes/vendor.routes.js` is dual-mounted at `/api/v1/vendors` and `/api/v1/admin/vendors`.
- Administrative reviewer queue and per-vendor management endpoints were already established in Phase VB-02 with granular RBAC/PBAC gates.

### 2.2 Forensic Audit Matrix

| Operation | Existing Backend Endpoint | Required Permission | Required Request Fields | Response Envelope | Audit Event | Existing Frontend Status | Identified Gaps / Refinements |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Reviewer Queue** | `GET /api/v1/admin/vendors/bank-accounts/applications` | `vendors.bank_accounts.view` | Query: `page`, `limit`, `status`, `search` | `{ success: true, data: { items: [...], meta: {...} } }` | None (Read query) | **Missing** | Validator schema needed `"all"` enum support; backend service required `$or` search query regex. |
| **Approve Application** | `POST /api/v1/admin/vendors/bank-accounts/:accountId/approve` | `vendors.bank_accounts.approve` | Body: `{ reason?: string }` (max 500) | `{ success: true, message: "...", data: { account: {...} } }` | `vendor_bank_account.approved` | **Missing** | Missing UI review actions and confirmation modal. |
| **Reject Application** | `POST /api/v1/admin/vendors/bank-accounts/:accountId/reject` | `vendors.bank_accounts.reject` | Body: `{ reason: string }` (10–500 chars) | `{ success: true, message: "...", data: { account: {...} } }` | `vendor_bank_account.rejected` | **Missing** | Missing UI rejection workflow with mandatory validation. |
| **Mark Under Review** | `POST /api/v1/admin/vendors/bank-accounts/:accountId/under-review` | `vendors.bank_accounts.review` | Body: `{ reason?: string }` | `{ success: true, message: "...", data: { account: {...} } }` | `vendor_bank_account.marked_under_review` | **Missing** | Missing UI trigger. |
| **Privileged Unmask** | `POST /api/v1/admin/vendors/:id/bank-accounts/:accountId/unmask` | `vendors.bank_accounts.view_unmasked` | Body: `{ reason: string }` (min 10 chars) | `{ success: true, data: { accountNumber, ... } }` | `vendor_bank_account.unmasked_view` | **Missing** | Missing dedicated unmask dialog with ephemeral memory purging. |
| **Vendor Bank List** | `GET /api/v1/admin/vendors/:id/bank-accounts` | `vendors.bank_accounts.view` | Param: `id` | `{ success: true, data: { accounts: [...] } }` | None (Read query) | **Missing** | Missing dedicated tab in `/administrator/vendors/[id]`. |
| **Admin Add Account** | `POST /api/v1/admin/vendors/:id/bank-accounts` | `vendors.bank_accounts.manage` | Body: Account details + `reason` (10-500) + `autoApprove`, `setActive` | `{ success: true, message: "...", data: { account: {...} } }` | `vendor_bank_account.admin_created` | **Missing** | Missing modal form with 3-slot checking. |
| **Admin Edit Account** | `PATCH /api/v1/admin/vendors/:id/bank-accounts/:accountId` | `vendors.bank_accounts.manage` | Body: Partial details + `reason` (10-500) | `{ success: true, message: "...", data: { account: {...} } }` | `vendor_bank_account.admin_updated` | **Missing** | Missing modal form with critical detail change warnings. |
| **Admin Set Status** | `PATCH /api/v1/admin/vendors/:id/bank-accounts/:accountId/status` | `vendors.bank_accounts.manage` | Body: `{ isActive: boolean, reason: string }` | `{ success: true, message: "...", data: { account: {...} } }` | `vendor_bank_account.admin_status_changed` | **Missing** | Missing activation / deactivation confirmation dialog. |
| **Admin Soft-Delete** | `DELETE /api/v1/admin/vendors/:id/bank-accounts/:accountId` | `vendors.bank_accounts.manage` | Body: `{ reason: string }` (10-500 chars) | `{ success: true, message: "...", data: { bankAccountId } }` | `vendor_bank_account.admin_deleted` | **Missing** | Missing archival dialog and in-flight payout error handling. |

---

## 3. FILES CREATED AND MODIFIED

### 3.1 Backend Files Refined:
- `backend/src/validators/vendor/vendor-bank-account.validator.js`:
  - Updated `listBankApplicationsQuerySchema` to permit `status: z.enum([...VENDOR_BANK_ACCOUNT_STATUSES, "all"]).optional()`.
- `backend/src/services/vendor-bank-account.service.js`:
  - Refined `listPendingApplications` to support `query.status === "all"` and multi-field `$or` search queries over `bankName`, `ifscCode`, and `accountHolderName`.

### 3.2 Frontend Services & State Stores:
- `frontend/src/services/admin/bank-account.service.js` *(New)*:
  - Created standalone service client handling reviewer queue listing, approval, rejection, under-review marking, privileged unmasking, per-vendor listing, administrative creation, editing, status toggling, and soft-deletion.
- `frontend/src/services/admin/vendor.service.js` *(Modified)*:
  - Added convenience bank account methods mirroring `adminBankAccountService`.
- `frontend/src/stores/admin-auth.store.js` *(Modified)*:
  - Added canonical alias mappings for bank account permissions (`vendors.bank_accounts.*`).

### 3.3 Frontend Components & Pages:
- `frontend/src/components/admin/AdminSidebar.jsx` *(Modified)*:
  - Registered **Bank Applications** navigation item under the `Marketplace` group with `Landmark` icon and `vendors.bank_accounts.view` permission check.
- `frontend/src/components/admin/bank-accounts/PrivilegedUnmaskModal.jsx` *(New)*:
  - High-security unmasking modal requiring mandatory reason, displaying audit warnings, rendering decrypted account digits, and strictly purging values from memory on close.
- `frontend/src/components/admin/bank-accounts/AdminAddBankAccountModal.jsx` *(New)*:
  - Superadmin account registration modal with mandatory administrative justification, `autoApprove`, and `setActive` controls.
- `frontend/src/components/admin/bank-accounts/AdminEditBankAccountModal.jsx` *(New)*:
  - Administrative editing modal with prominent alerts explaining that critical credential changes reset approval status to `pending`.
- `frontend/src/components/admin/bank-accounts/AdminBankAccountCard.jsx` *(New)*:
  - High-density card displaying complete bank account details, lifecycle status badges, active settlement indicators, and action triggers.
- `frontend/src/app/administrator/bank-accounts/page.js` *(New)*:
  - Centralized Reviewer Queue page with status tabs, search, pagination, inline actions, and modal integrations.
- `frontend/src/app/administrator/vendors/[id]/page.js` *(Modified)*:
  - Integrated dedicated **Bank Accounts** tab (`bank_accounts`), capacity overview KPIs, settlement destination summary banner in Financials tab, and all action modal dialogs.
- `frontend/tests/unit/admin-bank-account-compliance.test.js` *(New)*:
  - Unit test suite covering all client contracts, component integrity, permission gates, zero-plaintext storage, and reason boundaries.

---

## 4. REVIEWER QUEUE IMPLEMENTATION

### 4.1 Route & Access Control
- **Route**: `/administrator/bank-accounts`
- **Protected By**: `vendors.bank_accounts.view` permission gate and `useAdminAuthStore`.

### 4.2 Visual Hierarchy & Features
1. **Status Filter Tabs**:
   - `Pending Review` (Default filter: `pending`)
   - `Under Review` (`under_review`)
   - `Approved` (`approved`)
   - `Changes Required` (`rejected`)
   - `All Applications` (`all`)
2. **Search Bar**:
   - Live query input matching Bank Name, IFSC code, Account Holder Name, and Vendor Identity.
3. **Data Grid**:
   - **Target Merchant**: Displays business name, store name, and email with direct link to vendor detail page.
   - **Bank Credentials**: Displays bank name, account type, and account holder.
   - **Masked Account Number**: Displays `••••••••••••1234` with quick unmask action button (if permitted).
   - **IFSC**: Uppercase financial routing code.
   - **Timestamps**: Formatted submission and review dates.
   - **Status Badges**: Styled color-coded badges (`Approved` in emerald, `Pending` in amber, `Under Review` in indigo, `Rejected` in rose).
   - **Inline Actions**: One-click "Approve", "Reject", "Review", and "Inspect Vendor Detail".

---

## 5. APPROVAL & REJECTION WORKFLOWS

### 5.1 Approval Workflow
1. Reviewer clicks **Approve** on a pending or under-review application.
2. A confirmation dialog opens detailing the target bank, account holder, and IFSC code.
3. Outlines the platform auto-activation rule:
   - If the merchant currently has **zero** active payout accounts, this account is activated immediately (`isActive = true`).
   - If the merchant already maintains an active payout account, this account transitions to verified standby status (`isActive = false`).
4. Optional compliance notes can be provided.
5. On submit: dispatches `POST /api/v1/admin/vendors/bank-accounts/:accountId/approve`.
6. Dispatches success toast and re-synchronizes the queue state.

### 5.2 Rejection Workflow
1. Reviewer clicks **Reject** on an application.
2. Rejection dialog opens with mandatory justification prompt.
3. Client-side and server-side validation strictly enforces **10 to 500 characters**.
4. Warns the reviewer that feedback is dispatched directly to the merchant console for corrections.
5. If the account was previously active, the backend immediately revokes its active state (`isActive = false`).
6. On submit: dispatches `POST /api/v1/admin/vendors/bank-accounts/:accountId/reject` with `{ reason }`.
7. Rejection reason is stored in `VendorBankAccount.rejectionReason` and an immutable `vendor_bank_account.rejected` event is logged in `AuditLog`.

---

## 6. PRIVILEGED ACCOUNT NUMBER UNMASKING

Unmasking raw financial credentials is restricted to authorized operations:

### 6.1 Security Invariants
- **RBAC Gate**: Requires `vendors.bank_accounts.view_unmasked` permission or `SUPERADMIN` role.
- **Mandatory Justification**: Requires minimum 10 characters explaining the operational necessity (e.g. regulatory compliance check, chargeback investigation).
- **Backend Decryption**: Plaintext account digits are decrypted only in backend memory using AES-256-GCM.
- **Immutable Audit Capture**: Backend creates an audit log entry (`vendor_bank_account.unmasked_view`) containing:
  - `actorId` (employee ID)
  - `targetId` (account ID)
  - `reason` (audit justification)
  - `req` metadata (IP address, user agent)
  - Plaintext account digits are **strictly excluded** from the audit record.

### 6.2 Client Memory Hygiene
- Decrypted digits are stored solely in React local state (`revealedData`).
- When the modal is closed or unmounted, `revealedData` is reset to `null`.
- Raw numbers are **never stored** in `localStorage`, `sessionStorage`, cookies, URLs, or browser logs.

---

## 7. VENDOR DETAIL PAGE INTEGRATION

### 7.1 Dedicated Bank Accounts Tab
Within `frontend/src/app/administrator/vendors/[id]/page.js`:
- Registered `{ id: "bank_accounts", label: "Bank Accounts", icon: Landmark }` in `TABS`.
- Automatically activates when URL contains `?tab=bank_accounts`.

### 7.2 Capacity Overview Metrics
- **Slot Utilization**: `x / 3` registered accounts with remaining slot counter.
- **Active Settlement Account**: Identifies the primary payout destination or alerts that none is set.
- **Verification Queue**: Count of pending / under-review accounts for this vendor.

### 7.3 Individual Account Cards (`AdminBankAccountCard`)
Every account is displayed individually with:
- Bank Name, Account Type, Branch Name
- Account Holder Name
- Masked Account Number (`••••••••••••1234`) with privileged unmask button
- IFSC Code
- Verification Status and Active Settlement indicators
- Submission, Review, and Approval timestamps
- Attributed Reviewer name and email
- Rejection feedback note (if rejected)
- Full action controls: Approve, Reject, Under Review, Set as Active, Deactivate, Edit, and Archive.

---

## 8. ADMINISTRATIVE WORKFLOWS (ADD, EDIT, ACTIVATE, ARCHIVE)

### 8.1 Administrative Account Creation (`AdminAddBankAccountModal`)
- Authorized administrators can register an account directly on behalf of a vendor.
- Enforces 9–20 digit account number regex and confirmation match.
- Enforces Indian IFSC format (`^[A-Z]{4}0[A-Z0-9]{6}$`).
- Enforces max 3 accounts constraint (`Slot Limit Reached (3/3)` disabled button).
- Requires mandatory administrative reason (10–500 chars).
- Supports `autoApprove` and `setActive` flags:
  - `autoApprove = true`: Sets status to `approved` immediately, bypassing the review queue.
  - `setActive = true`: Enabled only when `autoApprove` is selected; deactivates any existing active account and sets this account as live.

### 8.2 Administrative Account Editing (`AdminEditBankAccountModal`)
- Permitted edits: `accountHolderName`, `bankName`, `branchName`, `accountType`.
- **Critical Detail Change Rule**: If `accountNumber` or `ifscCode` is modified:
  - Prominent UI warning banner informs operator that credentials will be re-encrypted and re-hashed.
  - Approval is immediately revoked (`status = 'pending'`, `isActive = false`).
  - Requires mandatory justification reason.

### 8.3 Active Payout Destination Switching
- Administrators can switch active destinations via `AdminBankAccountCard`.
- Confirmation modal explains that:
  - Future settlement cycles route to this account.
  - Only one account is active at any time.
  - In-flight or processing payouts remain frozen to their originally snapshotted destination.

### 8.4 Safe Account Soft-Deletion / Archival
- Enforces soft-deletion policy (`deletedAt = new Date()`, `deletedBy = actorId`, `deletedReason = reason`).
- Zero hard deletions.
- **In-Flight Payout Protection**: If an account is linked to any pending or processing payout, the backend blocks deletion with `400 CANNOT_DELETE_ACTIVE_PAYOUT_ACCOUNT`. The UI captures and displays this operational constraint clearly.

---

## 9. PERMISSION AND AUTHORIZATION MATRIX

All operations are guarded by explicit permission checks:

| Role / Scope | View Masked | Mark Review | Approve | Reject | Manage (Add/Edit/Delete/Status) | View Unmasked |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **SUPER_ADMIN** | Yes | Yes | Yes | Yes | Yes | Yes |
| **ADMIN (`vendors:manage`)** | Yes | Yes | Yes | Yes | Yes | Yes |
| **FINANCE (`finance:manage`)** | Yes | Yes | Yes | Yes | Yes | No |
| **FINANCE (`finance:read`)** | Yes | No | No | No | No | No |
| **CUSTOMER** | No | No | No | No | No | No |
| **VENDOR** | Self Only | No | No | No | Self Only | No |

---

## 10. AUDIT LOGGING VERIFICATION

Every administrative mutation records an immutable entry in `AuditLog` via `recordAuditLog`:

| Action | Target Entity | Audit Event Name | Captured Fields |
| :--- | :--- | :--- | :--- |
| **Application Approved** | `VendorBankAccount` | `vendor_bank_account.approved` | `actorId`, `targetId`, `reason`, before/after states |
| **Application Rejected** | `VendorBankAccount` | `vendor_bank_account.rejected` | `actorId`, `targetId`, `reason`, before/after states |
| **Marked Under Review** | `VendorBankAccount` | `vendor_bank_account.marked_under_review` | `actorId`, `targetId`, `reason`, before/after states |
| **Privileged Unmask** | `VendorBankAccount` | `vendor_bank_account.unmasked_view` | `actorId`, `targetId`, `reason`, `req` IP & user agent |
| **Admin Created** | `VendorBankAccount` | `vendor_bank_account.admin_created` | `actorId`, `targetId`, `reason`, created document |
| **Admin Updated** | `VendorBankAccount` | `vendor_bank_account.admin_updated` | `actorId`, `targetId`, `reason`, before/after states |
| **Status Changed** | `VendorBankAccount` | `vendor_bank_account.admin_status_changed` | `actorId`, `targetId`, `reason`, before/after states |
| **Admin Deleted** | `VendorBankAccount` | `vendor_bank_account.admin_deleted` | `actorId`, `targetId`, `reason`, before/after states |

**Sanitization Invariant Verified**: Audit records never capture raw bank account numbers, encrypted ciphertexts, or HMAC blind index hashes.

---

## 11. SENSITIVE DATA EXPOSURE ASSESSMENT

1. **Zero Storage Persistence**: Neither plaintext nor masked account numbers are written to `localStorage`, `sessionStorage`, or cookies.
2. **Ephemeral Decryption**: Privileged unmasking holds decrypted digits in component local state only; memory is purged immediately upon modal dismissal.
3. **No URL Leakage**: Bank account numbers and hashes are never passed as query parameters or in URL routes.
4. **Backend Response Scrubbing**: Default `.toJSON()` serialization on `VendorBankAccount` automatically strips `accountNumberEncrypted` and `accountNumberHash`.

---

## 12. AUTOMATED TEST SUITE RESULTS

### 12.1 Phase VB-04 Test Suite (`node frontend/scripts/run-tests.js`)
```
✔ Phase VB-04: Superadmin Bank Account Reviewer & Compliance Console (28.42ms)
  ▶ 1. Reviewer Queue API Client Contracts (5 tests passed)
  ▶ 2. Superadmin Per-Vendor Bank Management Contracts (5 tests passed)
  ▶ 3. UI Component Integrity & Route Registrations (4 tests passed)
  ▶ 4. Permission & RBAC Aliasing Invariants (2 tests passed)
  ▶ 5. Security, Zero-Plaintext Storage & Ephemeral Memory Hygiene (3 tests passed)

Total Frontend Tests: 654 passed, 0 failed (211 test suites)
Duration: 4.51s
```

### 12.2 Next.js Production Build (`npm --prefix frontend run build`)
```
▲ Next.js 16.3.5 (webpack)
✓ Compiled successfully in 62s
✓ Generating static pages (276/276) in 13.9s
Route (app)
├ ○ /administrator/bank-accounts                       1m      1y
├ ○ /vendor/finance/bank-accounts                      1m      1y
├ ○ /vendor/settings/bank-accounts                     1m      1y
276 routes generated with 0 errors.
```

### 12.3 Backend Integration Tests (`npm --prefix backend test -- phase-vb02`)
```
PASS tests/phase-vb02-vendor-bank-account.test.js (12.634 s)
  Phase VB-02: Vendor Bank Account Management — Backend Foundation & Account Lifecycle
    1. VendorBankAccount Model & Cryptography Foundation (3 tests passed)
    2. Three-Account Limit & Duplicate Account Prevention (2 tests passed)
    3. Vendor Self-Service Workflow & Active Account Switching (6 tests passed)
    4. Reviewer Queue & Approval/Rejection Workflow (4 tests passed)
    5. Superadmin Management Controls & Privileged Access (4 tests passed)
    6. Audit Log Sanitization & Plaintext Exclusion (1 test passed)
    7. Settlement & In-Flight Payout Immutability (2 tests passed)

Test Suites: 1 passed, 1 total
Tests:       22 passed, 22 total
```

### 12.4 Backend Lifecycle & Security Acceptance Regressions
- `tests/phase-sa02-account-lifecycle-security.test.js`: **17/17 passed**
- `tests/phase-sa04-e2e-security-acceptance.test.js`: **28/28 passed**

---

## 13. KNOWN LIMITATIONS & UNRESOLVED RISKS

1. **Third-Party Bank Verification APIs**: Currently, account validation relies on format checking (Indian IFSC structure and 9–20 digit account numbers) and administrative document review (passbook/cheque leaf). Integration with automated penny-drop verification APIs (e.g. Razorpay Fund Account Validation or Cashfree Verification) can be introduced as an automated enhancement in future phases.
2. **Bulk Application Approvals**: The current reviewer queue is designed for individual, high-rigor application review to prevent fraud. Bulk approval actions are intentionally omitted.

---

## 14. FINAL ACCEPTANCE RECOMMENDATION

Phase **VB-04: Superadmin Reviewer & Compliance Console** satisfies all requirements:
- The centralized reviewer queue is fully operational with live backend query support.
- Application approval and rejection workflows enforce authoritative backend rules and mandatory justification.
- Privileged account unmasking enforces permission gates, mandatory reason logging, immutable audit records, and zero-plaintext client persistence.
- The Superadmin vendor detail page individually renders all registered bank accounts with full lifecycle management controls.
- The 3-account ceiling, single active payout destination invariant, and in-flight payout protection are strictly maintained.
- All 654 frontend tests and all backend lifecycle regression suites pass with 100% compliance.

**Phase VB-04 is formally RECOMMENDED FOR ACCEPTANCE AND RELEASE.**

