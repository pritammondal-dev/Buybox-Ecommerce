# BUYBOX E-COMMERCE — SECURITY REPORT
## Phase: MERCHANT-REFUND-GOVERNANCE-01
### Merchant Refund Application & Admin/Superadmin Disbursement Authority Separation

**Document Reference:** `phase_merchant_refund_governance_01_security_report.md`  
**Security Classification:** Highly Confidential / Enterprise Financial Core  
**Audit Standard:** ISO/IEC 27001 / OWASP Top 10 API Security / PCI-DSS Principle of Least Privilege  
**Status:** VERIFIED & HARDENED

---

## 1. EXECUTIVE SECURITY SUMMARY

Phase `MERCHANT-REFUND-GOVERNANCE-01` rectifies the fundamental architectural vulnerability of direct merchant refund disbursement in the multi-vendor marketplace.

In standard multi-vendor architectures, granting merchants the capability to trigger outbound bank/gateway transfers introduces severe risks of malicious drain, collusion, calculation manipulation, and balance falsification. Under this governance phase, **Merchants are permanently and strictly stripped of payment gateway disbursement authority**.

The platform now enforces a dual-custody governance model:
1. **Merchants** inspect returned physical inventory, document condition and deductions, and submit a formal **Refund Disbursement Application**.
2. **Administrators / Superadmins** independently review evidence, verify calculation against authoritative order capture ceilings, demand revisions if deductions are unjustified, and execute the payment disbursement via an idempotent, guarded gateway pipeline.

```
       MERCHANT REALM                                       ADMINISTRATOR REALM
 [Physical Inspection]                                  [Disbursement Governance]
           │                                                        │
           ▼                                                        ▼
 [Draft Deductions]                                      [Evidence Audit Queue]
           │                                                        │
           ▼                                                        ▼
[Submit Refund Application] ──(HTTP 201)──> [Application] <──[Review / Request Revision]
           │                                   Pending              │
           │                                      │                 ▼
   ❌ Direct Gateway                              │         [Approve Application]
   Disbursement Blocked                           │                 │
      (HTTP 403)                                  │                 ▼
                                                  └────────> [Execute Disbursement]
                                                                    │
                                                                    ▼
                                                            [Payment Gateway]
                                                              (Stripe/Razorpay)
```

---

## 2. AUTHORITY BOUNDARY & SEPARATION OF POWERS AUDIT

### 2.1 The Merchant Disbursement Quarantine
The legacy route `POST /api/v1/returns/:id/refund` and vendor endpoint `POST /api/v1/vendor/returns/:id/refund` historically allowed vendor tokens to trigger `processReturnRefund`.

