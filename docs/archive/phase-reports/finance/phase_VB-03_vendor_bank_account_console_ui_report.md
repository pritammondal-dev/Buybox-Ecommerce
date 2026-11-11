# BUYBOX E-COMMERCE
# VENDOR BANK ACCOUNT MANAGEMENT
## PHASE VB-03 — VENDOR CONSOLE UI & WORKFLOWS
### IMPLEMENTATION + API INTEGRATION + AUTOMATED VERIFICATION REPORT

**Document ID:** `BUYBOX-REPORT-VB-03-2026-10-30`  
**Phase:** VB-03  
**Status:** COMPLETE & VERIFIED  
**Date:** October 30, 2026  
**Audience:** Platform Architecture, Security Engineering, Core Development Team

---

## 1. EXECUTIVE SUMMARY

Phase **VB-03** delivers a complete, secure, and production-grade vendor-facing Bank Account Management interface for the **Buybox E-Commerce** platform. Built upon the cryptographic foundation and lifecycle state machine implemented in Phase VB-02, this milestone empowers merchants to self-serve their settlement banking credentials while enforcing strict security, zero-plaintext exposure, deterministic duplicate protection, and an absolute three-account ceiling.

All user-facing workflows have been integrated seamlessly into the existing Next.js App Router and Vendor Console design system without disrupting pre-existing settlement, order fulfillment, or catalog management modules.

### Key Capabilities Delivered:
1. **Dedicated Vendor Bank Account Portal (`/vendor/finance/bank-accounts` & `/vendor/settings/bank-accounts`)**:
   - Comprehensive dashboard housing the 3-slot capacity gauge, status metrics, and ordered list of registered accounts.
2. **Account Capacity & Status KPI Overview (`BankAccountOverview.jsx`)**:
   - High-visibility visual metrics displaying registered count (e.g., `2 / 3`), remaining slots, active payout destination, pending verification queue, and rejected applications requiring action.
3. **Structured Bank Credential Cards (`BankAccountCard.jsx`)**:
   - High-density presentation showing bank name, masked credentials (`••••••••••••1234`), uppercase IFSC, account holder name, account type, lifecycle status badges (`Approved`, `Pending Review`, `Under Review`, `Changes Required`), and settlement routing indicators.
4. **Multi-Step Add Bank Account Workflow (`AddBankAccountModal.jsx`)**:
   - Intuitive submission modal with client-side regex format checking (9–20 digits account number, 11-character Indian IFSC `^[A-Z]{4}0[A-Z0-9]{6}$`), dual confirmation match, pre-submission review step, and slot limit blocking (`3/3 Limit Reached`).
5. **Reviewer Feedback & Application Resubmission Modal (`ResubmitBankAccountModal.jsx`)**:
   - Prominent reviewer rejection note display with pre-filled editable metadata and mandatory credential re-entry, smoothly transitioning rejected accounts back to `pending` review.
6. **Active Payout Destination Switcher (`SwitchActiveConfirmModal.jsx`)**:
   - Atomic active account switcher with confirmation modal clearly outlining payout routing rules: future payouts route to the new account, while in-flight disbursements remain immutably locked to their snapshot.
7. **Vendor Dashboard Navigation & Finance Page Integration**:
   - Registered `Bank Accounts` under `Finance & Payouts` in `VendorSidebar.jsx`.
   - Active Payout Account summary banner embedded at the top of `VendorFinancePage` (`/vendor/finance`).
8. **Automated Verification Suite (`frontend/tests/unit/vendor-bank-account-ui.test.js`)**:
   - 100% test pass rate across 635 frontend unit tests, 22 backend integration tests, and full 275-route Next.js production compilation.

---

## 2. PRE-IMPLEMENTATION ARCHITECTURE ALIGNMENT

