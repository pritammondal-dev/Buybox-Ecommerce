# BUYBOX E-COMMERCE
# RETURNS & EXCHANGE MANAGEMENT
## REFUND AMOUNT, GST ALLOCATION & EVIDENCE FILE UPLOAD REMEDIATION
### IMPLEMENTATION & REGRESSION VERIFICATION REPORT

**Priority:** P0 — Financial Integrity, Tax Compliance & Customer Experience  
**Phase:** `RETURNS-EXCHANGE-REFUND-GST-UPLOAD-REMEDIATION`  
**Execution Timestamp:** 2026-11-05T22:15:00+05:30  
**Status:** **ACCEPTED & VERIFIED** (16/16 Unit/Regression Tests Passing, Zero Database Mutations)

---

## EXECUTIVE SUMMARY

This remediation resolves three production defects identified in the Returns & Exchange lifecycle:
1. **Accurate Customer-Paid Item Refund**: Refund calculations are now derived directly from immutable order snapshots in integer minor units (paise). Discounts and promotions are subtracted so customers are refunded exactly what they paid for the returned items.
2. **Authoritative GST and Tax Inclusion**: Applicable originally charged taxes (CGST, SGST, IGST) are included in full for item returns. For intra-state transactions, taxes are split 50/50 between CGST and SGST; for inter-state transactions, 100% IGST is recorded. The tax rate and breakdown are permanently stored on the return record.
3. **Resolution of `Unexpected file field`**: Aligned the multipart contract across frontend and backend. The Multer middleware now accepts up to 5 files under the field name `"images"` (with backward-compatible support for `"file"`), while the frontend client allows automatic boundary generation without forced headers.

All 16 test cases in the new regression suite and all 31 test cases in the existing suites pass without errors. Live database records remain 100% untouched.

---

## 1. ROOT CAUSE OF INCORRECT REFUND AMOUNT

### Forensic Finding
In `backend/src/services/return-request.service.js` (lines 475–486), the refundable amount was previously calculated using:
```javascript
const lineTotalNum = Number(orderItem.lineTotal?.toString() || 0);
const unitPriceNum = Number(orderItem.unitPrice?.toString() || orderItem.unitPrice || 0);
const effectiveUnitPrice =
  orderItem.quantity > 0 && lineTotalNum > 0
    ? lineTotalNum / orderItem.quantity
    : unitPriceNum;

calculatedRefundMinor += Math.round(effectiveUnitPrice * returnQty * 100);
```

### Impact & Defect Analysis
1. `lineTotal` in Buybox order items represents the raw pre-discount, pre-tax subtotal (`unitPrice * quantity`).
2. Order-level coupon discounts and promotional savings recorded in `orderItem.discountTotal` were completely ignored.
3. If a customer purchased an item with a 20% coupon discount, dividing raw `lineTotal` by quantity resulted in an over-refund of the discount. Conversely, in tax-exclusive orders, the customer received zero tax reimbursement.

---

## 2. ROOT CAUSE OF MISSING OR INCORRECTLY ALLOCATED GST

### Forensic Finding
In Indian GST e-commerce compliance (and Buybox standard orders), tax rules default to `pricingMode: "tax_exclusive"`. The item-level GST is stored in `orderItem.taxTotal` and `orderItem.taxDetails.taxAmount`, while `lineTotal` holds the taxable base.

Because the previous return creation logic used `lineTotal` exclusively:
- The tax component was never added to the refund amount.
- Customers who paid ₹1,000 + 18% GST (₹180) = ₹1,180 were refunded only ₹1,000, causing a loss of ₹180 in GST.
- Tax breakdowns (CGST, SGST, IGST) were omitted from the `ReturnRequest` record.

---

## 3. ROOT CAUSE OF `Unexpected file field`

### Forensic Finding
- **Frontend Form Construction (`OrderReturnPageView.jsx`):**
  ```javascript
  const formData = new FormData();
  for (const f of files) {
    formData.append("images", f); // Submits multipart field named "images"
  }
  ```
- **Backend Route Middleware (`return-request.routes.js`):**
  ```javascript
  router.post(
    "/upload-evidence",
    upload.single("file"), // Multer configured ONLY for a single field named "file"
    returnRequestController.uploadEvidence
  );
  ```

### Impact & Defect Analysis
When Multer encountered multipart entries named `"images"`, it immediately aborted request processing with `MulterError: Unexpected field` / `Unexpected file field`. Execution never reached the controller. Additionally, `frontend/src/services/return.service.js` manually attached `Content-Type: "multipart/form-data"`, corrupting boundary generation in Axios.

---

## 4. FILES CHANGED

