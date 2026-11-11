# BUYBOX E-COMMERCE
## VENDOR WALLET — WITHDRAWAL ELIGIBILITY FORENSIC AUDIT
### PHASE VENDOR-WALLET-A — READ-ONLY DIAGNOSTIC REPORT

**Target Vendor:** Smriti Organic Crafts  
**Vendor ID:** `6ad9afc64e9af87a84de7d6e`  
**Linked User ID:** `6abb3f27f9686f9682658c81` (`itssmriti1333@gmail.com`)  
**Audit Date & Time:** 2026-11-02T19:48:00+05:30 (Current Timestamp: `2026-11-02T14:18:00.000Z`)  
**Execution Mode:** STRICT READ-ONLY FORENSIC AUDIT (Zero application code or database mutations)  
**Priority:** P1 — Vendor Finance  

---

## 1. EXECUTIVE SUMMARY

### 1.1 High-Level Audit Verdict

| Metric Observed in UI | Authoritative Ledger Value | Wallet Projection Cache | Forensic State |
| :--- | :--- | :--- | :--- |
| **Pending Clearing** | **₹34,317.36** | **₹34,317.36** | **100.00% Reconciled (In Escrow Hold)** |
| **Available for Withdrawal** | **₹0.00** | **₹0.00** | **100.00% Reconciled (Not Yet Matured)** |
| **Reserved in Payouts** | **₹0.00** | **₹0.00** | **100.00% Reconciled (Zero Active Payouts)** |
| **Lifetime Gross Earned** | **₹34,317.36** | **₹34,317.36** | **100.00% Reconciled** |
| **Platform Commission** | **₹4,679.64** | **₹4,679.64** | **100.00% Reconciled** |
| **Total Disbursed** | **₹0.00** | **₹0.00** | **100.00% Reconciled** |

### 1.2 Core Audit Conclusions

1. **The Observed ₹0.00 Available Balance is Legitimate & Expected Operationally Today:**
   The observed ₹0.00 available balance is **not** a data corruption error, balance loss, or ledger malfunction. It is the operationally correct result of the platform's 7-day buyer return policy window.
   - **Order 1 (`BB-MVV7IT7M-B44FFC71`)**: Was marked delivered earlier today on `2026-11-02T14:03:58.880Z`. Its contractual 7-day return window does not elapse until **`2026-11-09T14:03:58.880Z`**.
   - **Order 2 (`BB-MVYUVP0S-4CF64623`)**: Was placed earlier today on `2026-11-02T06:06:45.784Z` and is currently in `processing` status (`fulfillmentStatus: "ready_to_ship"`). It has not been delivered, so its return window clock has not started.

2. **CRITICAL ARCHITECTURAL DEFECT IDENTIFIED (Latent Settlement Blocker):**
   While holding funds during the return window is intended, the platform currently has **NO automated background settlement worker or cron job registered in [worker-coordinator.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/workers/worker-coordinator.js)**. 
   Settlement maturation is only callable via a manual Superadmin REST endpoint (`POST /admin/settlements/generate`).
   **Impact:** When Order 1 passes its 7-day return cutoff on **November 9, 2026**, its ₹11,439.12 net earnings will **NOT** automatically transfer from `vendor_pending_earnings` to `vendor_available_earnings`. It will remain indefinitely stuck in "Pending Clearing" until an administrator manually triggers settlement generation or an automated scheduler is implemented.

3. **Vendor Compliance & Banking Status is 100% Verified:**
   Smriti Organic Crafts has satisfied all platform onboarding, KYC, and banking prerequisites:
   - Onboarding Status: `approved` (`approvedAt: 2026-10-22T06:42:17.868Z`)
   - Bank Account: State Bank of India (Basirhat branch, Current A/C `••••••••••••4321`), fully approved by Admin on `2026-10-30T13:11:37.506Z`.
   - The sole blocker preventing withdrawal is the non-elapsed return window on Order 1 and undelivered state of Order 2.

---

## 2. EXACT ₹34,317.36 LEDGER RECONCILIATION

### 2.1 Authoritative Source of Financial Balances