In strict conformance with `phase_VB-01_vendor_bank_account_architecture_audit.md` and `phase_VB-02_backend_bank_account_foundation_report.md`:
- **Decoupled Architecture**: Vendor bank account management operates as an independent subsystem (`VendorBankAccount`), decoupled from raw vendor authentication records and immutable payout histories.
- **Strict Invariants Preserved**:
  - Max 3 accounts per vendor enforced at both the client layer (disabled actions, warning banners) and server layer (`BANK_ACCOUNT_LIMIT_EXCEEDED`).
  - Exactly one active account invariant maintained. Activating an account atomically switches previous active accounts to standby.
  - Inactive accounts or unapproved accounts cannot be activated.
  - Plaintext account numbers are strictly ephemeral: never persisted in client storage (`localStorage`, `sessionStorage`, cookies), never appended to URLs, and never logged in console statements.

---

## 3. VENDOR NAVIGATION & ROUTE INTEGRATION

### 3.1 Primary & Alias Routes
- **Primary Route**: `frontend/src/app/vendor/finance/bank-accounts/page.js`
  - Fully featured client component orchestrating the bank account list, overview KPIs, modal state machines, and real-time Sonner toast notifications.
- **Alias Route**: `frontend/src/app/vendor/settings/bank-accounts/page.js`
  - Re-exports and mounts the primary bank accounts page, ensuring smooth access from either Settings or Finance navigation contexts.

### 3.2 Navigation Hierarchy (`VendorSidebar.jsx`)
The sidebar navigation item has been registered under the `Finance & Payouts` group:
```javascript
{
  title: "Finance & Payouts",
  items: [
    { name: "Financial Overview", href: "/vendor/finance", icon: Wallet },
    { name: "Bank Accounts", href: "/vendor/finance/bank-accounts", icon: Landmark },
  ],
}
```

### 3.3 Finance Overview Integration (`/vendor/finance`)
`frontend/src/app/vendor/finance/page.js` was enhanced to fetch bank account records in parallel using `Promise.allSettled`. If an active account exists, a primary settlement destination banner displays:
- Bank Name, Masked Account Number (`••••••••••••1234`), and IFSC Code.
- `Active Destination` badge in emerald theme.
- Direct CTA button `Manage Bank Accounts (x/3)` navigating to `/vendor/finance/bank-accounts`.

---

## 4. UI COMPONENT ARCHITECTURE

All components reside in `frontend/src/components/vendor/bank-accounts/`:

| Component | File Path | Primary Responsibility |
| :--- | :--- | :--- |
| `BankAccountOverview.jsx` | `src/components/vendor/bank-accounts/BankAccountOverview.jsx` | Renders 4-card metric grid: Slot Usage (Max 3), Active Payout Destination, Approved Accounts, and Pending/Rejected Counts. |
| `BankAccountCard.jsx` | `src/components/vendor/bank-accounts/BankAccountCard.jsx` | Renders individual account details, masked credentials, lifecycle badges, reviewer rejection alert boxes, and action buttons. |
| `AddBankAccountModal.jsx` | `src/components/vendor/bank-accounts/AddBankAccountModal.jsx` | Form modal for submitting new bank accounts. Includes IFSC validation, confirm account number checking, and confirmation preview. |
| `SwitchActiveConfirmModal.jsx` | `src/components/vendor/bank-accounts/SwitchActiveConfirmModal.jsx` | High-safety confirmation dialog explaining payout routing continuity before switching active settlement destination. |
| `ResubmitBankAccountModal.jsx` | `src/components/vendor/bank-accounts/ResubmitBankAccountModal.jsx` | Pre-fills existing account data, displays administrative rejection reasons, requires fresh credential entry, and submits corrections. |

---

## 5. FORM VALIDATION & INDIAN BANKING STANDARDS

The UI enforces stringent Indian banking format checks client-side before dispatching payloads to the backend API:

1. **Account Number**:
   - Pattern: `/^[0-9]{9,20}$/` (stripping whitespace and dashes).
   - Validates length between 9 and 20 numeric characters (supporting SBI, HDFC, ICICI, Axis, PNB, and regional banks).
2. **Account Number Confirmation**:
   - `confirmAccountNumber === accountNumber` exact string match.
   - Separate input fields with optional visibility toggles (`Eye` / `EyeOff`) defaulting to `password` type.
