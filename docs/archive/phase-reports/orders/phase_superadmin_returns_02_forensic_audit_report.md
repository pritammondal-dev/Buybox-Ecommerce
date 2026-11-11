# BUYBOX E-COMMERCE

# PHASE SUPERADMIN-RETURNS-02: FORENSIC AUDIT & GAP ANALYSIS REPORT

## Complete Superadmin Return Operations, Payment Visibility & Refund Control

**Phase:** SUPERADMIN-RETURNS-02  
**Audit Date:** November 9, 2026  
**Auditor:** Principal MERN Architect & Forensic Security Auditor  
**Scope:** Read-Only Audit of Return Request Models, Services, Controllers, Payment/Refund Architecture, Administrative Dashboards, and RBAC Enforcement  
**Strict Rule:** No application code changes made during this forensic audit stage.

---

## 1. AUDIT OVERVIEW & OBJECTIVE

The objective of this forensic audit is to evaluate the existing Return Management infrastructure across both Vendor and Superadmin surfaces, analyze payment and refund visibility, audit lifecycle state transition rules, inspect administrative governance capabilities, and establish a clear gap analysis between the Vendor Return Dashboard and Superadmin Return Dashboard.

This forensic discovery will serve as the architectural blueprint for implementing Phase SUPERADMIN-RETURNS-02.

---

## 2. EXISTING ARCHITECTURAL INSPECTION

### 2.1 Backend Data Models

1. **`backend/src/models/ReturnRequest.js`:**
   - **Lifecycle Statuses:** `requested`, `under_review`, `approved`, `rejected`, `pickup_scheduled`, `picked_up`, `received`, `inspected`, `refund_pending`, `refunded`, `replacement_fulfillment`, `replacement_shipped`, `exchange_completed`, `exchange_fulfilled`, `cancelled`.
   - **Financial Fields:** `refundAmount`, `taxRefundTotal`, `shippingRefundTotal`, `customerDeductionsTotal`, `previouslyRefundedTotal`, `discountDeductedTotal`, `netItemRefundTotal`, `refundId`.
   - **Quality Inspection Object:** `inspectedBy`, `inspectedAt`, `passed`, `outcome`, `status`, `receivedCondition`, `packagingCondition`, `productCondition`, `missingAccessories`, `missingAccessoriesNotes`, `photos`, `notes`, `deductionAmount`, `deductionReason`, `deductionCategory`, `restocked`.
   - **Reverse Logistics:** `reversePickupSchedule` (`carrier`, `awbNumber`, `trackingNumber`, `scheduledDate`, `timeSlot`, `status`, `notes`).
   - **Timeline:** Append-only timeline with `status`, `notes`, `timestamp`, `actor` (`actorType`, `actorId`).

2. **`backend/src/models/Order.js`:**
   - **Payment & Financial Tracking:** `grandTotal`, `subtotal`, `taxTotal`, `shippingTotal`, `discountTotal`, `couponDiscountTotal`, `amountPaid`, `amountRefunded`, `currency`.
   - **Payment State:** `paymentStatus` (`pending`, `authorized`, `paid`, `failed`, `refunded`, `partially_refunded`), `paymentMethod` (`card`, `upi`, `netbanking`, `wallet`, `cod`, `paypal`, etc.).
   - **Payment History:** `paymentAttempts` array recording `attemptNumber`, `gateway`, `method`, `amount`, `status`, `gatewayOrderId`, `gatewayPaymentId`, `failureReason`, `completedAt`.

3. **`backend/src/models/Payment.js`:**
   - Authoritative gateway record for prepaid transactions.
   - Fields: `orderId`, `customerId`, `gateway` (`razorpay`, `paypal`, `internal`), `gatewayOrderId`, `gatewayPaymentId`, `amount`, `currency`, `status` (`created`, `pending`, `authorized`, `captured`, `failed`, `cancelled`, `partially_refunded`, `refunded`), `method`, `refundedAmount`, `refundReservedAmount`, `capturedAt`, `idempotencyKey`.

4. **`backend/src/models/Refund.js`:**
   - Authoritative refund record.
   - Fields: `paymentId`, `orderId`, `customerId`, `gateway`, `gatewayRefundId`, `amount`, `currency`, `status` (`created`, `pending`, `processed`, `failed`, `cancelled`), `reason`, `failureReason`, `idempotencyKey`, `processedAt`.
   - Unique compound index on `{ gateway: 1, idempotencyKey: 1 }` prevents concurrent double-refunds.