The authoritative source of all wallet balances is the immutable double-entry ledger collection `financialledgerentries`.
The `vendorwallets` document (`_id: 6ae4bd3e0a511889a85d5cb0`) is an atomic read projection calculated and maintained by [financialLedgerService.syncVendorWalletBalances](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/financial-ledger.service.js#L140).

The database audit established exact mathematical parity between the double-entry journal entries and the wallet projection:
- **Ledger Net Pending Credits:** ₹11,439.12 + ₹22,878.24 = **₹34,317.36**
- **Wallet Cached Pending Balance:** **₹34,317.36**
- **Discrepancy:** **₹0.00**

### 2.2 Contributing Orders Forensic Breakdown

```
+-------------------------------------------------------------------------------------------------------------------+
| ORDER 1: BB-MVV7IT7M-B44FFC71                                                                                     |
+----------------------------------+--------------------------------------------------------------------------------+
| MongoDB Order ID                 | 6ae4ca8537625174f6a6c918                                                       |
| Order Item ID                    | 6ae4ca8537625174f6a6c919                                                       |
| Product / SKU                    | Acoustic Pro Wireless Noise-Cancelling Headphones / SOC-AUDIO-ANC-700-SLV     |
| Quantity & Unit Price            | 1 unit @ ₹12,999.00                                                            |
| Gross Line Total                 | ₹12,999.00                                                                     |
| Commission Snapshot Policy       | 12.00% (Policy ID: 6ae4c0a234e2dafc3dd61be3, locked)                            |
| Platform Commission              | ₹1,559.88                                                                      |
| Vendor Net Earnings              | ₹11,439.12                                                                     |
| Current Order Status             | completed                                                                      |
| Item Fulfillment Status          | delivered                                                                      |
| Actual Delivery Date             | 2026-11-02T14:03:58.880Z                                                       |
| Return-Window Duration           | 7 calendar days (168 hours)                                                    |
| Return-Window Expiry Date        | 2026-11-09T14:03:58.880Z                                                       |
| Settlement Maturity Date         | 2026-11-09T14:03:58.880Z                                                       |
| Current Ledger Classification    | vendor_pending_earnings (Credit, Posted)                                       |
| Expected Withdrawal Eligibility  | 2026-11-09T14:03:58.880Z (contingent upon settlement maturation execution)    |
| Contributing Ledger Journal      | JRN-ORD-BB-MVV7IT7M-B44FFC71-6ad9afc64e9af87a84de7d6e                           |
+----------------------------------+--------------------------------------------------------------------------------+
```

```
+-------------------------------------------------------------------------------------------------------------------+
| ORDER 2: BB-MVYUVP0S-4CF64623                                                                                     |
+----------------------------------+--------------------------------------------------------------------------------+
| MongoDB Order ID                 | 6ae8285c2d43c8a795986fa6                                                       |
| Order Item ID                    | 6ae8285c2d43c8a795986fa7                                                       |
| Product / SKU                    | Acoustic Pro Wireless Noise-Cancelling Headphones / SOC-AUDIO-ANC-700-SLV     |
| Quantity & Unit Price            | 2 units @ ₹12,999.00 = ₹25,998.00                                              |
| Gross Line Total                 | ₹25,998.00                                                                     |
| Commission Snapshot Policy       | 12.00% (Policy ID: 6ae4c0a234e2dafc3dd61be3, locked)                            |
| Platform Commission              | ₹3,119.76                                                                      |
| Vendor Net Earnings              | ₹22,878.24                                                                     |
| Current Order Status             | processing                                                                     |
| Item Fulfillment Status          | ready_to_ship (Undelivered)                                                    |
| Actual Delivery Date             | null                                                                           |
| Estimated Delivery Date          | 2026-11-10T00:00:00.000Z                                                       |
| Return-Window Duration           | 7 calendar days post-delivery                                                  |
| Return-Window Expiry Date        | Undetermined (Actual Delivery Date + 7 days)                                   |
| Settlement Maturity Date         | Undetermined (Actual Delivery Date + 7 days)                                   |
| Current Ledger Classification    | vendor_pending_earnings (Credit, Posted)                                       |
| Expected Withdrawal Eligibility  | Estimated 2026-11-17T00:00:00.000Z (if delivered on estimated date)             |
| Contributing Ledger Journal      | JRN-ORD-BB-MVYUVP0S-4CF64623-6ad9afc64e9af87a84de7d6e                           |
+----------------------------------+--------------------------------------------------------------------------------+
```

### 2.3 Mathematical Proof of Reconciliation

$$\begin{aligned}
\text{Gross Customer Payments Captured} &= ₹12,999.00 + ₹25,998.00 = ₹38,997.00 \\
\text{Platform Commission Revenue (12\%)} &= ₹1,559.88 + ₹3,119.76 = ₹4,679.64 \\
\text{Vendor Pending Earnings (88\%)} &= ₹11,439.12 + ₹22,878.24 = \mathbf{₹34,317.36} \\
\text{Discrepancy} &= ₹34,317.36 - (₹38,997.00 - ₹4,679.64) = \mathbf{₹0.00}
\end{aligned}$$

Every single paisa in `pendingBalance` has an auditable, immutable double-entry journal entry tied to a specific order line item and locked commission policy snapshot.

---

## 3. INVESTIGATE SETTLEMENT MATURITY & CONFIGURED RULES

### 3.1 Trace of Settlement Eligibility Engine

In [vendor-settlement.service.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor-settlement.service.js#L275-L291), the settlement calculation function `calculateVendorEligibleSettlement` defines the criteria for when an order is mature:

```javascript
// backend/src/services/vendor-settlement.service.js Line 281-291
const returnWindowCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

const deliveredOrders = await Order.find({
  status: { $in: ["delivered", "completed"] },
  paymentStatus: { $in: ["paid", "partially_refunded"] },
  "items.vendorId": vendor._id,
  $or: [
    { deliveredAt: { $lte: returnWindowCutoff } },
    { deliveredAt: null, updatedAt: { $lte: returnWindowCutoff } },
  ],
}).lean();
```

### 3.2 Evaluation Against Target Orders

1. **Evaluation of Order 1 (`BB-MVV7IT7M-B44FFC71`):**
   - Condition 1: `status in ["delivered", "completed"]` $\rightarrow$ `completed` (**TRUE**)
   - Condition 2: `paymentStatus in ["paid", "partially_refunded"]` $\rightarrow$ `paid` (**TRUE**)
   - Condition 3: `"items.vendorId" == vendor._id` $\rightarrow$ Match (**TRUE**)
   - Condition 4: `deliveredAt <= returnWindowCutoff`
     - `deliveredAt`: `2026-11-02T14:03:58.880Z`
     - `returnWindowCutoff` (as of audit run at 14:18 UTC): `2026-10-26T14:18:00.000Z`
     - Comparison: `2026-11-02T14:03:58.880Z <= 2026-10-26T14:18:00.000Z` $\rightarrow$ **FALSE**
     - Order 1 was delivered only ~15 minutes prior to the start of this investigation (and ~5.5 hours ago in local IST time).
     - It will satisfy `deliveredAt <= returnWindowCutoff` on **`2026-11-09T14:03:58.880Z`**.

2. **Evaluation of Order 2 (`BB-MVYUVP0S-4CF64623`):**
   - Condition 1: `status in ["delivered", "completed"]` $\rightarrow$ `processing` (**FALSE**)
   - Condition 4: `deliveredAt` $\rightarrow$ `null` (**FALSE**)
   - Order 2 has not yet been handed over to the courier/customer.

### 3.3 Rule Configuration Defect: Hardcoded Return Window

- In [StorefrontSettings.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/StorefrontSettings.js#L179), the platform maintains a configurable setting: `returnWindowDays: { type: Number, default: 7 }`.
- However, in [vendor-settlement.service.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor-settlement.service.js#L281), the duration is hardcoded as `7 * 24 * 60 * 60 * 1000`.
- While both currently evaluate to 7 days, the hardcoded multiplier bypasses the dynamic configuration in `StorefrontSettings`.

---

## 4. INVESTIGATE AUTOMATIC SETTLEMENT WORKER (CRITICAL ARCHITECTURAL GAP)

### 4.1 Worker Coordinator Architecture Audit

An inspection of [backend/src/workers/worker-coordinator.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/workers/worker-coordinator.js) and the `backend/src/workers/` directory revealed the following registered background workers:

1. `cart-abandonment` ([cart-abandonment.worker.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/workers/cart-abandonment.worker.js))
2. `order-expiration` ([order-expiration.worker.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/workers/order-expiration.worker.js))
3. `payment-reconciliation` ([payment-reconciliation.worker.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/workers/payment-reconciliation.worker.js))
4. `promotion-lifecycle` ([promotion-lifecycle.worker.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/workers/promotion-lifecycle.worker.js))
5. `notification-dispatcher` ([notification-dispatcher.worker.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/workers/notification-dispatcher.worker.js))
6. `notification-queue-worker` ([notification-queue.worker.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/workers/notification-queue.worker.js))

### 4.2 Settlement Worker Status

| Audit Checkpoint | Findings | Status |
| :--- | :--- | :--- |
| **Worker Registration** | No settlement worker registered in `workerCoordinator`. | **MISSING** |
| **Schedule Activity** | No cron job or recurring scheduler exists for settlement generation. | **NONE** |
| **Service Integration** | `vendorSettlementService.generateEligibleSettlements` is only called via manual API: `POST /api/v1/settlements/generate`. | **MANUAL ONLY** |
| **Maturation Automation** | Reclassifying `vendor_pending_earnings` to `vendor_available_earnings` is never triggered automatically by the system. | **BLOCKED** |

### 4.3 Why Tests Passed But Production Stalls

In the automated test suite [phase-vw03-vendor-wallet-ledger.test.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/tests/phase-vw03-vendor-wallet-ledger.test.js#L619-L623), Test 2.2 explicitly advanced the clock and manually invoked `vendorSettlementService.generateEligibleSettlements(...)`.
Because the service method was tested in isolation, the absence of an automated background cron worker went undetected in test suites.

---

## 5. DOUBLE-ENTRY LEDGER INTEGRITY & JOURNAL PROOF

A complete forensic query was conducted on all entries associated with vendor `6ad9afc64e9af87a84de7d6e` in `financialledgerentries`:

### 5.1 Journal 1: Payment Capture for Order 1

- **Journal ID:** `JRN-ORD-BB-MVV7IT7M-B44FFC71-6ad9afc64e9af87a84de7d6e`
- **Source Event:** `payment_captured` (`orderId: 6ae4ca8537625174f6a6c918`)
- **Status:** `posted`
- **Timestamp:** `2026-10-30T16:49:29.790Z`

```
  Debit:   platform_escrow              ₹12,999.00  (Asset: Customer Payment Gateway)
  Credit:  platform_commission_revenue   ₹1,559.88  (Revenue: 12% Marketplace Commission)
  Credit:  vendor_pending_earnings      ₹11,439.12  (Liability: Pending Vendor Entitlement)
  ------------------------------------------------------------------------------------
  Total Debits: ₹12,999.00 | Total Credits: ₹12,999.00 | Net Balance: ₹0.00 [BALANCED]
```

### 5.2 Journal 2: Payment Capture for Order 2

- **Journal ID:** `JRN-ORD-BB-MVYUVP0S-4CF64623-6ad9afc64e9af87a84de7d6e`
- **Source Event:** `payment_captured` (`orderId: 6ae8285c2d43c8a795986fa6`)
- **Status:** `posted`
- **Timestamp:** `2026-11-02T06:06:45.894Z`

```
  Debit:   platform_escrow              ₹25,998.00  (Asset: Customer Payment Gateway)
  Credit:  platform_commission_revenue   ₹3,119.76  (Revenue: 12% Marketplace Commission)
  Credit:  vendor_pending_earnings      ₹22,878.24  (Liability: Pending Vendor Entitlement)
  ------------------------------------------------------------------------------------
  Total Debits: ₹25,998.00 | Total Credits: ₹25,998.00 | Net Balance: ₹0.00 [BALANCED]
```

### 5.3 Ledger Compliance Checks

- **Debit/Credit Parity:** Exact match to the penny for both journals.
- **Orphan Entries:** Zero orphan entries found.
- **Duplicate Credits:** Idempotency keys (`ord_pay_..._escrow`, `ord_pay_..._comm`, `ord_pay_..._earning`) enforced unique indexing; no duplicates exist.
- **Entry Immutability:** Mongoose schema pre-hooks forbid updates and deletions (`FINANCIAL_LEDGER_IMMUTABLE`).

---

## 6. VERIFY WITHDRAWAL ELIGIBILITY ASSESSMENT

A comprehensive inspection of [withdrawal-request.service.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/withdrawal-request.service.js#L33-L157) evaluated all potential blockers for Smriti Organic Crafts:

| Withdrawal Criterion | Service Check / Requirement | Target Vendor Status | Pass/Fail |
| :--- | :--- | :--- | :--- |
| **Vendor Existence** | `Vendor.findById(vendorId)` | Found (`6ad9afc64e9af87a84de7d6e`) | **PASS** |
| **Vendor Active State** | `vendor.isActive === true` | `true` | **PASS** |
| **Onboarding Status** | `vendor.onboardingStatus === 'approved'` | `approved` (approved on 2026-10-22) | **PASS** |
| **Account Holds/Suspension**| Not `suspended` or `rejected` | Active, in good standing | **PASS** |
| **Bank Account Attached** | `VendorBankAccount.findById(bankAccountId)` | Found (`6ae4713a5953265491a30c0a`) | **PASS** |
| **Bank Account Verification**| `bank.status === 'approved'` | `approved` (approved on 2026-10-30 by Admin) | **PASS** |
| **Bank Account Active** | `bank.isActive && !bank.deletedAt` | Active, not archived | **PASS** |
| **Bank Destination Data** | Holder Name, Bank Name, IFSC, Masked Acc | Complete (SBI, IFSC `SBIS0987654`, Acc `•••4321`) | **PASS** |
| **Minimum Withdrawal** | `amountNum > 0` | Positive number supported | **PASS** |
| **Available Balance** | `requestedAmountMinor <= availableMinor` | `availableMinor = 0` (₹0.00 available) | **FAIL (BLOCKED)** |

### 6.1 Exact Eligibility Decision

```
ELIGIBILITY STATUS: TEMPORARILY BLOCKED BY HOLD POLICY (ZERO AVAILABLE BALANCE)
REASON: Vendor meets 100% of KYC, onboarding, and verified bank account criteria.
        However, authoritative available balance is currently ₹0.00 because all 
        earned funds (₹34,317.36) are legitimately held in post-delivery return escrow.
```

In the Vendor Wallet UI ([frontend/src/app/vendor/finance/wallet/page.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/vendor/finance/wallet/page.js#L268-L274)), the "Request Withdrawal" button has:
```javascript
disabled={availableBalance <= 0 || approvedBanks.length === 0}
```
Because `availableBalance === 0`, the button is correctly and intentionally disabled.

---

## 7. CROSS-VENDOR COMPARATIVE SAMPLE ANALYSIS

To determine whether the issue is isolated to Smriti Organic Crafts or systemic across the marketplace, all vendor records and financial documents were surveyed:

| Vendor Name | ID | Status | Orders (Total/Deliv) | Wallet State | Settlements | Payouts | Observations |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Smriti Organic Crafts** | `6ad9afc6...` | approved | 2 / 1 | Pending: ₹34,317.36<br>Available: ₹0.00 | 0 | 0 | Active modern vendor; waiting on 7-day return window. |
| **Buybox Electronics India** | `6a9955e0...` | inactive | 28 / 3 | None (pre-VW03) | 1 (Paid ₹7,650) | 1 (Paid ₹7,650) | Legacy vendor with single historical settlement in Sept 2026. |
| **Anita Crafts** | `6ab1fd30...` | inactive | 0 / 0 | None | 0 | 0 | Onboarded test vendor; zero sales. |
| **Apex Electronics** | `6ab0e190...` | inactive | 0 / 0 | None | 0 | 0 | Onboarded test vendor; zero sales. |
| **auravue** | `6aafe1c9...` | inactive | 0 / 0 | None | 0 | 0 | Onboarded test vendor; zero sales. |

### 7.1 Cross-Vendor Verdict
- Smriti Organic Crafts is currently the **only active vendor** in the system generating new order volume under the modern double-entry ledger architecture.
- The absence of an automated background settlement worker affects the **entire marketplace platform**, not just Smriti. Any vendor fulfilling orders will encounter the same issue: funds will enter `vendor_pending_earnings` upon payment capture and stay there indefinitely past the 7-day delivery threshold unless an admin triggers the manual endpoint.

---

## 8. CONFIRMED ROOT CAUSE VS EXPECTED BEHAVIOR

### 8.1 What is Confirmed Expected Behavior

1. **Holding Funds in Pending Balance:**
   Holding captured order funds in `vendor_pending_earnings` until the 7-day buyer return policy expires is expected, compliant, and standard e-commerce practice.
2. **Current ₹0.00 Available Balance:**
   Because Order 1 was delivered on `2026-11-02T14:03:58.880Z`, exactly 0 days have elapsed toward its 7-day return window. Order 2 is undelivered. Showing `₹0.00 Available` and `₹34,317.36 Pending Clearing` is 100% correct accounting today.
3. **Disabling Withdrawal Button:**
   The UI correctly disables the "Request Withdrawal" button when `availableBalance <= 0`.

### 8.2 What are Confirmed Defects

1. **DEFECT-FIN-01 (Missing Automated Settlement Worker):**
   No worker or cron scheduler is registered in [worker-coordinator.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/workers/worker-coordinator.js) to periodically scan for delivered orders past `returnWindowCutoff` and invoke `generateEligibleSettlements`.
2. **DEFECT-FIN-02 (Hardcoded Return Window in Service):**
   `vendor-settlement.service.js` hardcodes `7 * 24 * 60 * 60 * 1000` rather than querying `StorefrontSettings.returnWindowDays`.
3. **DEFECT-UI-01 (Vendor Clearance Timeline Visibility):**
   The Vendor Wallet UI displays "Pending Clearing" as an aggregated total (₹34,317.36) but provides no breakdown showing:
   - Which orders contribute to the pending total.
   - The delivery date of each order.
   - The countdown or expected date of release into available balance (e.g., "Matures on 09 Nov 2026").
   This lack of visibility causes vendors to believe their funds are missing or blocked when they are simply in escrow.

---

## 9. PRIORITIZED REMEDIATION PLAN (PHASE VENDOR-WALLET-B)

### Phase 1: Automated Background Settlement Worker (Priority: P1)
1. Create `backend/src/workers/vendor-settlement.worker.js`:
   - Implement scheduled batch settlement execution using Redis distributed locking (`redlock`).
   - Run hourly or once daily at midnight UTC.
   - Invoke `vendorSettlementService.generateEligibleSettlements()` across all approved active vendors.
   - Include error handling, retry limits, and execution logging.
2. Register the settlement worker in [worker-coordinator.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/workers/worker-coordinator.js).

### Phase 2: Dynamic Return Window Configuration (Priority: P2)
1. Update `calculateVendorEligibleSettlement` in [vendor-settlement.service.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor-settlement.service.js#L281):
   - Retrieve `returnWindowDays` dynamically from `storefrontSettingsService.getSettings()`, defaulting to 7 days if unconfigured.

### Phase 3: Vendor Wallet Clearance Timeline UX (Priority: P2)
1. Enhance [frontend/src/app/vendor/finance/wallet/page.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/vendor/finance/wallet/page.js):
   - Add an "Escrow & Maturation Schedule" tab or drawer.
   - For orders in `pending_earnings`, display the order number, item summary, delivered date, return window progress bar, and projected clearance date.

---

## 10. TEST & VERIFICATION RECOMMENDATIONS

Before closing Phase VENDOR-WALLET-B, the following tests must be implemented and executed:

1. **Automated Worker Unit & Lifecycle Tests:**
   - Verify `vendor-settlement.worker.js` acquires and releases distributed locks cleanly.
   - Verify worker handles database connectivity drops gracefully.
2. **End-to-End Maturation Worker Test:**
   - Seed an order delivered 8 days in the past.
   - Execute the worker run.
   - Assert `VendorSettlement` is created, `SETTLEMENT_MATURED` journal is posted, `vendor_pending_earnings` decreases, and `vendor_available_earnings` increases.
3. **Immutability & Idempotency Regression Tests:**
   - Ensure rerun of the settlement worker on the same batch does not post duplicate journals or inflate available balance.
4. **Target Vendor Simulation (Nov 9 Date Advance):**
   - In a test replica, advance the system timestamp past `2026-11-09T14:03:58.880Z`.
   - Verify Order 1's ₹11,439.12 matures into `availableBalance` and enables the "Request Withdrawal" button.