**Remediation Applied:**
In [`backend/src/services/return-request.service.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/return-request.service.js#L1380-L1395), an explicit security check was introduced:
```javascript
const isAdmin = user && (user.role === "admin" || user.role === "superadmin" || user.isAdmin === true);
if (!isAdmin) {
  const err = new Error(
    "Merchants are not authorized to directly disburse refunds. Please submit a Refund Application for Administrator review and disbursement."
  );
  err.statusCode = 403;
  err.code = "MERCHANT_DISBURSEMENT_UNAUTHORIZED";
  throw err;
}
```
Any direct request by a vendor token immediately fails with HTTP 403 Forbidden and error code `MERCHANT_DISBURSEMENT_UNAUTHORIZED`.

### 2.2 Granular RBAC / PBAC Permission Registry
Six granular permissions were added to [`backend/src/constants/permissions.constants.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/constants/permissions.constants.js) and synchronized with [`frontend/src/constants/permissions.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/constants/permissions.js):

| Permission Key | Canonical Name | Target Actions | Permitted Roles |
| :--- | :--- | :--- | :--- |
| `REFUND_APPLICATIONS_VIEW` | `refund_applications:view` | View disbursement application queue, details, KPIs, and audit logs | Superadmin, Admin, Finance Officer, Auditor |
| `REFUND_APPLICATIONS_REVIEW` | `refund_applications:review` | Mark application "Under Review", assign reviewer, append review notes | Superadmin, Admin, Finance Officer |
| `REFUND_APPLICATIONS_APPROVE` | `refund_applications:approve` | Approve application and lock approved amount | Superadmin, Admin, Finance Manager |
| `REFUND_APPLICATIONS_REJECT` | `refund_applications:reject` | Formally reject refund application with audited rejection reason | Superadmin, Admin, Compliance Lead |
| `REFUND_APPLICATIONS_REVISE` | `refund_applications:revise` | Return application to vendor requesting evidence/deduction adjustment | Superadmin, Admin, Claims Specialist |
| `REFUND_DISBURSEMENT_INITIATE` | `refund_disbursement:initiate` | Execute outbound payment gateway refund or retry failed disbursement | Superadmin, Admin (Elevated Finance only) |

### 2.3 Strict Dynamic Alias Mapping
To prevent permission mismatch between legacy dotted tokens and colon tokens, the RBAC middleware and UI guards incorporate bidirectional normalization:
- `refund_applications:view` $\iff$ `refund_applications.view`
- `refund_disbursement:initiate` $\iff$ `refund_disbursement.initiate`

Custom role tokens retain precise permission enforcement without granting wildcard bypass.

---

## 3. MULTI-TENANT ISOLATION GUARANTEES

### 3.1 Tenant Verification at Application Submission
When a merchant submits an application via `POST /api/v1/returns/:id/refund-application`:
1. The authenticated user's vendor record is resolved: `vendor = await Vendor.findOne({ userId: req.user._id })`.
2. The targeted `ReturnRequest` is looked up.
3. In [`backend/src/services/refund-application.service.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/refund-application.service.js):
```javascript
if (ret.vendorId.toString() !== vendor._id.toString()) {
  const err = new Error("Return request not found");
  err.statusCode = 404;
  err.code = "RETURN_NOT_FOUND";
  throw err;
}
```
**Security Invariant:** Even if Vendor B guesses or probes the ObjectId of Vendor A's return, the system responds with HTTP 404 `RETURN_NOT_FOUND`, preventing existence disclosure (timing attacks / resource enumeration).

### 3.2 Tenant Isolation on Queries
Vendor queries for applications are strictly scoped by `vendorId: vendor._id`. A merchant cannot list, filter, or inspect refund applications belonging to another merchant.

---

## 4. FINANCIAL CEILINGS & LEDGER INTEGRITY

### 4.1 Authoritative 5-Pillar Breakdown Recalculation
Merchants cannot arbitrary submit a custom refund amount. During submission:
- The system independently executes `calculateAuthoritativeRefundBreakdown(order, returnItem)` using canonical product price, item-level discounts, return quantity, customer delivery fees, and order-level discount allocations.
- Merchant deductions (`restockingFee`, `damageDeduction`, `otherDeductions`) are clamped:
  $$\text{Deductions} \ge 0$$
  $$\text{Net Refund} = \max(0, \text{Gross Refund} - \text{Total Deductions})$$
- The computed net refund is locked into `breakdownSnapshot` with high-precision `Decimal128` values.

### 4.2 Non-Exceedance of Captured Payment Ceiling
In `approveRefundApplication` and `disburseRefundApplication`:
- The approved and disbursed amounts are strictly validated against `order.totalPaid` and the item's proportional capture amount:
  $$\text{Disbursed Amount} \le \text{Captured Amount} - \text{Prior Refunds}$$
- Any attempt by an admin or corrupted payload to disburse more than the item's net paid amount throws HTTP 400 `DISBURSEMENT_EXCEEDS_CAP`.

### 4.3 High-Precision Decimal Representation
To eliminate floating point roundoff errors (\$0.10 + \$0.20 = \$0.30000000000000004), all schema fields for currency are stored as Mongoose `Decimal128`. In API serialization, these are cleanly converted to string representation (`"1500.00"`), ensuring precision across all microservices and frontend clients.

---

## 5. REPLAY PREVENTION & CONCURRENCY CONTROLS

### 5.1 Idempotency Key Generation
Every refund disbursement execution generates a cryptographically sound, collision-resistant idempotency key:
$$\text{idempotencyKey} = \text{sha256}(\text{applicationNumber} + \text{"-"} + \text{orderId} + \text{"-"} + \text{attemptNumber})$$
This key is passed to the payment gateway (Stripe `Idempotency-Key` or Razorpay `X-Razorpay-Idempotency-Key`), guaranteeing that network retries or concurrent clicks never produce duplicate customer payouts.