5. **`backend/src/models/AuditLog.js`:**
   - Append-only schema with Mongoose pre-save and pre-update/delete hooks strictly throwing errors on any update or deletion attempt.
   - Fields: `actorId`, `targetId`, `action`, `entityType`, `beforeState`, `afterState`, `reason`, `ipAddress`, `userAgent`, `createdAt`.

---

### 2.2 Backend Services & Controllers

1. **`backend/src/services/return-request.service.js`:**
   - Contains `getAdminReturns`, `getAdminReturnById`, `approveReturnRequest`, `rejectReturnRequest`, `scheduleReversePickup`, `confirmReversePickup`, `inspectReturnRequest`, `fulfillExchangeRequest`, `receiveReturnAndRestock`, `processReturnRefund`.
   - **Audit Findings:**
     - `getAdminReturnById` populates `orderId`, `customerId`, `vendorId`, `inspection.inspectedBy`.
     - **Deficiency 1:** It does **not** fetch or attach the authoritative `Payment` record or `Order.paymentAttempts`, leaving payment details opaque.
     - **Deficiency 2:** It does **not** fetch or attach the list of `Refund` records associated with `orderId` or `ret.refundId`, obscuring the gateway transaction status, failure reason, or refund completion timestamp.
     - **Deficiency 3:** It does **not** query or return `AuditLog` records for `ret._id`, leaving Superadmins without administrative audit history.
     - **Deficiency 4 (State Transition Lock):** `approveReturnRequest` strictly rejects calls when `ret.status` is `'rejected'`, and `rejectReturnRequest` rejects calls when `ret.status` is `'approved'`. This makes it impossible for Superadmins to **override vendor rejections** or **override vendor acceptances** when intervening on customer disputes or vendor abuse!
   - **`getAdminReturns`:**
     - Currently supports only basic pagination and simple status/type filters.
     - **Deficiency 5:** Omit operational KPIs (14 metrics requested by Phase 8).
     - **Deficiency 6:** Lacks comprehensive server-side filtering by `orderNumber`, `customer`, `vendor`, `date range`, `refundStatus`, `paymentMethod`, and `reason`.

2. **`backend/src/services/refund.service.js` & `refund-webhook.service.js`:**
   - `createRefund` securely manages decimal to minor units conversion, payment status checks, idempotency, gateway execution (Razorpay/PayPal), and ledger synchronization.
   - Webhook processor handles `refund.processed` and `refund.failed`, updating `ReturnRequest` status to `refunded` or recording failure in `timeline`.

---

## 3. GAP ANALYSIS: VENDOR RETURN DASHBOARD VS. SUPERADMIN RETURN DASHBOARD

