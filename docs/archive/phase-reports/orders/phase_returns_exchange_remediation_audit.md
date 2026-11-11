# BUYBOX E-COMMERCE
# RETURNS & EXCHANGE REMEDIATION: FORENSIC AUDIT REPORT
## PHASE 1 — READ-ONLY FORENSIC DIAGNOSTIC

**Priority:** P0 — Customer Refund Accuracy, Tax/GST Allocation & Evidence File Upload  
**Date:** 2026-11-05T21:58:00+05:30  
**Status:** Completed (Read-Only)

---

## 1. RELEVANT FRONTEND AND BACKEND FILES

| Component | File Path | Role |
| :--- | :--- | :--- |
| **Storefront Return View** | `frontend/src/app/(storefront)/orders/[orderId]/return/OrderReturnPageView.jsx` | UI form for selecting return items, calculating estimated refund, and uploading photo evidence |
| **Storefront Return Service** | `frontend/src/services/return.service.js` | API client methods for checking eligibility, uploading evidence, and submitting return requests |
| **API Client Config** | `frontend/src/lib/api/axios.js` | Axios instance and request/response interceptors for headers and auth |
| **Backend Return Routes** | `backend/src/routes/return-request.routes.js` | Express router and Multer middleware configuration for `/upload-evidence` and `/` |
| **Backend Return Controller** | `backend/src/controllers/return-request.controller.js` | Request handler for `uploadEvidence`, `checkEligibility`, and `createReturn` |
| **Backend Return Service** | `backend/src/services/return-request.service.js` | Core business logic for eligibility check, refund calculation, return creation, inspection, and refund processing |
| **Backend Tax Service** | `backend/src/services/tax.service.js` | Tax rule resolution, item-level tax calculation, and order-level discount allocation |
| **Backend Order Model** | `backend/src/models/Order.js` | Immutable order schema storing item-level unit prices, line totals, tax totals, discount totals, and tax details |
| **Backend Return Model** | `backend/src/models/ReturnRequest.js` | Schema storing return items, evidence images, refund amounts, and timelines |
| **Backend Ledger Service** | `backend/src/services/financial-ledger.service.js` | Double-entry journal posting for refund reversals |

---

## 2. EXISTING PRICING FIELDS AND THEIR MEANINGS

In `backend/src/models/Order.js`, each item in the `items` array contains immutable pricing snapshots recorded at order creation:

1. **`unitPrice` (Decimal128)**: The base selling price per unit of the product/variant before line discounts, order coupon discounts, and taxes (in tax-exclusive mode).
2. **`quantity` (Number)**: The total quantity of units purchased in this order item line.
3. **`lineTotal` (Decimal128)**: The raw subtotal for this item line, calculated as `unitPrice * quantity`.
4. **`discountTotal` (Decimal128)**: The total discount amount allocated to this item line from applied order coupons and promotions.
5. **`taxTotal` (Decimal128)**: The total GST/sales tax charged for this item line.
6. **`taxDetails` (Object)**:
   - `taxRate` (Decimal128): Percentage tax rate (e.g., 18.00%).
   - `taxableBase` (Decimal128): Net taxable amount (`lineTotal - discountTotal` in tax-exclusive mode).
   - `taxAmount` (Decimal128): Tax amount in currency.
   - `pricingMode` (String): `"tax_exclusive"` (standard) or `"tax_inclusive"`.
   - `ruleName` (String): Applied tax rule name (e.g., "Standard GST (18%)").
   - `jurisdictionCountry` (String): e.g. `"IN"`.
   - `jurisdictionState` (String): Destination state e.g. `"WB"`.
7. **`returnedQuantity` (Number)**: Cumulative quantity of units already returned.
8. **`returnStatus` (String)**: Lifecycle status of the item (`none`, `requested`, `approved`, `returned`, `exchanged`).

---

## 3. CURRENT REFUND CALCULATION FORMULA & DEFECT IDENTIFICATION

### 3.1 Defective Implementation in `return-request.service.js`
In lines 475–486 of `backend/src/services/return-request.service.js`:
```javascript
const lineTotalNum = Number(orderItem.lineTotal?.toString() || 0);
const unitPriceNum = Number(orderItem.unitPrice?.toString() || orderItem.unitPrice || 0);
const effectiveUnitPrice =
  orderItem.quantity > 0 && lineTotalNum > 0
    ? lineTotalNum / orderItem.quantity
    : unitPriceNum;

calculatedRefundMinor += Math.round(effectiveUnitPrice * returnQty * 100);
```

