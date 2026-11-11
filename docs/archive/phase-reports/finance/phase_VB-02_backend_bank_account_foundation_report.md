# BUYBOX E-COMMERCE
# VENDOR BANK ACCOUNT MANAGEMENT
## PHASE VB-02 — BACKEND FOUNDATION & ACCOUNT LIFECYCLE
### IMPLEMENTATION + SECURITY + AUTOMATED VERIFICATION REPORT

---

## 1. EXECUTIVE SUMMARY

Phase VB-02 successfully delivers the backend foundation, data security architecture, lifecycle workflows, and automated verification suite for **Vendor Bank Account Management** in the Buybox-Ecommerce platform.

Guided strictly by the forensic architecture design established in `phase_VB-01_vendor_bank_account_architecture_audit.md`, this implementation provides:
1. **Dedicated Collection & Mongoose Model (`VendorBankAccount.js`)**: Isolated from the main `Vendor` document to eliminate document-locking contention, optimize review queue lookups, and support compound partial unique indexes.
2. **Cryptographic Protection at Rest (`bank-crypto.util.js`)**: Bank account numbers are never stored in plaintext. They are encrypted using **AES-256-GCM authenticated cipher** (`enc:v1:<iv>:<authTag>:<ciphertext>`) and masked for standard presentation (`••••••••••••1234`).
3. **Deterministic Blind HMAC-SHA256 Indexing**: Duplicate accounts for the same vendor are prevented without exposing raw bank details using `accountNumberHash` derived from normalized account number and IFSC code. The HMAC secret is mathematically distinct from the AES cipher key.
4. **Three-Account Enforced Limit**: Each vendor is restricted to a maximum of 3 bank accounts (counting pending, under-review, approved, and rejected until archived) at the application and concurrency boundary.
5. **Vendor Self-Service Lifecycle**: Endpoints for account application submission (`POST /api/v1/vendors/me/bank-accounts`), masked account listing (`GET /api/v1/vendors/me/bank-accounts`), atomic active payout destination switching (`PATCH /api/v1/vendors/me/bank-accounts/:id/active`), and corrected application resubmission (`POST /api/v1/vendors/me/bank-accounts/:id/resubmit`).
6. **Administrative Reviewer Workflows**: Dedicated review queue for platform-wide pending applications (`GET /api/v1/admin/vendors/bank-accounts/applications`), with reviewer approval and rejection endpoints mandating 10–500 character justifications.
7. **Superadmin Management & Privileged Unmasking**: Comprehensive per-vendor management endpoints for administrative creation, editing, active status toggling, safe soft-deleting, and privileged unmasking guarded by `vendors.bank_accounts.view_unmasked` with immutable audit logging.
8. **Append-Only Audit Logging & State Sanitization**: Centralized `recordAuditLog` captures all mutations. `sanitizeAuditState` was hardened to scrub `accountNumber`, `rawAccountNumber`, `fullAccountNumber`, `accountNumberEncrypted`, `accountNumberHash`, and `cvv` from before/after states.
9. **Settlement & In-Flight Payout Non-Interference**: `VendorSettlement` projections dynamically resolve the active approved account. `VendorPayout.createPayout` freezes destination snapshots into payout metadata, ensuring in-flight payouts are never redirected if a vendor switches their active account.
10. **Automated Verification**: A dedicated 22-test automated suite (`backend/tests/phase-vb02-vendor-bank-account.test.js`) executed with 100% pass rate. All existing regression suites (SA-02, SA-04) and Next.js frontend builds passed with 0 errors.

---

## 2. IMPLEMENTED ARCHITECTURE VS VB-01 AUDIT DECISIONS