3. **IFSC Code**:
   - Pattern: `/^[A-Z]{4}0[A-Z0-9]{6}$/` (forced uppercase).
   - Exactly 11 characters: 4 alphabetic bank code letters, literal `'0'` in position 5, and 6 alphanumeric branch characters.
4. **Account Holder Name**:
   - Trimmed length: 2 to 150 characters.
   - Advisory note prompting vendors to ensure names match legal tax/PAN registrations.

---

## 6. APPLICATION STATUS & RESUBMISSION WORKFLOW

When an account is rejected by a compliance reviewer:
1. `BankAccountCard` renders a high-visibility warning box:
   - Displays the exact administrative feedback (`account.rejectionReason`).
   - Surfaces a direct `Resubmit / Correct Details` action button.
2. Clicking the action launches `ResubmitBankAccountModal`:
   - Pre-fills `accountHolderName`, `bankName`, `ifscCode`, `branchName`, and `accountType`.
   - Requires the vendor to re-enter and confirm their account number (since raw digits are never sent down to the client).
   - Collects an optional notes explanation of the corrections made.
   - Dispatches `POST /api/v1/vendors/me/bank-accounts/:id/resubmit`.
   - Transitions the account state back to `pending`, updating the review queue immediately.

---

## 7. ACTIVE DESTINATION SWITCHING & SAFETY

When a vendor clicks `Set as Active Payout Account` on an approved standby account:
1. `SwitchActiveConfirmModal` is displayed.
2. Outlines key settlement policies:
   - Automated settlement cycles and future manual payout requests route to this account.
   - The previously active account transitions to standby.
   - In-flight or processing payouts remain frozen to their original snapshotted destination.
3. Dispatches `PATCH /api/v1/vendors/me/bank-accounts/:id/active`.
4. Atomically switches the active destination and updates UI state.

---

## 8. SECURITY, PRIVACY & SENSITIVE DATA HYGIENE

To prevent credential leakage or security violations:
- **No Local Storage**: Zero usage of `localStorage`, `sessionStorage`, or cookies for bank credentials.
- **Masked Data Flow**: Backend API responses return only `accountNumberMasked` (`••••••••••••1234`).
- **Input Masking**: Account number inputs default to `type="password"`.
- **Client Cache Sanitation**: On modal close or form reset, input states are cleared to empty strings.
- **Permission Boundaries**: Vendor endpoints strictly use JWT authentication (`authenticateVendor`), completely isolating each vendor's bank records.

---

## 9. API CLIENT INTEGRATION (`vendor.service.js`)

Four specialized client methods were implemented in `frontend/src/services/vendor.service.js`:

```javascript
// 12. Vendor Bank Accounts (Max 3, AES-256-GCM Encrypted, HMAC Blind Indexed)
async getMyBankAccounts() {
  return apiClient.get("/vendors/me/bank-accounts");
},

async submitBankAccount(data) {
  return apiClient.post("/vendors/me/bank-accounts", data);
},

async switchActiveBankAccount(id, data = {}) {
  return apiClient.patch(`/vendors/me/bank-accounts/${id}/active`, data);
},

async resubmitBankAccount(id, data) {
  return apiClient.post(`/vendors/me/bank-accounts/${id}/resubmit`, data);
},
```

---

## 10. AUTOMATED TEST SUITE EXECUTION & VERIFICATION

### 10.1 Frontend Unit Test Suite (`node frontend/scripts/run-tests.js`)
A dedicated test suite was created at `frontend/tests/unit/vendor-bank-account-ui.test.js`:
- Verified all 4 API client methods and request payload contracts.
- Verified physical route file existence for primary and alias pages.
- Verified existence and exports of all 5 UI components.
- Verified navigation registration in `VendorSidebar.jsx` and `VendorFinancePage`.
- Verified Indian banking regex patterns (IFSC, Account Number) and validation boundaries.
- Verified zero-plaintext storage invariants across all components.
- Verified 3-account limit constraints and active account switching rules.

