# BUYBOX E-COMMERCE
# SUPERADMIN VENDOR MANAGEMENT
## PHASE VM-01 — FULL FORENSIC AUDIT REPORT
### READ-ONLY DIAGNOSTIC & ARCHITECTURAL GAP ANALYSIS

**Document Path:** `phase_superadmin_vendor_management_audit.md`  
**Execution Mode:** Read-Only Forensic Diagnostic (Zero Implementation / Zero Mutations)  
**Target Architecture:** Superadmin Vendor Directory, Vendor Profile / Inspect Console, Financial Aggregation, Commission Policies, Bank Accounts & Offboarding  
**Audit Priority:** P1  

---

## 1. EXECUTIVE SUMMARY

A comprehensive forensic audit of the Superadmin Vendor Management module was conducted across frontend user interfaces, backend API routes, controller handlers, service business logic, Mongoose domain models, and MongoDB aggregation pipelines.

The audit confirmed several critical architectural defects, missing data flows, rendering bugs, and financial calculation gaps:

1. **`[object Object]%` Commission Defect:** Located at lines 789 and 1033 of [`frontend/src/app/administrator/vendors/[id]/page.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/vendors/%5Bid%5D/page.js). The legacy `commissionRate` field on [`backend/src/models/Vendor.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/Vendor.js#L337) is stored as a Mongoose `Decimal128`. In API responses, it serializes as an object (`{ "$numberDecimal": "0" }`), which JavaScript string interpolation renders as `[object Object]%`. Furthermore, the entire vendor profile interface is completely disconnected from the authoritative VW-02 [`backend/src/models/CommissionPolicy.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/CommissionPolicy.js) engine.
2. **Linked User Displaying `CUSTOMER` for Approved Merchants:** Located at line 854 of [`frontend/src/app/administrator/vendors/[id]/page.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/vendors/%5Bid%5D/page.js#L854). When an existing customer registers as a merchant, the system preserves their singular `User` identity and appends `vendor` to `User.roles` (`['customer', 'vendor']`), but leaves the primary scalar `User.role` as `"customer"`. Backend [`backend/src/services/vendor.service.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L757) only populates `role` (omitting `roles`), and the frontend prints `applicant.role`, misleading platform staff into believing an approved seller is merely a shopper.
3. **Vendor Directory Table Distortion & Client-Side Filter Bug:** In [`frontend/src/app/administrator/vendors/page.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/vendors/page.js#L566), the Actions column places four full text buttons (`Inspect Profile`, `Suspend`, `Reset Password`, `Deactivate`) inline, consuming over 380px of horizontal width and severely distorting table columns. Concurrently, lines 100–104 perform client-side filtering on server-paginated slices (`has_products`, `has_orders`), corrupting table counts and pagination controls. Furthermore, the top KPI card (`statusCounts.total`) queries `{ deletedAt: null }` while the table query on the "All" tab lacks this filter, causing data count discrepancies.
4. **Vendor Inspection Data Starvation:** The backend already implements an extensive aggregation endpoint [`GET /api/v1/admin/vendors/:id/overview`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L1549) returning 12 operational KPIs, products with variants, order history, multi-warehouse inventory, settlements, and audit logs. However, the frontend [`AdminVendorDetailPage`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/vendors/%5Bid%5D/page.js) **never calls this endpoint**. The UI provides only four tabs (`Overview & KPIs`, `Store & Identity`, `Business & Compliance`, `Bank Accounts`) and has **zero views** for catalog products, inventory stock, order breakdowns, fulfillment milestones, or double-entry settlements.
5. **Node.js Memory Leak Anti-Pattern in Financial Overview:** In [`backend/src/services/vendor.service.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L1609), `getVendorOverview` loads **all historical vendor orders** into Node.js heap memory (`Order.find({ "items.vendorId": vendorObjId }).lean()`) and iterates through every line item in JavaScript. On high-volume merchants, this will trigger `ERR_WORKER_OUT_OF_MEMORY`. It must be replaced by an authoritative MongoDB `$match` + `$unwind` + `$group` aggregation pipeline.
6. **Incomplete Cost-of-Goods (COGS) & False "Vendor Profit":** While [`backend/src/models/ProductVariant.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/ProductVariant.js#L49) has an optional `costPrice` field, it is null across almost all catalog items and is **never snapshotted onto order items** at checkout. True vendor profit **cannot be reliably calculated** and must not be fabricated.
7. **Unsafe Offboarding & Incomplete Product Delisting:** In [`deleteVendor`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L2068), soft-deactivation updates `Product.isStoreVisible = false`, but **fails to transition `Product.status` to `"archived"` or `"inactive"`**. Because [`backend/src/services/cart.service.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/cart.service.js#L198) only validates `status: "active"`, products from deactivated vendors remain valid in customer carts. In addition, deactivating the linked `User` collaterally kills the user's customer shopping access, active inventory reservations are ignored, and pending orders are left dangling.

---

## 2. VENDOR DIRECTORY AUDIT

### A. Layout, Spacing & Column Distortion
- **Excessive Column Width from Inline Action Buttons:** In [`frontend/src/app/administrator/vendors/page.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/vendors/page.js#L566-L635), every table row renders up to four inline action buttons:
  - `Inspect Profile` / `Review` (`px-3 py-1.5`)
  - `Suspend` / `Reactivate` (`px-2.5 py-1.5`)
  - `Reset Password` (`px-2.5 py-1.5`)
  - `Deactivate` (`px-2.5 py-1.5`)
  Because these buttons sit inside a `flex items-center justify-end gap-2 whitespace-nowrap` container, the Actions column requires 380px–420px. On viewports below 1600px, this compresses the remaining 5 columns (`Store`, `Contact`, `Status`, `Catalog`, `Registered`), forcing horizontal scroll while leaving vertical whitespace empty.
- **Vendor ID Display & Wrapping:** As implemented in [`frontend/src/components/admin/VendorIdBadge.jsx`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/components/admin/VendorIdBadge.jsx), encrypted IDs (e.g. `ven_ZW5jOnYx...`) are wrapped in a `max-w-[210px] break-all` box across 2–3 lines beneath the store slug. While this prevents overflow, stacking it under the store name inflates the row height of every record.
- **Recommended Data Table Architecture:**
  - Convert action buttons into a structured **Contextual Dropdown Action Menu** (`MoreVertical` or standard 3-dot trigger) containing `Inspect Profile`, `Suspend/Reactivate`, `Reset Password`, and `Deactivate`.
  - Maintain the full Vendor ID in the database and API. Visually render a shortened representation (e.g. `ven_...a6b4`) with an inline copy button, click-to-expand tooltip, and access to the complete identifier.
  - Apply strict column width weighting: Store (28%), Linked Account (24%), Status/KYC (16%), Products/Orders (14%), Registered (12%), Actions (6%).

### B. Filtering, Pagination & Count Discrepancies
- **Client-Side Post-Pagination Filtering Flaw:** Lines 100–104 of [`page.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/vendors/page.js#L100-L104):
  ```javascript
  if (activityFilter === "has_products") {
    fetchedVendors = fetchedVendors.filter((v) => (v.productsCount || 0) > 0);
  } else if (activityFilter === "has_orders") {
    fetchedVendors = fetchedVendors.filter((v) => (v.ordersCount || 0) > 0);
  }
  ```
  `fetchedVendors` is filtered in client memory **after** the server has already paginated 20 records. If only 2 of the 20 records on page 1 have products, the user sees only 2 rows on the screen while the pagination bar claims 20 rows are shown, completely breaking pagination integrity.
- **Discrepancy Between KPI Cards and Table Records:**
  - KPI Card `statusCounts.total` ([`vendor.service.js#L721`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L721)) queries `{ deletedAt: null }`.
  - Main directory query ([`vendor.service.js#L644`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L644)) on tab `"all"` does **not** include `{ deletedAt: null }`.
  - Consequently, soft-deactivated vendors appear in the table listing, but are omitted from the top KPI card total.

---

## 3. VENDOR PROFILE / INSPECT PAGE AUDIT

### A. Store Identity
- **Available Fields in DB:** `businessName`, `businessSlug`, `phone`, `supportEmail`, `businessAddress` (addressLine1, addressLine2, city, state, postalCode, country), `branding` (displayName, logo, banner, description, publicContactEmail, publicContactPhone, policies, operatingHours, socialLinks), `isActive`, `onboardingStatus`.
- **Rendered Fields:** Business name, slug, support email, phone, address, banner, logo, bio, shipping policy, return policy, refund policy.
- **Missing / Dropped Fields:**
  - `operatingHours` and `socialLinks` (website, instagram, twitter, facebook) are stored in schema ([`backend/src/models/Vendor.js#L163-L174`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/Vendor.js#L163-L174)) but never rendered on the profile inspection page.
  - Storefront URL links to `/stores/${vendor.businessSlug}`. However, if `businessSlug` is missing, it falls back to virtual `slug` which can result in broken links if unpopulated.

### B. Applicant Account & Role Mapping Investigation
- **The Reported Bug:** Screenshot displays an approved, active merchant whose linked user account shows:
  ```
  Account Role: CUSTOMER
  ```
- **Architectural Root Cause:**
  1. Buybox utilizes a **singular identity model** where a human user registers first as a customer and subsequently applies for a merchant store via `POST /api/v1/vendors/register`.
  2. When an authenticated customer applies, [`backend/src/services/vendor.service.js#L281-L288`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L281-L288) updates the user's `roles` array:
     ```javascript
     const updatedRoles = Array.from(new Set([...(existingUser.roles || [existingUser.role || "customer"]), ROLES.CUSTOMER, ROLES.VENDOR]));
     await User.updateOne({ _id: existingUser._id }, { $set: { roles: updatedRoles } });
     ```
     **Notice:** It updates `roles` (array), but **leaves the scalar `role` field as `"customer"`**!
  3. When `approveVendor` runs ([`vendor.service.js#L832`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L832)), it only sets `isActive: true`. It does not alter `User.role`.
  4. In `getVendorById` ([`vendor.service.js#L757`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L757)):
     ```javascript
     .populate("userId", "firstName lastName email phone avatar role isActive isEmailVerified createdAt")
     ```
     It explicitly projects `role`, but **omits `roles`**!
  5. In [`frontend/src/app/administrator/vendors/[id]/page.js#L854`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/vendors/%5Bid%5D/page.js#L854):
     ```javascript
     <span className="uppercase font-semibold text-slate-700 dark:text-slate-300">{applicant.role || "vendor"}</span>
     ```
     The UI reads the scalar `applicant.role`, rendering `CUSTOMER`.
- **Architectural Determination:** This is a **data projection and UI presentation defect**, not a security failure. The backend correctly restricts vendor console access via the `Vendor` document tenancy. However, the Superadmin interface must project `roles` and render the account's operational marketplace persona (e.g., `Merchant (Multi-Role: Vendor, Customer)`).

### C. Approval, Compliance & KYC
- **Application Statuses:** `pending`, `under_review`, `approved`, `rejected`, `changes_requested`, `suspended`, `inactive`.
- **KYC Verification:** Successfully retrieves `kycStatus` and `kycDocuments` array ([`Vendor.js#L190`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/Vendor.js#L190)). Allows document approval/rejection and unmasked viewing of document numbers.
- **Missing Audit History in Profile UI:** While `AuditLog` records every status transition (`VENDOR_APPROVED`, `vendor.suspended`, `vendor.deleted`), there is **no Audit History tab or table** on `/administrator/vendors/[id]`. The Superadmin cannot see who approved the vendor, what reason was supplied for past suspensions, or historical change requests without inspecting raw database records.

### D. Catalog and Fulfillment Gaps
- **Missing Catalog View:** The profile page only displays a single number `vendor.productsCount || 0`. It provides **no list of products**, no filter by active/draft/archived, no visibility into variable products vs simple products, and no view of stock levels.
- **Missing Fulfillment / Orders View:** The profile page only displays `vendor.ordersCount || 0`. It provides **no order list**, no breakdown of pending/fulfilled/cancelled orders, no shipment tracking coordinates, and no return/refund requests.
- **Missing Warehouse View:** Even though vendors have inventory assigned across warehouses, there is **zero warehouse visibility** on the vendor profile.

---

## 4. COMMISSION CONFIGURATION AUDIT

### A. Root Cause of `[object Object]%`
In [`frontend/src/app/administrator/vendors/[id]/page.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/vendors/%5Bid%5D/page.js):
- **Line 789 (Overview Card):**
  ```javascript
  {vendor.commissionRate !== undefined ? `${vendor.commissionRate}%` : "0%"}
  ```
- **Line 1033 (Tax & Regulatory Identifiers):**
  ```javascript
  {vendor.commissionRate !== undefined ? `${vendor.commissionRate}%` : "Standard (0%)"}
  ```
In [`backend/src/models/Vendor.js#L337`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/Vendor.js#L337):
```javascript
commissionRate: {
  type: mongoose.Schema.Types.Decimal128,
  default: 0,
}
```
When `getVendorById` executes `vendor.toObject()`, Mongoose does **not** cast `Decimal128` to a primitive number or string. In JSON responses, `Decimal128` serializes as an object:
```json
{
  "commissionRate": {
    "$numberDecimal": "0"
  }
}
```
In JavaScript, interpolating an object inside template literals (`${vendor.commissionRate}%`) invokes `Object.prototype.toString()`, producing:
```
[object Object]%
```

### B. Architecture Disconnect: Legacy Field vs Commission Engine
- **The Modern Engine ([`CommissionPolicy.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/CommissionPolicy.js)):** Phase VW-02 introduced an enterprise commission policy engine with hierarchical precedence:
  1. Product Override (`scope: "product"`, Rank 1)
  2. Vendor Agreement (`scope: "vendor"`, Rank 2)
  3. Category Rule (`scope: "category"`, Rank 3)
  4. Global Platform Default (`scope: "global"`, Rank 4)
  5. Legacy Fallback (10% default, Rank 5)
- **The Gap:** The Superadmin Vendor Inspection page completely ignores `CommissionPolicy`! It looks only at the legacy `vendor.commissionRate` field on the `Vendor` document. If a vendor agreement policy has been configured in `/admin/finance/commission-policies`, it is **not displayed on the vendor profile**.
- **Historical Order Preservation:** In [`backend/src/services/commission.service.js#L733`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/commission.service.js#L733), `lockOrderItemsCommissionSnapshot` permanently freezes the applied rate and commission amount onto each order item at payment capture. Changes to policies or vendor rates **never alter historical orders**.
- **Refund & Cancellation Treatment:** Handled by [`calculateCommissionReversal`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/commission.service.js#L800), which reverses commission proportionally to the refund base.

---

## 5. VENDOR FINANCIAL DATA AUDIT

### A. Authoritative Metric Specifications

| Metric | Exact Business Definition | Authoritative Source of Truth | Model & Fields | Formula | Cancellation & Refund Treatment | Can Reconcile With Ledger? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Total GMV** | Cumulative top-line merchandise value ordered from this vendor before fees or refunds. | `Order` collection | `Order.items.lineTotal` where `vendorId === vendor._id` | $\sum \text{lineTotal}$ for placed orders | Excludes orders with status `cancelled` or `expired` | Yes (matches Gross Bookings) |
| **2. Completed Sales** | Net merchandise value of fulfilled orders delivered to customers past the return window. | `VendorSettlement` / `Order` | `VendorSettlement.grossSales` | $\sum \text{grossSales}$ of closed settlements | Returns/refunds deducted during settlement window | Yes (Credit on `REVENUE_EARNED`) |
| **3. Paid Order Value** | Total customer payments successfully captured for vendor items. | `Order` & `Payment` | `Order.items.lineTotal` where `paymentStatus === "paid"` | $\sum \text{lineTotal}$ where `paymentStatus: "paid"` | Does not deduct refunds; reflects raw cash captured | Yes (matches Customer Receipts) |
| **4. Refunded Amount** | Cumulative monetary value refunded to customers for vendor's products. | `Refund` & `FinancialLedgerEntry` | `Refund.amount` / `FinancialLedgerEntry.amount` (`accountCode: "VENDOR_PAYABLE"`, Debit) | $\sum \text{refundAmount}$ | Reflects customer returns and order cancellations | Yes (Debit on `VENDOR_PAYABLE`) |
| **5. Platform Commission** | Net platform fees earned from vendor's settled merchandise sales. | `CommissionSnapshot` & `VendorSettlement` | `VendorSettlement.platformCommission` / `Order.items.commissionSnapshot.commissionAmount` | $\sum (\text{Commission} - \text{Reversals})$ | Reversals applied on refunded line items | Yes (Credit on `PLATFORM_COMMISSION_REVENUE`, Account 4000) |
| **6. Vendor Gross Earnings** | Vendor entitlement before platform commission and statutory deductions. | `Order.items` | `calculationBase` (`lineTotal + platformSubsidy - vendorDiscounts`) | $\sum \text{calculationBase}$ | Reversed on cancelled or refunded items | Yes (matches Initial Vendor Credit) |
| **7. Deductions & Adjustments** | Sum of commissions, penalties, gateway charges, or manual adjustments. | `FinancialLedgerEntry` | Debit entries against `accountCode: "VENDOR_PAYABLE"` (excluding payouts) | $\sum \text{Commission} + \text{Penalties} + \text{Manual Debits}$ | Recorded as discrete journal entries | Yes (Exact double-entry debit audit trail) |
| **8. Vendor Net Payable** | Total net funds owed to vendor (Gross Earnings minus Fees, Refunds, and Payouts). | `FinancialLedgerEntry` & `VendorWallet` | `VendorWallet.availableBalance + VendorWallet.pendingBalance` | $\text{Gross} - \text{Commission} - \text{Refunds} - \text{Completed Payouts}$ | Automatically reduced by refund debits | Yes (Matches credit balance on Account 2100) |
| **9. Completed Payouts** | Cumulative funds successfully disbursed to vendor's verified bank account. | `VendorPayout` & `FinancialLedgerEntry` | `VendorPayout.amount` where `status === "completed"` | $\sum \text{VendorPayout.amount}$ | N/A (Disbursed cash) | Yes (Debit on Account 2100, Credit on Escrow Account 1010) |
| **10. Outstanding Payout Balance** | Settled funds available for immediate withdrawal request. | `VendorWallet` | `VendorWallet.availableBalance` | Settled Net Payable minus In-Flight Withdrawals | Blocked during return escrow holding period | Yes (Matches ledger available balance) |
| **11. Vendor Profit** | **UNAVAILABLE / UNRELIABLE** | N/A | `ProductVariant.costPrice` (incomplete, un-snapshotted) | $\text{Net Earnings} - \text{COGS}$ | **Cannot be calculated reliably** | **No** (COGS data is unpopulated) |

### B. High-Risk Node.js Memory Anti-Pattern in `getVendorOverview`
In [`backend/src/services/vendor.service.js#L1609-L1629`](file:///d:/MERN Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L1609-L1629):
```javascript
const orders = await Order.find({ "items.vendorId": vendorObjId })
  .sort({ createdAt: -1 })
  .lean();

for (const order of orders) {
  const isCancelled = ["cancelled", "expired"].includes(order.status);
  if (isCancelled) {
    cancelledOrders++;
  } else {
    for (const item of order.items || []) {
      if (item.vendorId && item.vendorId.toString() === vendorObjId.toString()) {
        const lineTotalNum = Number(item.lineTotal?.toString() || 0);
        totalGrossSalesMinor += Math.round(lineTotalNum * 100);
      }
    }
  }
}
```
**Diagnostic Finding:** Loading thousands of orders and looping in JavaScript is an extreme performance vulnerability that will crash Node.js processes under production volume. This must be replaced with a single aggregation pipeline:
```javascript
const salesAgg = await Order.aggregate([
  { $match: { "items.vendorId": vendorObjId, status: { $nin: ["cancelled", "expired"] } } },
  { $unwind: "$items" },
  { $match: { "items.vendorId": vendorObjId } },
  { $group: { _id: null, totalSales: { $sum: "$items.lineTotal" }, totalItems: { $sum: "$items.quantity" } } }
]);
```

---

## 6. BANK ACCOUNT AND PAYOUT AUDIT

### A. Storage & Encryption Security
- **Model:** [`backend/src/models/VendorBankAccount.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/VendorBankAccount.js).
- **Encryption:** Bank account numbers are encrypted at rest using AES-256-GCM (`accountNumberEncrypted`: `enc:v1:<iv>:<tag>:<ciphertext>`).
- **Masking:** Presentation uses `accountNumberMasked` (`••••••••••••1234`).
- **Blind Indexing:** Duplicate account detection across the platform uses HMAC-SHA256 (`accountNumberHash`).
- **Directory Isolation:** Verified that [`listVendors`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L676) and [`getVendorById`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L756) do **not** populate `bankAccounts`. Bank account details are never leaked in general vendor APIs.

### B. Privileged Unmasking & Audit Logging
- **Endpoint:** `POST /api/v1/vendors/:id/bank-accounts/:bankAccountId/unmask`.
- **Authorization:** Enforces permission `vendors.bank_accounts.view_unmasked`.
- **Audit Mandate:** Requires a mandatory administrative justification of at least 10 characters. Automatically records an immutable entry in [`AuditLog`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/AuditLog.js) with action `"vendor_bank_account.unmasked_view"`.
- **Frontend Card:** [`frontend/src/components/admin/bank-accounts/AdminBankAccountCard.jsx`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/components/admin/bank-accounts/AdminBankAccountCard.jsx) properly integrates [`PrivilegedUnmaskModal.jsx`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/components/admin/bank-accounts/PrivilegedUnmaskModal.jsx).

### C. Payout History Disconnect
- While bank accounts are managed under Tab 4 of the vendor profile, there is **zero payout visibility**.
- [`backend/src/models/VendorPayout.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/VendorPayout.js) records payouts with `bankAccountId`, `amount`, `status`, `referenceNumber`, and `failureReason`.
- None of this payout history is accessible from `/administrator/vendors/[id]`. Staff cannot inspect whether payouts to a bank account succeeded, failed, or are pending.

---

## 7. VENDOR OFFBOARDING AND PRODUCT LIFECYCLE AUDIT

### A. Existing Termination Implementation
Examined [`deleteVendor`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L2068) and [`suspendVendor`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js#L1882):
```javascript
vendor.deletedAt = new Date();
vendor.isActive = false;
vendor.onboardingStatus = "inactive";
await vendor.save();

if (vendor.userId) {
  await User.updateOne({ _id: vendor.userId }, { isActive: false, deletedAt, $inc: { authVersion: 1 } });
  await RefreshToken.updateMany({ userId: vendor.userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

await Product.updateMany({ vendorId: vendor._id, deletedAt: null }, { $set: { isStoreVisible: false } });
```

### B. Critical Offboarding Invariant Violations

1. **Failure to Archive Product Status:**
   - `Product.updateMany` sets `isStoreVisible: false`.
   - It **does NOT update `Product.status`** to `"archived"` or `"inactive"`.
   - In [`backend/src/services/cart.service.js#L198`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/cart.service.js#L198) and [`cart.service.js#L277`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/cart.service.js#L277), cart item validation explicitly checks:
     ```javascript
     _id: variant.productId,
     status: "active",
     deletedAt: null
     ```
   - Because `isStoreVisible` is **never checked by the cart service**, customers who already have the product in their cart can still checkout and purchase products belonging to a deactivated vendor!
2. **Collateral Account Termination (Customer Persona Lockout):**
   - Setting `User.isActive = false` on `vendor.userId` terminates the human user's login globally.
   - If the user was also a marketplace customer (`roles: ['customer', 'vendor']`), their customer account is disabled, preventing them from logging in to view their personal shopping orders or track shipments.
   - Proper behavior: The user's vendor session must be revoked, but their customer persona should remain operational unless explicitly banned platform-wide.
3. **Dangling Inventory Reservations & Active Orders:**
   - `deleteVendor` does not check for active inventory reservations.
   - It does not check for unfulfilled orders, pending customer returns, or in-flight shipments.
   - It does not freeze or settle the vendor wallet balance.
4. **Hard Deletion Protection:**
   - Historical records in `Order`, `Shipment`, `VendorSettlement`, and `FinancialLedgerEntry` are strictly preserved via soft-deletion (`deletedAt`).
   - Indiscriminate hard deletion is properly prevented by foreign key and ledger invariants.

---

## 8. BACKEND & API DATA-FLOW AUDIT

### Complete Request-Response Trace

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │ 1. Superadmin UI: frontend/src/app/administrator/vendors/page.js       │
  │    Calls adminVendorService.listVendors(params)                        │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
  ┌───────────────────────────────────▼────────────────────────────────────┐
  │ 2. API Client: frontend/src/services/admin/vendor.service.js           │
  │    GET /api/v1/admin/vendors (via admin-axios with Staff JWT)          │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
  ┌───────────────────────────────────▼────────────────────────────────────┐
  │ 3. Router & Auth: backend/src/routes/vendor.routes.js                  │
  │    authenticateAdministrator -> requirePermissions("vendors:read")    │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
  ┌───────────────────────────────────▼────────────────────────────────────┐
  │ 4. Controller: backend/src/controllers/vendor.controller.js            │
  │    Calls vendorService.listVendors(req.query)                          │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
  ┌───────────────────────────────────▼────────────────────────────────────┐
  │ 5. Service & DB: backend/src/services/vendor.service.js                │
  │    - Vendor.find(filter) with pagination & lean()                      │
  │    - Product.aggregate & Order.aggregate for counts                    │
  │    - DEFECT: Decimal128 commissionRate uncast in lean output           │
  │    - DEFECT: userId populates 'role' but ignores 'roles' array         │
  └───────────────────────────────────┬────────────────────────────────────┘
                                      │
  ┌───────────────────────────────────▼────────────────────────────────────┐
  │ 6. Response & UI: frontend/src/app/administrator/vendors/page.js       │
  │    - DEFECT: Post-pagination client filtering corrupts page counts     │
  │    - DEFECT: 4 inline action buttons stretch table width               │
  └────────────────────────────────────────────────────────────────────────┘
```

---

## 9. SECURITY AND AUTHORIZATION

1. **Role-Based Access Control (RBAC):**
   - Superadmin vendor management is governed by discrete permissions: `vendors.view`, `vendors.approve`, `vendors.reject`, `vendors.request_changes`, `vendors.suspend`, `vendors.edit`, `vendors.reset_password`, `vendors.delete`.
   - Bank account operations enforce granular permissions: `vendors.bank_accounts.view`, `vendors.bank_accounts.review`, `vendors.bank_accounts.approve`, `vendors.bank_accounts.reject`, `vendors.bank_accounts.manage`, `vendors.bank_accounts.view_unmasked`.
2. **Tenant Isolation:**
   - Platform administrators operate with global scope (`allowGlobalPlatformActor: true`), while vendor endpoints strictly scope to `req.vendor._id`.
3. **Audit Trail Immutability:**
   - Status updates, password resets, suspensions, deactivations, and bank account unmasking actions write to [`backend/src/models/AuditLog.js`](file:///d:/MERN Stack/Buybox-Ecommerce/backend/src/models/AuditLog.js).
   - `AuditLog` enforces append-only semantics via Mongoose pre-update hooks.

---

## 10. TEST COVERAGE REVIEW

### A. Executed Test Evidence

| Test Suite File | Domain Tested | Tests Executed | Tests Passed | Status |
| :--- | :--- | :--- | :--- | :--- |
| [`backend/tests/phase6a-superadmin-vendor-management.test.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/tests/phase6a-superadmin-vendor-management.test.js) | Vendor directory regex search, products/orders count, 12 KPIs overview, auth boundaries | 8 | 8 | **PASS** |
| [`frontend/tests/unit/admin-vendor-service.test.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/tests/unit/admin-vendor-service.test.js) | Admin vendor API service client contracts, route parameters, endpoints | 6 | 6 | **PASS** |
| [`frontend/tests/unit/vendor-id-badge-display.test.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/tests/unit/vendor-id-badge-display.test.js) | `VendorIdBadge` rendering constraints, copy-to-clipboard, text wrapping | 5 | 5 | **PASS** |

### B. Identified Test Coverage Gaps (Recommended New Tests)
1. **Commission Rate Type-Safety Test:** Verify that `Decimal128` commission rates serialize as primitive numbers (e.g. `12.5` not `{ $numberDecimal: "12.5" }`) and render cleanly as `12.5%` without `[object Object]%`.
2. **Multi-Role User Presentation Test:** Verify that when a user has `roles: ['customer', 'vendor']`, the vendor profile displays their seller role rather than `CUSTOMER`.
3. **Offboarding Product Status Test:** Verify that when `deleteVendor` is invoked, all products transition to `status: "archived"` and cannot be added to or checked out from cart.
4. **Authoritative Financial Aggregation Test:** Verify that vendor GMV, paid orders, platform commissions, and net payables are calculated via MongoDB aggregations matching double-entry ledger entries.
5. **Directory Server-Side Activity Filter Test:** Verify that filtering by `has_products` or `has_orders` is executed on the database before pagination.

---

## 11. PRIORITIZED REMEDIATION PLAN

| Severity | Issue ID | Component | Defect & Remediation Description |
| :--- | :--- | :--- | :--- |
| **P1** | `DEF-VM-01` | Frontend / Backend | **Commission `[object Object]%` Fix:** Cast `Decimal128` to primitive `Number` in backend `getVendorById` / `getVendorOverview`. Add type-safe helper `formatCommissionRate(vendor)` in frontend. Integrate VW-02 `CommissionPolicy` resolution to display effective vendor agreement policy. |
| **P1** | `DEF-VM-02` | Frontend / Backend | **Multi-Role User Mapping Fix:** Include `roles` in `userId` population in `getVendorById`. Update frontend to check `applicant.roles?.includes('vendor')` and render operational seller role (`Merchant` / `Vendor`) instead of `CUSTOMER`. |
| **P1** | `DEF-VM-03` | Backend Service | **Offboarding Product Lifecycle Fix:** In `deleteVendor` and `suspendVendor`, set `Product.status = "archived"` (not just `isStoreVisible: false`) to ensure cart validation blocks checkout. Check for active reservations before deactivation. |
| **P2** | `DEF-VM-04` | Frontend Directory | **Directory Table Layout & Compact Actions:** Replace 4 inline action buttons with a structured 3-dot dropdown action menu. Compact the `VendorIdBadge` display. |
| **P2** | `DEF-VM-05` | Frontend / Backend | **Server-Side Activity Filtering:** Move `has_products` and `has_orders` filter logic to backend MongoDB query (`$lookup` or indexed count match) to fix broken pagination. Reconcile KPI card `statusCounts.total` filter with main query. |
| **P2** | `DEF-VM-06` | Frontend Inspect UI | **Vendor Profile Data Hydration & Missing Tabs:** Call `getVendorOverview` in `AdminVendorDetailPage`. Add dedicated tabs for: Catalog Products (with variant & approval status), Orders & Fulfillment (with milestone breakdowns), and Double-Entry Settlements. |
| **P2** | `DEF-VM-07` | Backend Service | **Financial Aggregation Memory Leak Remediation:** Replace Node.js in-memory order loop in `getVendorOverview` with MongoDB aggregation pipelines. Explicitly flag "Vendor Profit" as unavailable due to incomplete COGS. |
| **P3** | `DEF-VM-08` | Frontend Inspect UI | **Payout History & Wallet Integration:** Surface vendor wallet balances, completed payouts, and link to `/administrator/finance/wallets/[vendorId]`. |

---

## 12. AFFECTED FILES & FUNCTIONS INVENTORY

| File Path | Domain | Relevant Functions / Elements | Action in Remediation |
| :--- | :--- | :--- | :--- |
| [`frontend/src/app/administrator/vendors/[id]/page.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/vendors/%5Bid%5D/page.js) | Frontend UI | `AdminVendorDetailPage`, lines 789, 854, 1033 | Fix `[object Object]%`, fix role rendering, call `getVendorOverview`, add Catalog/Orders tabs. |
| [`frontend/src/app/administrator/vendors/page.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/administrator/vendors/page.js) | Frontend UI | `AdminVendorsPage`, lines 100–104, 566–635 | Replace inline action buttons with dropdown menu; remove client post-pagination filter. |
| [`backend/src/services/vendor.service.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/vendor.service.js) | Backend Logic | `getVendorById`, `getVendorOverview`, `deleteVendor`, `suspendVendor`, `listVendors` | Cast Decimal128; populate `roles`; replace in-memory order loop with aggregation; archive product status on delete. |
| [`backend/src/models/Vendor.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/Vendor.js) | Backend Model | `commissionRate`, `toJSON` transform | Ensure `Decimal128` getters or JSON transforms cast to primitive numbers. |
| [`backend/src/services/cart.service.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/cart.service.js) | Backend Logic | `validateProductAndVariantAvailability` | Ensure status checks block archived/inactive products of deactivated vendors. |
| [`frontend/src/services/admin/vendor.service.js`](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/services/admin/vendor.service.js) | Frontend API | `listVendors`, `getVendorById`, `getVendorOverview` | Support server-side `activity` query parameter. |

---

## 13. AUDIT CONFIRMATION & SAFETY COMPLIANCE

- **Zero Modifications Executed:** This was a purely read-only diagnostic phase. Zero application code files, database schemas, records, tests, or configurations were modified.
- **Data Integrity Preserved:** No vendors, products, inventory reservations, orders, financial ledgers, or bank accounts were modified, deleted, or reset.
- **Evidence-Based:** Every finding and defect documented in this report is anchored to verified source code line numbers and live test runs.

---
*End of Phase VM-01 Forensic Audit Report.*