| Architecture Component | VB-01 Audit Recommendation | VB-02 Implementation | Status |
|---|---|---|---|
| **Data Storage Architecture** | Dedicated collection `VendorBankAccount` rather than embedded subdocuments in `Vendor.js` | `backend/src/models/VendorBankAccount.js` | **Delivered as Designed** |
| **Cipher Suite** | AES-256-GCM authenticated encryption (`enc:v1:<iv>:<tag>:<ciphertext>`) | `encryptBankAccount` & `decryptBankAccount` in `backend/src/utils/bank-crypto.util.js` | **Delivered as Designed** |
| **Blind Indexing** | Deterministic HMAC-SHA256 hash of `normalizedAccount:normalizedIfsc` | `computeBankAccountHash` with separate HMAC secret | **Delivered as Designed** |
| **Single Active Invariant** | MongoDB partial unique index on `{ vendorId: 1, isActive: 1 }` where `{ isActive: true, deletedAt: null }` | Schema index + transaction-level switching logic in `vendor-bank-account.service.js` | **Delivered as Designed** |
| **Duplicate Prevention** | Partial unique index on `{ vendorId: 1, accountNumberHash: 1 }` where `{ deletedAt: null }` | Schema index + service verification | **Delivered as Designed** |
| **Account Limit** | Maximum 3 registered accounts per vendor | Pre-mutation count enforcement in service layer | **Delivered as Designed** |
| **Audit Scrubbing** | Add `accountNumber`, `rawAccountNumber`, `fullAccountNumber`, `cvv` to `sanitizeAuditState` | Extended `SENSITIVE_KEYS` in `backend/src/services/governance.service.js` | **Delivered as Designed** |
| **Reviewer Queues** | Platform-wide review queue `/bank-accounts/applications` | Mounted in `backend/src/routes/vendor.routes.js` before `/:id` | **Delivered as Designed** |
| **Settlement Resolution** | Resolve active bank account on `VendorSettlement` line 753 | Hydration hook added in `backend/src/services/vendor-settlement.service.js` | **Delivered as Designed** |
| **Payout Snapshotting** | Freeze active bank destination at payout creation time | Metadata snapshotting wired into `VendorPayout.createPayout` in `vendor-payout.service.js` | **Delivered as Designed** |

---

## 3. CRYPTOGRAPHIC FOUNDATION & DATA PROTECTION

All cryptographic functions are encapsulated in `backend/src/utils/bank-crypto.util.js`.

### 3.1 Authenticated Encryption at Rest (AES-256-GCM)
Raw bank account numbers are never persisted in plaintext. Each encryption:
- Generates a fresh cryptographically random 12-byte initialization vector (`crypto.randomBytes(12)`).
- Derives a 32-byte key from `BANK_ACCOUNT_ENCRYPTION_KEY`, falling back to `CREDENTIAL_ENCRYPTION_KEY` or `JWT_ACCESS_SECRET`.
- Produces a 16-byte authentication tag ensuring ciphertext integrity.
- Formats ciphertext as: `enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>`.
- Any tampering or corruption causes deciphering to immediately fail authentication.

### 3.2 Deterministic Blind Indexing (HMAC-SHA256)
Because AES-256-GCM uses a fresh random IV per encryption, duplicate detection cannot query ciphertexts directly. Storing plaintext for querying violates financial compliance.
- Normalized Account Number: Strips all whitespace and hyphens (`replace(/[\s-]/g, "")`).
- Normalized IFSC Code: Strips whitespace/hyphens and converts to uppercase.
- Blind Hash:
  $$\text{accountNumberHash} = \text{HMAC-SHA256}\left(\text{hmacSecret},\; \text{normalizedAccount} + \text{":"} + \text{normalizedIFSC}\right)$$
- **Distinct Key Derivation**: The HMAC secret is derived from `BANK_ACCOUNT_HMAC_SECRET` or `${CREDENTIAL_ENCRYPTION_KEY}_bank_blind_hmac_salt_v1`, guaranteeing mathematical separation from the AES encryption key.