| Dimension / Capability           | Vendor Return Dashboard (`/vendor/returns/[id]`) | Current Superadmin Dashboard (`/administrator/operations/returns/[id]`) | Missing Functionality & Required Remediation                                                                                                                                                  |
| :------------------------------- | :----------------------------------------------- | :---------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data Scope & Tenancy**         | Isolated to vendor's items (`vendorId`)          | Global / All vendors                                                    | Needs tenant-safe data handling and vendor account status badges.                                                                                                                             |
| **Original Payment Info**        | Basic order total and method                     | Only `orderId.paymentMethod` and `grandTotal`                           | **Missing:** Authoritative `Payment` record: gateway provider, transaction ID (`gatewayPaymentId`), reference ID (`gatewayOrderId`), capture amount, payment date, COD reconciliation status. |
| **Refund Calculation**           | 5-pillar breakdown                               | 5-pillar breakdown (reused from Phase 1)                                | Needs explicit remaining refundable amount calculation (`capturedAmount - previouslyRefunded - currentRefund`).                                                                               |
| **Previous Refund History**      | `previouslyRefundedTotal` scalar                 | `previouslyRefundedTotal` scalar                                        | **Missing:** Itemized list of previous refunds on the order from `Refund` model with amounts, dates, and statuses.                                                                            |
| **Refund Transaction History**   | None (only return status)                        | None                                                                    | **Missing:** Gateway refund records (`Refund` model) with gateway refund ID, status (`processed`, `pending`, `failed`), failure reason, and retry controls.                                   |
| **Vendor Decision History**      | Implicit (vendor's own actions)                  | Embedded in timeline                                                    | **Missing:** Explicit Vendor Decision card highlighting vendor's action, decision date, vendor notes, and override status.                                                                    |
| **Administrative Audit History** | None (vendor not allowed to see admin audits)    | None                                                                    | **Missing:** Chronological audit log card querying `AuditLog` collection with actor identity, role, before/after states, and reasons.                                                         |
| **Override Vendor Rejection**    | Disallowed (vendor cannot override self)         | Blocked by `INVALID_STATUS_TRANSITION`                                  | **Remediation:** Implement Superadmin override transition from `rejected` to `approved` with mandatory reason and immutable audit log.                                                        |
| **Override Vendor Acceptance**   | Disallowed                                       | Blocked by `INVALID_STATUS_TRANSITION`                                  | **Remediation:** Implement Superadmin override transition from `approved` to `rejected` with mandatory reason, item restoration, and audit log.                                               |
| **Refund Retry**                 | Disallowed for vendor                            | Incomplete error recovery                                               | **Remediation:** Dedicated safe refund retry endpoint and UI button for `failed` or `uncertain` gateway refunds.                                                                              |
| **Dashboard KPIs**               | Basic counts                                     | No aggregate KPIs                                                       | **Missing:** 14 operational KPIs calculated server-side across the entire filtered dataset.                                                                                                   |
| **Listing Filters**              | Basic status tabs                                | Status filter and search only                                           | **Missing:** Multi-parameter server-side filters (order ID, customer, vendor, date range, refund status, payment method, reason).                                                             |

---

## 4. FIELD-BY-FIELD SOURCE OF TRUTH MAPPING

| Field / Concept             | Authoritative Source of Truth                         | Current Status in API               | Required Remediation                                                                     |
| :-------------------------- | :---------------------------------------------------- | :---------------------------------- | :--------------------------------------------------------------------------------------- |
| **Payment Method**          | `Order.paymentMethod` / `Payment.method`              | Exposed as string in `orderId`      | Unify and display formatted label with gateway badge.                                    |
| **Payment Gateway**         | `Payment.gateway` (`razorpay`, `paypal`, `internal`)  | Not exposed in `getAdminReturnById` | Query latest `Payment` by `orderId` and expose in `originalPayment` DTO.                 |
| **Gateway Transaction ID**  | `Payment.gatewayPaymentId`                            | Not exposed                         | Expose in `originalPayment.transactionId`.                                               |
| **Gateway Order / Ref ID**  | `Payment.gatewayOrderId` / `receipt`                  | Not exposed                         | Expose in `originalPayment.referenceId`.                                                 |
| **Payment Status**          | `Payment.status` / `Order.paymentStatus`              | Only `Order.paymentStatus` exposed  | Expose both gateway capture state and order payment status.                              |
| **Order Total Amount**      | `Order.grandTotal`                                    | Exposed                             | Preserved.                                                                               |
| **Captured Amount**         | `Payment.amount` or `Order.amountPaid`                | Not exposed                         | Expose in `originalPayment.amountCaptured`.                                              |
| **Payment Date**            | `Payment.capturedAt` or `Order.placedAt`              | Only `placedAt` exposed             | Expose in `originalPayment.paymentDate`.                                                 |
| **COD Collection Status**   | `Order.paymentStatus`, `Order.deliveredAt`            | Not distinguished                   | Derive explicit COD states: `pending_delivery`, `cash_collected`, `reconciled`.          |
| **Refund Transaction List** | `Refund` collection (`orderId: ret.orderId`)          | Not queried in `getAdminReturnById` | Query `Refund.find({ orderId: ret.orderId })` and return formatted `refundTransactions`. |
| **Previous Refund Total**   | Sum of processed refunds on `orderId`                 | Scalar `previouslyRefundedTotal`    | Reconcile scalar with sum of existing processed refunds.                                 |
| **Remaining Refundable**    | `capturedAmount - previouslyRefunded - currentRefund` | Not computed                        | Compute server-side and expose in `refundBreakdown.finalRefund`.                         |
| **Admin Audit History**     | `AuditLog` collection (`targetId: ret._id`)           | Not queried                         | Query `AuditLog.find({ targetId: ret._id })` and return formatted `auditHistory`.        |
| **Vendor Decision Status**  | `ReturnRequest.timeline` + vendor status              | Inferred from timeline              | Formulate structured `vendorDecision` object in API response.                            |

---

## 5. PLANNED REMEDIATION STRATEGY

### Step 1: Backend Service Enhancements (`return-request.service.js`)

1. **Enrich `getAdminReturnById`:**
   - Fetch `Payment` via `Payment.findOne({ orderId: ret.orderId })` (or `paymentRepository.findLatestByOrderId`).
   - Derive structured `originalPayment` object (gateway, method, transaction ID, reference ID, payment status, amount, captured amount, payment date, COD status).
   - Fetch `Refund` records via `Refund.find({ orderId: ret.orderId }).sort({ createdAt: -1 })`.
   - Calculate authoritative `remainingRefundableAmount`.
   - Fetch `AuditLog` records via `AuditLog.find({ targetId: ret._id }).sort({ createdAt: -1 }).populate("actorId", "firstName lastName name email role")`.
   - Construct structured `vendorDecision` summary.
2. **Superadmin Decision Overrides (`approveReturnRequest` & `rejectReturnRequest`):**
   - In `approveReturnRequest`: When called by an admin (`isAdmin: true`), allow overriding from status `rejected` if a mandatory reason is provided. Log `action: "RETURN_OVERRIDE_APPROVED"`.
   - In `rejectReturnRequest`: When called by an admin (`isAdmin: true`), allow overriding from status `approved` if a mandatory reason is provided, decrementing returned quantities on order items appropriately. Log `action: "RETURN_OVERRIDE_REJECTED"`.
3. **Safe Refund Retry:**
   - In `processReturnRefund`: When an existing refund has status `failed` or uncertain timeout, allow safe retry with new attempt tracking while maintaining idempotency safeguards.
4. **Enrich `getAdminReturns`:**
   - Compute the 14 operational KPIs using database aggregation across the complete dataset.
   - Implement server-side filtering for `orderNumber`, `customer`, `vendor`, `startDate`, `endDate`, `refundStatus`, `paymentMethod`, and `reason`.

### Step 2: Backend Routes & Controller Updates

- Verify and add route endpoints for overrides and safe retry if needed, ensuring strict role and permission checks (`requireRoles`, `requirePermissions(PERMISSIONS.RETURNS_APPROVE)`, `requirePermissions(PERMISSIONS.REFUNDS_CREATE)`).

### Step 3: Frontend Administrator Detail Page (`/administrator/operations/returns/[id]/page.js`)

- Render all 15 required dossier sections.
- Separate independent status badges:
  1. Original payment status badge.
  2. Return acceptance status badge.
  3. Physical return status badge.
  4. Inspection status badge.
  5. Refund authorization status badge.
  6. Actual refund transaction status badge.
- Add dedicated cards:
  - **Original Payment Information** (Gateway, transaction IDs, captured amount, COD state, fallback to explicit unavailable/unverified state).
  - **Previous Refund History** (Table of past refunds on order).
  - **Refund Transaction History** (Gateway refund records, statuses, failure reasons, retry action).
  - **Vendor Decision & Intervention** (Vendor action summary, override badges).
  - **Administrative Audit History** (Append-only audit trail).
- Add action modals: Override Rejection, Override Acceptance, Retry Refund, Disburse Refund, with mandatory reason inputs and loading states.

### Step 4: Frontend Listing Dashboard (`/administrator/operations/returns/page.js`)

- Operational KPIs dashboard strip with all 14 metrics.
- Comprehensive search and filter bar (Return #, Order #, Customer, Vendor, Date Range, Status, Refund Status, Payment Method, Reason).
- Server-side pagination and sorting.

### Step 5: Verification & Testing

- Create dedicated 25-scenario test suite `backend/tests/phase-superadmin-returns-02.test.js`.
- Execute regression test suites.
- Run Next.js production build (`npm --prefix frontend run build`).

---

## 6. AUDIT CONCLUSION & READINESS

The existing codebase provides a solid foundation from Phase SUPERADMIN-RETURNS-01. The gap analysis is complete, data sources of truth are mapped, and the required remediations are cleanly isolated without modifying unrelated modules or duplicating refund calculation engines.

**Forensic Audit Stage Complete. Proceeding to implementation with user authorization.**