### 3.2 Root Causes:
1. **Omission of GST / Taxes**:
   In `tax_exclusive` mode (the default for Indian GST in Buybox), `lineTotal` contains only the pre-tax base price (`unitPrice * quantity`). `orderItem.taxTotal` (and `orderItem.taxDetails.taxAmount`) is stored separately and added to `grandTotal`.
   Because the old logic only calculated `lineTotal / quantity`, the customer was refunded **only the base price**; all originally collected GST was forfeited and omitted from the refund!
2. **Omission of Allocated Discounts**:
   If an order used a coupon or promotional discount, `orderItem.discountTotal` was allocated to the line. The customer paid `lineTotal - discountTotal + taxTotal`. Because the old formula divided raw `lineTotal` by quantity, the discount was not deducted, which would over-refund the customer on discounted items.
3. **Lack of Item-Level Cumulative Balance Tracking**:
   The existing code capped the refund at the order-level remaining balance, but did not cap partial quantity returns at the item's individual remaining customer-paid balance, risking rounding drift across multiple partial returns.

---

## 4. PERSISTENCE OF ITEM-LEVEL TAX AND DISCOUNT ALLOCATIONS

**Confirmed:** Item-level tax and discount allocations are **fully persisted** on the `Order.items` array for every completed order:
- `orderItem.lineTotal`: Persisted.
- `orderItem.discountTotal`: Persisted.
- `orderItem.taxTotal`: Persisted.
- `orderItem.taxDetails.taxRate`: Persisted.
- `orderItem.taxDetails.taxAmount`: Persisted.
- `orderItem.taxDetails.pricingMode`: Persisted.
- `orderItem.taxDetails.taxableBase`: Persisted.

No re-calculation against current catalogue prices or active tax rules is required or permitted; the immutable order snapshot has all necessary financial figures.

---

## 5. ACTUAL MULTIPART UPLOAD FIELD NAMES & ROOT CAUSE OF `Unexpected file field`

### 5.1 The Conflict
- **Frontend (`OrderReturnPageView.jsx`, line 253):**
  ```javascript
  const formData = new FormData();
  for (const f of files) {
    formData.append("images", f); // Field name: "images"
  }
  ```
- **Backend Route (`return-request.routes.js`, line 35):**
  ```javascript
  router.post(
    "/upload-evidence",
    upload.single("file"), // Multer expects single field named "file"
    returnRequestController.uploadEvidence
  );
  ```

### 5.2 Root Cause of the Error:
When the frontend submits `formData` with field name `"images"`, Multer's `upload.single("file")` immediately rejects the request with:
```text
MulterError: Unexpected field
```
Because Multer halts execution before the controller is reached, the server returns a 500/400 error with message `"Unexpected file field"`.
Additionally, `frontend/src/services/return.service.js` explicitly specifies `headers: { "Content-Type": "multipart/form-data" }`, which strips the multipart boundary required by HTTP parsers.

---

## 6. MIDDLEWARE AND ROUTE-LEVEL FILTERING

1. **Multer Limits:** Configured at 5 MB (`limits: { fileSize: 5 * 1024 * 1024 }`).
2. **File Filtering:** The controller currently checks `req.file` instead of `req.files`. It validates extensions and MIME types (`image/jpeg`, `image/png`, `image/webp`, `image/gif`) and explicitly blocks SVG to prevent stored XSS attacks.
3. **Alignment Needed:** The route must accept multiple files under `"images"` (up to 5 images per request), with fallback support for `"file"`.

---

## 7. POTENTIAL RISKS AND MITIGATIONS

1. **Partial Quantity Invariance:** If an item with total customer paid amount ₹2,360 is returned 1 unit at a time, each return must refund exactly ₹1,180 with zero leftover or excessive paise.
2. **Exchange Requests:** Exchange requests must reserve replacement inventory and NOT disburse cash refunds.
3. **Double-Entry General Ledger:** Refund journals must balance ($\sum \text{Debits} \equiv \sum \text{Credits}$) in integer minor units (paise) with zero variance ($\Delta = 0$).
4. **Authoritative 7-Day Boundary & SLA:** Eligibility checks and inspection-gated SLA milestones (`refundEligibleAt`) must not be disturbed.