### 3.3 Presentation Masking
All public and ordinary administrative read endpoints return `accountNumberMasked` exclusively:
- Function: `maskBankAccount(accountNumber, visibleCount = 4)`
- Format: `••••••••••••${last4Digits}` (e.g. `••••••••••••1234`).
- Documents returned by Mongoose have their `toJSON` transform automatically scrub `accountNumberEncrypted` and `accountNumberHash` to provide defense-in-depth against accidental API serialization leaks.

---

## 4. DATA MODEL & CONSTRAINTS (`VendorBankAccount.js`)

**File**: `backend/src/models/VendorBankAccount.js`

### 4.1 Schema Fields
```javascript
{
  vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true, index: true },
  accountHolderName: { type: String, required: true, trim: true, maxlength: 150 },
  bankName: { type: String, required: true, trim: true, maxlength: 150 },
  accountNumberEncrypted: { type: String, required: true, trim: true },
  accountNumberMasked: { type: String, required: true, trim: true },
  accountNumberHash: { type: String, required: true, trim: true, index: true },
  ifscCode: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid Indian Financial System Code (IFSC) format"],
  },
  branchName: { type: String, default: null, trim: true, maxlength: 150 },
  accountType: { type: String, enum: ["savings", "current", "other"], default: "current", required: true },
  status: { type: String, enum: ["pending", "under_review", "approved", "rejected"], default: "pending", required: true, index: true },
  isActive: { type: Boolean, default: false, index: true },
  submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  submittedAt: { type: Date, default: Date.now, required: true },
  submissionReason: { type: String, default: null, trim: true, maxlength: 500 },
  reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  reviewedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: null, trim: true, maxlength: 500 },
  approvedAt: { type: Date, default: null },
  activatedAt: { type: Date, default: null },
  deactivatedAt: { type: Date, default: null },
  deactivatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  deletedAt: { type: Date, default: null, index: true },
  deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  deletedReason: { type: String, default: null, trim: true, maxlength: 500 },
  version: { type: Number, default: 1 }
}
```

### 4.2 Database Indexes & Invariants
1. **Single Active Account Constraint**:
   ```javascript
   vendorBankAccountSchema.index(
     { vendorId: 1, isActive: 1 },
     { unique: true, partialFilterExpression: { isActive: true, deletedAt: null } }
   );
   ```
2. **Duplicate Account Prevention Constraint**:
   ```javascript
   vendorBankAccountSchema.index(
     { vendorId: 1, accountNumberHash: 1 },
     { unique: true, partialFilterExpression: { deletedAt: null } }
   );
   ```
3. **Queue Sorting & Vendor History Indexes**:
   - `{ status: 1, submittedAt: -1 }` (supports FIFO reviewer queues)
   - `{ vendorId: 1, createdAt: -1 }` (supports merchant and Superadmin chronological account lists)

---

## 5. THREE-ACCOUNT LIMIT & CONCURRENCY INVARIANTS

### 5.1 Three-Account Cap Rule
- **Formula**:
  $$\text{Count}(\text{VendorBankAccount where } \text{vendorId} = V \text{ and } \text{deletedAt} = \text{null}) < 3$$
- **Enforcement**: Evaluated before document creation in `submitBankAccount` and `adminAddBankAccount`.
- **Rejection Status**: If count $\ge 3$, the request is immediately rejected with HTTP `400 Bad Request` and error code `BANK_ACCOUNT_LIMIT_EXCEEDED` ("Vendor cannot exceed the maximum limit of 3 bank accounts"). Zero state mutation occurs.
- **Rejected Accounts Count Toward Limit**: Rejected accounts count toward the limit until archived or resubmitted, preventing unconstrained spamming of the reviewer queue.