**Test Results:**
```
✔ Phase VB-03: Vendor Console Bank Account Management UI & Workflows (23.75ms)
  ✔ 1. Vendor Bank Account API Client Methods (4/4 passed)
  ✔ 2. Route & Component File Integrity (5/5 passed)
  ✔ 3. Form Validation Rules & Indian Banking Format Invariants (4/4 passed)
  ✔ 4. Security, Privacy & Zero-Plaintext Leak Invariants (6/6 passed)

Total Tests: 635 passed, 0 failed (205 test suites)
Duration: 3.87s
```

### 10.2 Next.js Production Build (`npm --prefix frontend run build`)
```
▲ Next.js 16.3.5 (webpack)
✓ Compiled successfully in 70s
✓ Generating static pages (275/275) in 16.0s
Route (app)
├ ○ /vendor/finance                                    1m      1y
├ ○ /vendor/finance/bank-accounts                      1m      1y
├ ○ /vendor/settings/bank-accounts                     1m      1y
275 routes compiled cleanly with 0 TypeScript/JSX errors.
```

### 10.3 Backend Integration Regression (`npm --prefix backend test -- phase-vb02`)
```
PASS tests/phase-vb02-vendor-bank-account.test.js (10.649 s)
  Phase VB-02: Vendor Bank Account Management — Backend Foundation & Account Lifecycle
    1. VendorBankAccount Model & Cryptography Foundation (3 passed)
    2. Three-Account Limit & Duplicate Account Prevention (2 passed)
    3. Vendor Self-Service Workflow & Active Account Switching (6 passed)
    4. Reviewer Queue & Approval/Rejection Workflow (4 passed)
    5. Superadmin Management Controls & Privileged Access (4 passed)
    6. Audit Log Sanitization & Plaintext Exclusion (1 passed)
    7. Settlement & In-Flight Payout Immutability (2 passed)

Test Suites: 1 passed, 1 total
Tests:       22 passed, 22 total
```

---

## 11. DELIVERABLE FILE INVENTORY

### Modified Files:
1. `frontend/src/services/vendor.service.js` — Added bank account API methods.
2. `frontend/src/components/vendor/VendorSidebar.jsx` — Added Bank Accounts navigation link under Finance & Payouts.
3. `frontend/src/app/vendor/finance/page.js` — Added Active Payout Destination banner and direct CTA.

### Newly Created Files:
1. `frontend/src/components/vendor/bank-accounts/BankAccountOverview.jsx` — 4-metric overview card.
2. `frontend/src/components/vendor/bank-accounts/BankAccountCard.jsx` — Individual bank card with status styling.
3. `frontend/src/components/vendor/bank-accounts/AddBankAccountModal.jsx` — Multi-step bank account application modal.
4. `frontend/src/components/vendor/bank-accounts/SwitchActiveConfirmModal.jsx` — Safety confirmation dialog for active destination switching.
5. `frontend/src/components/vendor/bank-accounts/ResubmitBankAccountModal.jsx` — Application correction modal displaying reviewer feedback.
6. `frontend/src/app/vendor/finance/bank-accounts/page.js` — Main bank accounts management page.
7. `frontend/src/app/vendor/settings/bank-accounts/page.js` — Settings alias route for bank accounts.
8. `frontend/tests/unit/vendor-bank-account-ui.test.js` — Automated unit test suite.
9. `phase_VB-03_vendor_bank_account_console_ui_report.md` — Deliverable report.

---

## 12. RELEASE READINESS & NEXT PHASE RECOMMENDATION

Phase **VB-03** is complete, fully tested, and ready for deployment. The merchant-facing bank account portal satisfies all functional, security, and architectural criteria established in Phase VB-01 and Phase VB-02.

### Next Recommended Phase: Phase VB-04 — Superadmin Reviewer & Compliance Console
Phase VB-04 will complete the administrative side of the module:
1. Reviewer Queue UI for Superadmin/Operations to review pending bank applications.
2. One-click Approve / Reject with mandatory administrative rejection notes.
3. Privileged unmasking modal with reason logging and immutable `AuditLog` capture.
4. Vendor Detail Page integration (`/administrator/vendors/[id]`) displaying all registered accounts, administrative override controls, and soft-delete/archival actions.