### 5.2 Atomic State Transitions
Status updates use atomic MongoDB preconditions:
```javascript
const app = await RefundApplication.findOneAndUpdate(
  { _id: applicationId, applicationStatus: "approved" },
  { $set: { applicationStatus: "disbursed", disbursedAt: new Date() } },
  { new: true }
);
```
If two administrators click "Disburse" simultaneously, only one transition succeeds; the second receives an invalid status error and is aborted before invoking the gateway.

### 5.3 Decoupled Gateway Reliability Handling
In the event that the payment gateway encounters a network timeout or external failure:
- The application status is transitioned to `failed` with the error reason recorded in `auditLog`.
- The `ReturnRequest` remains in `refund_pending` and is **not** prematurely marked `refunded`.
- The system returns HTTP 502 `DISBURSEMENT_GATEWAY_FAILED`.
- A dedicated administrative retry endpoint (`POST /api/v1/refund-applications/:id/retry`) is provided, requiring explicit admin intervention and generating a fresh attempt identifier.

---

## 6. THREAT MODEL & MITIGATION MATRIX

| Threat Scenario | Vector / Payload | Impact Without Control | Mitigation Implemented | Verified Status |
| :--- | :--- | :--- | :--- | :--- |
| **T1: Direct Gateway Drain by Merchant** | Merchant invokes `POST /api/v1/returns/:id/refund` with authenticated vendor bearer token | Unauthorized debit of platform merchant escrow / reserve account | `MERCHANT_DISBURSEMENT_UNAUTHORIZED` (HTTP 403) hard check in `return-request.service.js` | **PASSED** (Test Scenario 1 & 2) |
| **T2: Cross-Tenant Application Submission** | Vendor A submits refund application for Return belonging to Vendor B | Exposure of competitor order details; unauthorized refund submission | Vendor ID mismatch generates HTTP 404 `RETURN_NOT_FOUND` | **PASSED** (Test Scenario 4) |
| **T3: Premature Application Submission** | Vendor submits refund application before unboxing & inspection | Refund initiated for items not physically received or assessed | `RETURN_NOT_INSPECTED` (HTTP 400) rejects submission if status is not `received` | **PASSED** (Test Scenario 3) |
| **T4: Concurrent Double Application** | Rapid duplicate clicks on "Submit Refund Application" | Double refund liability queue entry | `ACTIVE_APPLICATION_EXISTS` (HTTP 409) compound unique index enforcement | **PASSED** (Test Scenario 7) |
| **T5: Excessive Merchant Deductions** | Vendor submits negative fees or deductions exceeding item price | Arbitrary net refund calculation | Zod positive number validation + clamping net refund to maximum of 0 | **PASSED** (Test Scenario 5) |
| **T6: Unauthorized Admin Approval** | Non-privileged admin staff attempts to approve or disburse | Bypassing audit trail & separation of duties | PBAC middleware checks `refund_applications:approve` and `refund_disbursement:initiate` | **PASSED** (Test Scenario 11) |
| **T7: Gateway Timeout Orphan State** | Gateway drops connection mid-transfer | Application marked complete without actual funds transfer | Status set to `failed`; HTTP 502 raised; retry endpoint provided | **PASSED** (Test Scenario 16 & 17) |

---

## 7. AUDIT TRAIL & COMPLIANCE VERIFICATION

Every modification to a `RefundApplication` appends an immutable entry to `auditLog`:
- `action`: State transition name (`submitted`, `reviewed`, `revision_requested`, `resubmitted`, `approved`, `disbursed`, `rejected`, `failed`).
- `performedBy`: User ObjectId.
- `performedByRole`: Role identifier (`vendor`, `admin`, `superadmin`).
- `notes`: Justification or feedback.
- `metadata`: Gateway transaction IDs, diffs, or snapshot references.
- `timestamp`: UTC ISO 8601 timestamp.

The audit log is append-only and strictly read-only for all users, fulfilling SOC 2 Type II and PCI-DSS compliance requirements for financial state changes.