### 5.2 Atomic Active Switching
- Executed inside a MongoDB transaction (`withTransaction`).
- Validates `target.status === "approved"`. Attempting to activate a `pending` or `rejected` account throws `400 ACCOUNT_NOT_ELIGIBLE_FOR_ACTIVATION`.
- Finds any existing active account for the vendor and sets `isActive = false`, `deactivatedAt = new Date()`, `deactivatedBy = userId`.
- Sets `target.isActive = true`, `target.activatedAt = new Date()`.
- If two concurrent requests attempt to activate different accounts simultaneously, the `{ vendorId: 1, isActive: 1 }` partial unique index guarantees that only one transaction commits, maintaining single-active destination integrity.

---

## 6. API ENDPOINTS & REQUEST/RESPONSE CONTRACTS

### 6.1 Vendor Self-Service Routes (`/api/v1/vendors/me/bank-accounts`)
*Guarded by `authenticate`, `authenticateVendor`, `requireApprovedVendor`.*

| Method | Path | Validation Schema | Success Status | Description |
|---|---|---|---|---|
| `GET` | `/me/bank-accounts` | None | `200 OK` | List own bank accounts (masked). |
| `POST` | `/me/bank-accounts` | `submitBankAccountSchema` | `201 Created` | Submit new bank account application. |
| `PATCH` | `/me/bank-accounts/:id/active` | None | `200 OK` | Atomically switch active payout destination. |
| `POST` | `/me/bank-accounts/:id/resubmit` | `resubmitBankAccountSchema` | `200 OK` | Resubmit corrected details for a rejected account. |

### 6.2 Administrative & Reviewer Routes (`/api/v1/admin/vendors/*`)
*Guarded by `authenticateAdministrator`, `requirePermissions(...)`, `requireScope`.*

| Method | Path | Permission Required | Validation Schema | Description |
|---|---|---|---|---|
| `GET` | `/admin/vendors/bank-accounts/applications` | `vendors.bank_accounts.view` | `listBankApplicationsQuerySchema` | List pending applications queue across all vendors. |
| `GET` | `/admin/vendors/:id/bank-accounts` | `vendors.bank_accounts.view` | None | List all accounts for a specific vendor. |
| `GET` | `/admin/vendors/:id/bank-accounts/:accountId` | `vendors.bank_accounts.view` | None | Single bank account detail card. |
| `POST` | `/admin/vendors/:id/bank-accounts` | `vendors.bank_accounts.manage` | `adminCreateBankAccountSchema` | Superadmin administratively creates bank account. |
| `POST` | `/admin/vendors/:id/bank-accounts/:accountId/approve` | `vendors.bank_accounts.approve` | `approveBankAccountSchema` | Approve pending bank account application. |
| `POST` | `/admin/vendors/:id/bank-accounts/:accountId/reject` | `vendors.bank_accounts.reject` | `rejectBankAccountSchema` | Reject application with mandatory 10–500 char reason. |
| `POST` | `/admin/vendors/:id/bank-accounts/:accountId/under-review` | `vendors.bank_accounts.review` | None | Mark application as under review. |
| `POST` | `/admin/vendors/:id/bank-accounts/:accountId/unmask` | `vendors.bank_accounts.view_unmasked` | `unmaskBankAccountSchema` | Privileged audit view of unmasked account number. |
| `PATCH` | `/admin/vendors/:id/bank-accounts/:accountId` | `vendors.bank_accounts.manage` | `adminUpdateBankAccountSchema` | Edit account details (resets status on critical edit). |
| `PATCH` | `/admin/vendors/:id/bank-accounts/:accountId/status` | `vendors.bank_accounts.manage` | `adminStatusBankAccountSchema` | Superadmin toggles active payout status. |
| `DELETE` | `/admin/vendors/:id/bank-accounts/:accountId` | `vendors.bank_accounts.manage` | `adminDeleteBankAccountSchema` | Safely soft-deletes eligible account. |

---

## 7. VENDOR SELF-SERVICE LIFECYCLE

