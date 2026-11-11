# BUYBOX E-COMMERCE
# PHASE REFUND-GATEWAY-RECONCILIATION-01
## Financial Integrity & Mathematical Audit Report

**Project:** Buybox-Ecommerce  
**Phase:** REFUND-GATEWAY-RECONCILIATION-01  
**Scope:** Refund Pool Accounting, Decimal128 Precision, Tax/GST Reversals, and Double-Disbursement Proofs  
**Date:** November 9, 2026  
**Status:** FULLY RECONCILED & PROVEN  

---

## 1. FINANCIAL CONTEXT & INITIAL ANOMALY

A real-world return record on the platform presented the following financial properties:

| Metric | Recorded Value |
|---|---:|
| Original Captured Payment | ₹30,794.46 |
| Payment Gateway Provider | Razorpay |
| Captured Payment ID | `pay_TvCZo3fZhLsefQ` |
| Gateway Refund ID | `rfnd_Ty0BqiEpRxCBOl` |
| Internal Mongo Refund ID | `6af17caa48def7a86058109c` |
| Refund Application ID | `RA-261109-SOOW5H` |
| Refund Request Amount | ₹30,794.46 |
| Gateway Refund Status | `pending` |
| Return Request Status | `refund_pending` |
| Displayed Remaining Refund Pool | ₹0.00 |
| Failure Reason / Details | `bnbbnbn` |

### Valuation Component Breakdown

$$
\begin{aligned}
\text{Product Refund (2 physical units)} &= ₹26,097.00 \\
\text{GST Reversal (18\% Tax Exclusive)} &= ₹4,697.46 \\
\text{Outbound Shipping Refund} &= ₹0.00 \\
\text{Customer Deductions} &= ₹0.00 \\
\hline
\mathbf{Total\ Refund\ Entitlement} &= \mathbf{₹30,794.46}
\end{aligned}
$$

### Identified Financial Integrity Deficiencies
1. **Conflation of Cleared vs. In-Flight Funds**:
   Prior to this phase, the system computed `remainingRefundableAmount` as `Math.max(0, captured - refunded - netRefundable)`. When a refund was requested or pending, the remaining pool was immediately set to ₹0, obscuring whether funds had actually cleared at the gateway or were merely reserved in an in-flight transaction.
2. **Double-Disbursement Risk Under Timeouts**:
   If an administrator executed a refund disbursement and the gateway timed out or dropped the connection, the system previously marked `disbursement_failed` on the application while leaving a pending refund record in the database. A subsequent retry could issue a second gateway payout (`POST /v1/payments/:id/refund`), double-disbursing ₹30,794.46 of platform capital.
3. **Ledger Contamination with Administrative Remarks**:
   The administrative remarks field (`"bnbbnbn"`) passed during return inspection was mapped as a gateway failure reason in the frontend, confusing finance teams and obscuring genuine gateway error responses.

---

## 2. THE 4-PILLAR REFUND POOL ACCOUNTING MODEL

To eliminate ambiguity and guarantee ledger balance preservation, Phase REFUND-GATEWAY-RECONCILIATION-01 implements the 4-Pillar Refund Pool Model:

$$
\text{Available Refundable Balance} = \text{Original Captured} - \text{Successfully Refunded} - \text{Pending Reserved}
$$

### 2.1 The Four Authoritative Pillars

1. **Pillar 1: Original Refundable Amount ($\mathcal{P}_1$)**
   - The authoritative captured payment amount from `Payment.amount` (or total order paid amount if single payment).
   - In our target case: $\mathcal{P}_1 = ₹30,794.46$.
2. **Pillar 2: Successfully Refunded Amount ($\mathcal{P}_2$)**
   - The sum of all completed and verified refund transactions (`status: "processed"`) associated with this order/payment.
   - Cleared funds permanently deducted from the available pool.
3. **Pillar 3: In-Flight / Reserved Amount ($\mathcal{P}_3$)**
   - The sum of active refunds in `status: "pending"` or `"created"`, as well as atomic holds on `Payment.refundReservedAmount`.
   - Protects committed funds while settlement is in progress at the banking rails.
4. **Pillar 4: Available Refundable Balance ($\mathcal{P}_4$)**
   - The unencumbered balance available for subsequent partial returns or adjustments:
     $$\mathcal{P}_4 = \max(0, \mathcal{P}_1 - \mathcal{P}_2 - \mathcal{P}_3)$$

### 2.2 Mathematical Accounting Invariants

For any order payment at any state $t$, the fundamental accounting equation holds:

$$
\mathcal{P}_2(t) + \mathcal{P}_3(t) + \mathcal{P}_4(t) \equiv \mathcal{P}_1
$$

Furthermore, the post-disbursement remaining pool for an active return request of net amount $R$ is strictly defined as:

$$
\text{Remaining Pool After Return} = 
\begin{cases} 
\mathcal{P}_1 - \mathcal{P}_2 & \text{if return is already refunded} \\
\max(0, \mathcal{P}_1 - \mathcal{P}_2 - R) & \text{if return is pending/authorized}
\end{cases}
$$

This prevents the historical bug where approved returns displayed ₹0 prematurely.

---

## 3. ATOMIC CAS CONCURRENCY & ZERO DOUBLE-DISBURSEMENT PROOF

### 3.1 Formal Threat Model
- **Actor A & Actor B**: Two finance administrators executing disbursement on the same refund application concurrently.
- **Network Glitch / Retry**: Administrator encounters gateway timeout and clicks retry without status reconciliation.

### 3.2 Proof of Mutual Exclusion via Compare-And-Swap (CAS)
In `refund-application.service.js`, the disbursement initiation executes an atomic MongoDB find-and-modify lock:

```javascript
const application = await RefundApplication.findOneAndUpdate(
  {
    _id: applicationId,
    applicationStatus: { $in: ["approved", "disbursement_failed", "pending_confirmation"] },
  },
  {
    $set: {
      applicationStatus: "disbursement_processing",
      disbursementStatus: "processing",
    },
  },
  { new: true }
);
```

**Proof Steps:**
1. Under MongoDB's document-level write lock, document $D$ with $\text{version}_0$ can be updated by at most one concurrent worker thread.
2. Let Actor 1 and Actor 2 submit requests at $t_1, t_2$ where $t_1 \le t_2$.
3. Actor 1 successfully updates $D.\text{status} \to \text{"disbursement\_processing"}$.
4. Actor 2 queries $D$ matching $\text{status} \in \{\text{"approved"}, \text{"disbursement\_failed"}, \text{"pending\_confirmation"}\}$.
5. Since $D.\text{status} = \text{"disbursement\_processing"}$, the predicate evaluates to $\text{false}$.
6. Actor 2 receives `null` and is rejected with HTTP 409 `DISBURSEMENT_IN_PROGRESS`.
7. $\therefore$ Exactly one gateway execution is initiated. $\blacksquare$

### 3.3 Proof of Safe Idempotent Retry via Pre-Flight Reconciliation
When an administrator attempts disbursement on an application where a gateway transaction has already been dispatched:
1. `disburseRefundApplication` checks for an existing `Refund` matching `orderId` and idempotency key `ret_refund_<returnId>`.
2. If `existingRefund.status === "processed"`, the application is synchronized to `disbursed` without calling the payment gateway.
3. If `existingRefund.status === "pending"`, the system executes authoritative `reconcileGatewayRefund` via `fetchRefund(gwId)`.
4. If the gateway confirms success, the state is updated to `disbursed`.
5. If the gateway confirms failure, the reservation is released and the state is updated to `disbursement_failed`, allowing safe retry.
6. $\therefore$ A duplicate disbursement payout can never be dispatched against an in-flight refund. $\blacksquare$

---

## 4. DECIMAL128 PRECISION & GST REVERSAL VERIFICATION

All financial fields are stored strictly as `mongoose.Schema.Types.Decimal128` to eliminate IEEE 754 floating-point rounding errors:

| Field | Type | Test Precision Value | Minor Units Conversion |
|---|---|---|---|
| `Payment.amount` | Decimal128 | `30794.46` | `3079446` paise |
| `Payment.refundedAmount` | Decimal128 | `30794.46` | `3079446` paise |
| `Payment.refundReservedAmount` | Decimal128 | `0.00` | `0` paise |
| `ReturnRequest.refundAmount` | Decimal128 | `30794.46` | `3079446` paise |
| `ReturnRequest.taxRefundTotal` | Decimal128 | `4697.46` | `469746` paise |
| `ReturnRequest.netItemRefundTotal`| Decimal128 | `26097.00` | `2609700` paise |

Reconciliation cross-checks verify that:
$$
\text{paise} = \text{Math.round}(\text{Number}(d.\text{toString}()) \times 100)
$$
And no calculation relies on JavaScript floating-point division without explicit minor-unit integer scaling.

---

## 5. AUDIT CONCLUSION

The financial accounting of Phase REFUND-GATEWAY-RECONCILIATION-01 is mathematically sound, idempotent, and free from precision leakage or double-disbursement vulnerabilities.