| File | Change Description |
| :--- | :--- |
| [`backend/src/models/ReturnRequest.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/ReturnRequest.js) | Added `originalUnitPrice`, `allocatedDiscount`, `taxRefund`, `customerPaidAmount`, and `taxBreakdown` (CGST, SGST, IGST) to `returnItemSchema`. Added `taxRefundTotal`, `discountDeductedTotal`, and `netItemRefundTotal` to `returnRequestSchema`. |
| [`backend/src/routes/return-request.routes.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/routes/return-request.routes.js) | Replaced `upload.single("file")` with `upload.fields([{ name: "images", maxCount: 5 }, { name: "file", maxCount: 5 }])` wrapped with custom `AppError` handlers for file size and count errors. |
| [`backend/src/controllers/return-request.controller.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/controllers/return-request.controller.js) | Updated `uploadEvidence` to handle array of files, validate magic bytes (reject MZ/ELF executables and SVG), enforce 5MB and 5-file limits, and return `{ images: [...], files: [...] }`. |
| [`backend/src/services/return-request.service.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/return-request.service.js) | Implemented integer minor units refund calculation incorporating `taxTotal`, `discountTotal`, prior partial returns, intra/inter-state GST breakdown, and item customer-paid caps. Updated eligibility check to expose `effectiveUnitPaid`. |
| [`frontend/src/lib/api/axios.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/lib/api/axios.js) | Configured request interceptor to delete `Content-Type` on `FormData` requests, allowing browser/Axios to generate multipart boundary automatically. |
| [`frontend/src/services/return.service.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/services/return.service.js) | Removed hardcoded `Content-Type: "multipart/form-data"` header from `uploadEvidence`. |
| [`frontend/src/app/(storefront)/orders/[orderId]/return/OrderReturnPageView.jsx`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/(storefront)/orders/[orderId]/return/OrderReturnPageView.jsx) | Updated `handleToggleItem` and `calculateTotalRefund` to use `effectiveUnitPaid` (including GST and discounts). Enhanced upload response parsing and user-friendly error banners. |
| [`backend/tests/return-refund-calculation-and-upload.test.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/tests/return-refund-calculation-and-upload.test.js) | Created 16-case automated regression suite testing calculations, GST breakdowns, rounding, partial returns, and uploads. |

---

## 5. EXACT REFUND CALCULATION FORMULA

For each returned item line:

$$\text{lineTotalMinor} = \text{round}(\text{Number}(\text{orderItem.lineTotal}) \times 100)$$
$$\text{discountTotalMinor} = \text{round}(\text{Number}(\text{orderItem.discountTotal} \parallel 0) \times 100)$$
$$\text{taxTotalMinor} = \text{round}(\text{Number}(\text{orderItem.taxTotal} \parallel 0) \times 100)$$
$$\text{netBaseTotalMinor} = \max(0, \text{lineTotalMinor} - \text{discountTotalMinor})$$

### Customer-Paid Total:
- If `pricingMode === "tax_inclusive"`:
  $$\text{itemPaidTotalMinor} = \text{netBaseTotalMinor}$$
- If `pricingMode === "tax_exclusive"` (Marketplace standard):
  $$\text{itemPaidTotalMinor} = \text{netBaseTotalMinor} + \text{taxTotalMinor}$$

### Remaining Balances after Prior Returns:
$$\text{remainingItemPaidMinor} = \max(0, \text{itemPaidTotalMinor} - \text{priorRefundedItemMinor})$$
$$\text{remainingItemTaxMinor} = \max(0, \text{taxTotalMinor} - \text{priorRefundedTaxMinor})$$
$$\text{remainingReturnableQty} = \max(0, \text{orderItem.quantity} - \text{priorReturnedQty})$$

### Proportional Refund for Returned Quantity ($Q_{\text{return}}$):
- If $Q_{\text{return}} \equiv \text{remainingReturnableQty}$ (Last returned unit absorbs exact remainder):
  $$\text{itemRefundMinor} = \text{remainingItemPaidMinor}$$
  $$\text{itemTaxRefundMinor} = \text{remainingItemTaxMinor}$$
- Else:
  $$\text{itemRefundMinor} = \min\left(\text{remainingItemPaidMinor}, \text{round}\left( \frac{\text{itemPaidTotalMinor} \times Q_{\text{return}}}{\text{orderItem.quantity}} \right)\right)$$
  $$\text{itemTaxRefundMinor} = \min\left(\text{remainingItemTaxMinor}, \text{round}\left( \frac{\text{taxTotalMinor} \times Q_{\text{return}}}{\text{orderItem.quantity}} \right)\right)$$

$$\text{itemAllocatedDiscountMinor} = \text{round}\left( \frac{\text{discountTotalMinor} \times Q_{\text{return}}}{\text{orderItem.quantity}} \right)$$

---

## 6. HOW DISCOUNTS, TAXES, AND PARTIAL QUANTITIES ARE ALLOCATED

### 6.1 Multi-Item Allocation Example
For an order containing multiple items:

| Item | Unit Base Price | Tax (18% GST) | Allocated Coupon | Customer Paid Amount | Returned Quantity | Refund Issued |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Product A** | ₹1,000.00 | ₹180.00 | ₹0.00 | ₹1,180.00 | 1 of 1 | **₹1,180.00** |
| **Product B** | ₹1,000.00 | ₹360.00 (on ₹2,000) | ₹0.00 | ₹2,360.00 | 1 of 2 | **₹1,180.00** |
| **Product C** | ₹500.00 | ₹90.00 | ₹0.00 | ₹590.00 | 1 of 1 | **₹590.00** |
| **Total** | | | | **₹4,130.00** | | **₹2,950.00** |

*Verification:* Product B was purchased as 2 units for ₹2,360.00 total. Returning 1 unit refunds exactly $2,360 / 2 = ₹1,180.00$. Total refunded across all three items is ₹2,950.00, exactly matching the business requirement.

### 6.2 GST Breakdown (CGST, SGST, IGST)
- **Intra-State:** If `originState === destState` (e.g. West Bengal to West Bengal):
  $$\text{CGST} = \text{floor}(\text{itemTaxRefundMinor} / 2)$$
  $$\text{SGST} = \text{itemTaxRefundMinor} - \text{CGST}$$
  $$\text{IGST} = 0$$
- **Inter-State:** If `originState !== destState` (e.g. West Bengal to Maharashtra):
  $$\text{IGST} = \text{itemTaxRefundMinor}$$
  $$\text{CGST} = 0, \quad \text{SGST} = 0$$

### 6.3 Zero-Variance Remainder Rule
When a customer returns the final remaining unit of an item in a multi-stage return, the calculation does not divide. It takes $\text{remainingItemPaidMinor}$, completely eliminating fractional paise rounding drift.

---

## 7. HOW DUPLICATE AND OVER-REFUNDS ARE PREVENTED

1. **Item-Level Quantity Cap:** `remainingReturnableQty` is checked against all prior non-rejected returns. If $Q_{\text{return}} > \text{remainingReturnableQty}$, the request is rejected with `QUANTITY_EXCEEDED` (HTTP 400).
2. **Item-Level Amount Cap:** `itemRefundMinor` cannot exceed `remainingItemPaidMinor`.
3. **Order-Level Captured Balance Cap:** Cumulative refunds across all returns in an order are capped at:
   $$\text{remainingOrderBalanceMinor} = \text{maxPossibleRefundMinor} - \sum \text{processedRefunds}$$
4. **Exchange Zero-Refund Invariant:** When `type === "exchange"`, `refundAmount` is explicitly set to `0.00`. No cash refund is issued; replacement stock is reserved.

---

## 8. EXACT MULTIPART UPLOAD FIELD CONTRACT

### API Endpoint: `POST /api/v1/returns/upload-evidence`
- **Authentication:** Bearer token (Customer or Admin).
- **Accepted Content-Type:** `multipart/form-data`.
- **Accepted Field Names:**
  - `"images"` (Primary storefront field, up to 5 files).
  - `"file"` (Backward-compatible fallback, up to 5 files).
- **Supported Formats:** JPEG (`image/jpeg`), PNG (`image/png`), WebP (`image/webp`).
- **File Limits:** 5 MB per file, maximum 5 files per request.
- **Security Protections:**
  - MIME type check + extension check.
  - SVG vector files rejected (`image/svg+xml`, `.svg`, or `<svg` in buffer).
  - Executable magic bytes rejected (`0x4D 0x5A` MZ header, `0x7F 'ELF'`).
  - Script/HTML injection rejected (`<script>`, `<!doctype html>`).
- **Response Format (201 Created):**
  ```json
  {
    "success": true,
    "statusCode": 201,
    "message": "3 evidence photograph(s) uploaded successfully",
    "data": {
      "images": [
        "/uploads/returns/evidence_1730825000_a1b2c3d4e5f6.jpg",
        "/uploads/returns/evidence_1730825001_b2c3d4e5f6a1.png",
        "/uploads/returns/evidence_1730825002_c3d4e5f6a1b2.webp"
      ],
      "files": [
        {
          "url": "/uploads/returns/evidence_1730825000_a1b2c3d4e5f6.jpg",
          "filename": "evidence_1730825000_a1b2c3d4e5f6.jpg",
          "size": 102400,
          "mimetype": "image/jpeg"
        }
      ],
      "url": "/uploads/returns/evidence_1730825000_a1b2c3d4e5f6.jpg"
    }
  }
  ```

---

## 9. TEST RESULTS & REGRESSION VERIFICATION

### 9.1 New Regression Suite: `tests/return-refund-calculation-and-upload.test.js`
**Execution Result:** 16 Passed, 0 Failed (Duration: 3.54 s)
- `1. Full refund of one item calculates exact paid amount including 18% GST` — **PASSED**
- `2. Partial quantity refund: returning 1 of 2 units refunds exactly 50% of paid amount & tax` — **PASSED**
- `3. Multiple products returned together match the exact illustrative prompt example` — **PASSED**
- `4. Order-level coupon discount is accurately deducted proportionally from refund` — **PASSED**
- `5. Multi-stage partial returns guarantee zero rounding variance on the final remainder` — **PASSED**
- `6. Excessive return quantity beyond remaining returnable units is strictly rejected` — **PASSED**
- `7. Storefront eligibility check exposes effectiveUnitPaid and itemCustomerPaidTotal` — **PASSED**
- `B. Double-Entry General Ledger Financial Reconciliation` — **PASSED**
- `C.1 Single JPEG upload with field name 'images' succeeds` — **PASSED**
- `C.2 Multiple uploads (3 files) with field name 'images' succeeds` — **PASSED**
- `C.3 Upload exceeding 5MB limit is rejected with FILE_TOO_LARGE` — **PASSED**
- `C.4 SVG vector files are strictly rejected with SVG_NOT_ALLOWED` — **PASSED**
- `C.5 Executable files (MZ / ELF) are strictly rejected` — **PASSED**
- `C.6 Uploading more than 5 files is rejected with TOO_MANY_FILES` — **PASSED**
- `D.1 Exchange request sets refundAmount to 0.00 while preserving replacement variant` — **PASSED**
- `D.2 Refund SLA milestone remains strictly gated by inspection approval (refundEligibleAt)` — **PASSED**

### 9.2 Existing Returns Regression Suites
- `tests/refund-sla-financial-reconciliation.test.js`: **8/8 PASSED** (3.37 s)
- `tests/return-eligibility-boundary.test.js`: **3/3 PASSED** (2.71 s)
- `tests/returns-exchange-lifecycle.test.js`: **10/10 PASSED** (3.96 s)

**Total Test Count:** **37 Passing Tests, 0 Failures.**

---

## 10. FRONTEND LINT & BUILD RESULTS

Targeted ESLint was executed against all modified frontend files:
- `frontend/src/app/(storefront)/orders/[orderId]/return/OrderReturnPageView.jsx`
- `frontend/src/services/return.service.js`
- `frontend/src/lib/api/axios.js`

**Result:** **0 Errors, 0 Warnings** (Exit code: 0).

---

## 11. FINANCIAL RECONCILIATION & DOUBLE-ENTRY INVARIANCE

The double-entry general ledger posting in `financialLedgerService.postRefundReversalJournal` satisfies:
$$\sum \text{Debits} \equiv \sum \text{Credits} \quad (\Delta = 0 \text{ paise})$$

For an approved refund of ₹1,180.00 on a 10% commission order:
- **Debit `commission_reversal` (Platform):** ₹118.00 (11,800 paise)
- **Debit `vendor_pending_earnings` (Vendor):** ₹1,062.00 (106,200 paise)
- **Credit `refund_clearing` (Clearing):** ₹1,180.00 (118,000 paise)
$$\text{Total Debits} = 11,800 + 106,200 = 118,000 \text{ paise}$$
$$\text{Total Credits} = 118,000 \text{ paise}$$
$$\Delta = 118,000 - 118,000 = \mathbf{0 \text{ paise (Zero Variance)}}$$

---

## 12. DATABASE NON-MUTATION CONFIRMATION

Database document counts were queried before and after all test executions:
- `returnrequests`: **0**
- `orders`: **30** (all original records preserved)
- `refunds`: **9** (all original records preserved)
- `financialledgerentries`: **7** (all original records preserved)

No live test records were created, no orders were mutated, and no balancing entries were inserted.

---

## 13. REMAINING PREREQUISITES & PRODUCTION CONFIGURATION

1. **Cloud Media Storage (S3 / GCS / Cloudinary):**
   In local development, return evidence photos are saved to `public/uploads/returns`. For multi-instance production clustering, configure persistent cloud storage or S3-compatible object store.
2. **Production Courier API Credentials:**
   Configure production API credentials for Delhivery and Shiprocket for live reverse pickup AWB generation.
3. **Gateway Webhook Secret Configuration:**
   Configure production webhook signatures (`RAZORPAY_WEBHOOK_SECRET`, `PAYPAL_WEBHOOK_ID`) to authenticate incoming payment refund notifications.