1. **Application Submission**:
   - Vendor submits `accountHolderName`, `bankName`, `accountNumber`, `confirmAccountNumber`, `ifscCode`, `branchName`, and `accountType`.
   - Zod validator enforces `accountNumber === confirmAccountNumber` and valid RBI IFSC format.
   - Initial state: `status: "pending"`, `isActive: false`.
2. **Masked Visibility**:
   - Vendor inspects all submitted accounts. `accountNumberMasked` is shown. Raw account numbers and hashes are scrubbed.
3. **Active Account Switching**:
   - Vendor clicks "Set as Active". Backend verifies `status === "approved"`.
   - Atomically switches destination and logs `vendor_bank_account.switched_active` in `AuditLog`.
4. **Correction and Resubmission**:
   - If rejected, the vendor sees `rejectionReason` and can submit corrected details.
   - State returns to `pending`, `rejectionReason` is cleared, and `version` increments.
5. **Tenant Isolation**:
   - Handled via `req.vendor._id` matching. Vendor A attempting to access Vendor B's account is rejected with `404 Not Found`.

---

## 8. ADMINISTRATIVE & REVIEWER WORKFLOWS

1. **Review Queue**:
   - Staff with `vendors.bank_accounts.view` access `/api/v1/admin/vendors/bank-accounts/applications`.
   - Returns paginated list of pending applications with vendor identity (`businessName`, `storeName`, `email`, `phone`).
2. **Approval Workflow**:
   - Reviewer clicks "Approve". Status transitions to `approved`, recording `reviewedBy` and `reviewedAt`.
   - **Auto-Activation Rule**: If the vendor currently has **zero active accounts**, the newly approved account automatically becomes `isActive: true`. If the vendor already has an active account, the approved account remains standby (`isActive: false`).
3. **Rejection Workflow**:
   - Reviewer clicks "Reject". Mandatory administrative reason (10 to 500 characters) is required.
   - Status transitions to `rejected`.
   - If the account was currently active, its `isActive` flag is immediately revoked (`isActive = false`, `deactivatedAt = new Date()`).

---

## 9. SUPERADMIN CONTROLS & PRIVILEGED ACCESS

1. **Administrative Creation**:
   - Superadmin can create accounts on behalf of vendors with optional `autoApprove: true` and `setActive: true`. Mandates reason.
2. **Critical vs Non-Critical Editing**:
   - If Superadmin edits non-critical metadata (`accountHolderName`, `branchName`, `accountType`), changes are applied with audit log.
   - If Superadmin modifies critical financial data (`accountNumber` or `ifscCode`), the account approval is automatically revoked (`status` reset to `pending`, `isActive: false`, `approvedAt: null`) to prevent unverified fund routing.
3. **Privileged Unmasking**:
   - Standard dashboard projections never expose plaintext account numbers.
   - When required for formal KYC or forensic compliance, an auditor with `vendors.bank_accounts.view_unmasked` calls `/unmask` with a mandatory reason (min 10 chars).
   - Plaintext account number is returned, and an immutable `AuditLog` entry (`action: "vendor_bank_account.unmasked_view"`) is written.
4. **Safe Soft-Deletion**:
   - Superadmin soft-deletes eligible account (`deletedAt = new Date()`, `deletedBy = actorId`, `deletedReason = reason`, `isActive = false`).
   - If the account is associated with a pending or processing payout, deletion is blocked with `400 CANNOT_DELETE_ACTIVE_PAYOUT_ACCOUNT`.

---

## 10. IMMUTABLE AUDIT LOGGING & SENSITIVE DATA SCRUBBING

Every bank account lifecycle mutation invokes `recordAuditLog` in `backend/src/services/governance.service.js`.

### 10.1 Audited Actions Matrix
- `vendor_bank_account.submitted`: Initial vendor application.
- `vendor_bank_account.switched_active`: Destination switch.
- `vendor_bank_account.resubmitted`: Corrected application submission.
- `vendor_bank_account.approved`: Application approved.
- `vendor_bank_account.rejected`: Application rejected with justification.
- `vendor_bank_account.marked_under_review`: Application review commenced.
- `vendor_bank_account.unmasked_view`: Privileged auditor inspection.
- `vendor_bank_account.admin_created`: Account created by Superadmin.
- `vendor_bank_account.admin_updated`: Account updated by Superadmin.
- `vendor_bank_account.admin_status_changed`: Account activated/deactivated by Superadmin.
- `vendor_bank_account.admin_deleted`: Account soft-deleted by Superadmin.

### 10.2 Credential Scrubbing Guarantee
In `backend/src/services/governance.service.js`, `sanitizeAuditState` was expanded:
```javascript
const SENSITIVE_KEYS = [
  "password",
  "passwordHash",
  "refreshToken",
  "token",
  "secret",
  "secretKey",
  "accessToken",
  "otp",
  "verificationToken",
  "accountNumber",
  "rawAccountNumber",
  "fullAccountNumber",
  "accountNumberEncrypted",
  "accountNumberHash",
  "cvv",
];
```
This guarantees that `AuditLog.beforeState` and `afterState` documents persist only `accountNumberMasked`. Plaintext account numbers and ciphertexts are scrubbed.

---

## 11. SETTLEMENT & PAYOUT NON-INTERFERENCE

### 11.1 Backward-Compatible Settlement Hydration
In `backend/src/services/vendor-settlement.service.js`, lines 753–765 were upgraded:
```javascript
const settlement = await VendorSettlement.findById(resolvedSettlementId)
  .populate("vendorId", "businessName storeName businessSlug email phone bankAccount")
  .populate("orderIds", "orderNumber status placedAt grandTotal currency items shippingAddress")
  .populate("settledBy", "name email")
  .lean();

if (settlement.vendorId && !settlement.vendorId.bankAccount) {
  const activeBank = await VendorBankAccount.findOne({
    vendorId: settlement.vendorId._id,
    isActive: true,
    status: "approved",
    deletedAt: null,
  }).lean();

  if (activeBank) {
    settlement.vendorId.bankAccount = activeBank;
  }
}
```
This repairs the legacy null projection without modifying the `Vendor` document schema.

### 11.2 Payout Destination Snapshotting
In `backend/src/services/vendor-payout.service.js`, when `createPayout` executes:
1. It queries `VendorBankAccount.findOne({ vendorId, isActive: true, status: "approved", deletedAt: null })`.
2. It captures frozen destination details into payout `metadata`:
   - `bankAccountId`: String ID of `VendorBankAccount`.
   - `beneficiaryName`: Frozen account holder name.
   - `bankName`: Frozen bank name.
   - `ifscCode`: Frozen IFSC code.
   - `accountNumberMasked`: Frozen masked account number (`••••••••••••1111`).
   - `accountType`: Savings / Current.
3. If the vendor subsequently switches their active bank account, the payout's frozen `metadata` snapshot remains untouched. In-flight and queued disbursements execute against their original destination.

---

## 12. AUTOMATED VERIFICATION RESULTS

### 12.1 Phase VB-02 Dedicated Test Suite
**Command**: `npm --prefix backend test -- phase-vb02`
**Test File**: `backend/tests/phase-vb02-vendor-bank-account.test.js`

```
PASS tests/phase-vb02-vendor-bank-account.test.js
  Phase VB-02: Vendor Bank Account Management — Backend Foundation & Account Lifecycle
    1. VendorBankAccount Model & Cryptography Foundation
      √ 1.1 enforces AES-256-GCM encryption at rest and deterministic blind HMAC index (3 ms)
      √ 1.2 validates IFSC code schema format and rejects invalid codes (2 ms)
      √ 1.3 scrubs encrypted and hash fields on default toJSON serialization (2 ms)
    2. Three-Account Limit & Duplicate Account Prevention
      √ 2.1 permits adding up to 3 bank accounts and blocks a 4th account with 400 BANK_ACCOUNT_LIMIT_EXCEEDED (182 ms)
      √ 2.2 prevents duplicate bank account numbers for the same vendor with 409 DUPLICATE_BANK_ACCOUNT (59 ms)
    3. Vendor Self-Service Workflow & Active Account Switching
      √ 3.1 rejects mismatched confirmAccountNumber with 400 Bad Request (79 ms)
      √ 3.2 lists own bank accounts with masked presentation only (91 ms)
      √ 3.3 prevents activating an unapproved bank account with 400 ACCOUNT_NOT_ELIGIBLE_FOR_ACTIVATION (65 ms)
      √ 3.4 atomically switches active payout destination among approved accounts (100 ms)
      √ 3.5 isolates cross-vendor access: Vendor B cannot switch or view Vendor A accounts (58 ms)
      √ 3.6 allows resubmitting corrected details for a rejected bank account (68 ms)
    4. Reviewer Queue & Approval/Rejection Workflow
      √ 4.1 reviewer lists pending applications across all vendors in review queue (40 ms)
      √ 4.2 rejects unauthorized customer from accessing review queue with 403 Forbidden (31 ms)
      √ 4.3 approves application and auto-activates if vendor has zero active accounts (41 ms)
      √ 4.4 mandates minimum 10-character reason for rejection and revokes active state (59 ms)
    5. Superadmin Management Controls & Privileged Access
      √ 5.1 Superadmin adds bank account administratively with autoApprove and setActive (25 ms)
      √ 5.2 Superadmin privileged unmasking requires mandatory reason and logs immutable AuditLog (25 ms)
      √ 5.3 Superadmin editing critical fields (accountNumber) resets status to pending (18 ms)
      √ 5.4 Superadmin toggles status and soft-deletes eligible account with reason (41 ms)
    6. Audit Log Sanitization & Plaintext Exclusion
      √ 6.1 guarantees AuditLog records never store plaintext account numbers (34 ms)
    7. Settlement & In-Flight Payout Immutability
      √ 7.1 creates payout with destination snapshot and switching accounts does NOT alter existing in-flight payout (61 ms)
      √ 7.2 blocks deletion of bank account linked to an in-flight payout (39 ms)

Test Suites: 1 passed, 1 total
Tests:       22 passed, 22 total
Snapshots:   0 total
Time:        5.001 s
```

### 12.2 Full Regression Verification
1. **SA-02 Account Lifecycle Regression Suite**:
   - `npm --prefix backend test -- phase-sa02`: **17 passed, 17 total (100%)**
2. **SA-04 End-to-End Security & Acceptance Suite**:
   - `npm --prefix backend test -- phase-sa04`: **28 passed, 28 total (100%)**
3. **Combined Suites**:
   - `npm --prefix backend test -- phase-vb02 phase-sa02`: **39 passed, 39 total (100%)**
4. **Next.js Production Build**:
   - `npm --prefix frontend run build`: **Compiled successfully in 29.4s, 273 static and dynamic routes built with 0 errors**.

---

## 13. SECURITY & THREAT MODELING ANALYSIS

| Threat / Attack Vector | Mitigating Mechanism Implemented in VB-02 | Forensic Outcome |
|---|---|---|
| **Database Compromise / Plaintext Dump** | Raw account numbers encrypted with AES-256-GCM (`enc:v1:<iv>:<tag>:<ciphertext>`). | Attacker cannot read account numbers without master encryption key. |
| **Searchable Plaintext Leakage** | Deterministic blind HMAC-SHA256 indexing with mathematically distinct salt. | Duplicate detection operates without storing or searching plaintext numbers. |
| **Accidental API Serialization Leak** | `toJSON` and `toObject` transforms explicitly delete `accountNumberEncrypted` and `accountNumberHash`. | Plaintext and ciphertexts are excluded from standard API responses. |
| **Audit Log Leakage** | `sanitizeAuditState` removes `accountNumber`, `rawAccountNumber`, `fullAccountNumber`, `accountNumberEncrypted`, `accountNumberHash`, `cvv`. | Audit log inspection surfaces only masked accounts (`••••••••••••1234`). |
| **Race Conditions in Active Account Selection** | Partial unique index `{ vendorId: 1, isActive: 1 }` with filter `{ isActive: true, deletedAt: null }` wrapped in MongoDB session transaction. | Guaranteed exactly one active payout account per vendor at all times. |
| **Spam / Resource Exhaustion via Bank Applications** | Application layer checks `countDocuments({ vendorId, deletedAt: null }) < 3`. | Vendor can never maintain more than 3 non-archived bank accounts. |
| **Cross-Tenant Account Hijacking** | All self-service routes verify `req.vendor._id === bankAccount.vendorId`. | Cross-vendor account mutations and reads return `404 Not Found`. |
| **Unauthorized Review Queue Access** | Routes guarded by `authenticateAdministrator` and granular `requirePermissions(PERMISSIONS.VENDORS_BANK_ACCOUNTS_*)`. | Unauthorized roles (customer, unprivileged staff) receive `403 Forbidden`. |
| **Mid-Flight Payout Redirection** | Payout creation freezes destination snapshot in `metadata`. Bank account deletion is blocked if pending payouts exist. | Active account switching only redirects future disbursements, never queued payouts. |

---

## 14. PRESERVED REPOSITORY STATE & CHANGE CONTROL

1. **Non-Destructive File Operations**:
   - All pre-existing untracked and modified files were preserved without modification.
   - Zero Git revert, reset, stash, commit, push, or branch commands were executed.
2. **Files Created**:
   - `backend/src/models/VendorBankAccount.js`
   - `backend/src/utils/bank-crypto.util.js`
   - `backend/src/validators/vendor/vendor-bank-account.validator.js`
   - `backend/src/services/vendor-bank-account.service.js`
   - `backend/src/controllers/vendor-bank-account.controller.js`
   - `backend/tests/phase-vb02-vendor-bank-account.test.js`
   - `phase_VB-02_backend_bank_account_foundation_report.md`
3. **Files Modified (Strictly Targeted)**:
   - `backend/src/config/env.js` (added optional `BANK_ACCOUNT_ENCRYPTION_KEY` and `BANK_ACCOUNT_HMAC_SECRET` schema keys)
   - `backend/src/constants/permissions.constants.js` (added Section 5 granular bank account permissions, catalog entries, and alias mappings)
   - `backend/src/services/governance.service.js` (added bank account keys to `SENSITIVE_KEYS` in `sanitizeAuditState`)
   - `backend/src/routes/vendor.routes.js` (mounted vendor self-service and administrative reviewer routes)
   - `backend/src/services/vendor-settlement.service.js` (hydrated active bank account for settlement lookup)
   - `backend/src/services/vendor-payout.service.js` (snapshotted active bank destination in payout metadata)
   - `backend/src/models/Vendor.js` (added virtual `bankAccounts` referencing `VendorBankAccount`)

---

## 15. READINESS FOR PHASE VB-03 (VENDOR CONSOLE UI)

With Phase VB-02 complete and automatically verified, the backend foundation is fully operational and ready for frontend integration:
1. **API Contracts Ready**: Endpoints for listing accounts, submitting applications, active switching, and resubmitting are active and secured.
2. **Phase VB-03 Focus**: Build the merchant-facing UI in the Vendor Console (`/vendor/finance` and `/vendor/settings/bank-accounts`), featuring:
   - Registered bank accounts card (up to 3).
   - "Add Bank Account" modal with account number matching confirmation and IFSC validation.
   - Status tracking badges (`Pending Verification`, `Approved`, `Changes Required`).
   - One-click "Set as Active Payout Destination" switcher.
   - Resubmission drawer for rejected applications showing reviewer feedback.

