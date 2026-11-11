# Regression Test Report: Vendor Analytics Product Performance ($subtract array from array Fix)

**Target:** Vendor Analytics Product Performance Aggregation Pipeline  
**Suite:** `backend/tests/vendor-analytics-product-performance-subtract-array.test.js`  
**Execution Environment:** Node.js v22.14.0, Jest, MongoDB ReplicaSet (`buybox_test`), Next.js 16.3.5  
**Result:** 15/15 Dedicated Scenarios Passed | 100% Pass Rate

---

## 1. Test Results Matrix: 15 Core Scenarios

| # | Scenario Description | Input Fixture / Edge Case | Expected Behavior | Result |
|---|---|---|---|:---:|
| 1 | **Normal Order with Scalar Quantities** | 1 order, 1 item (qty: 2, unitPrice: ₹2999, disc: ₹99), multi-warehouse inventories (WH1: 40 onHand, 5 res, 2 dam, 1 def; WH2: 20 onHand, 2 res) | Aggregates without `$subtract` error. Correctly computes onHand = 60, available = 50, grossSales = ₹5998, netSales = ₹5899. | **PASS** |
| 2 | **Order Containing Multiple Products** | 1 order with 2 distinct product items (Headphones & Mouse) | Aggregates into distinct rows per SKU with independent inventory lookups. | **PASS** |
| 3 | **Multiple Variants of Same Product** | 1 order with 2 different variants (Black & Silver) of same product | Correctly isolates variant-level stock and sales under distinct SKU rows. | **PASS** |
| 4 | **Order with Returned Quantities** | Item with quantity = 2, returnedQuantity = 1 | Emits returnedUnits = 1 and accurately computes net realized units. | **PASS** |
| 5 | **Partial Returns / Refunded Status** | Order with paymentStatus: "partially_refunded" and returnStatus: "returned" | Included in analytics without skewing gross/net arithmetic. | **PASS** |
| 6 | **Fully Cancelled Order** | Order with status: "cancelled", cancellationStatus: "completed" | Strictly excluded from unitsSold and sales aggregates. Zero impact on realized sales. | **PASS** |
| 7 | **Partially Fulfilled Order** | Multi-item order where 1 item has fulfillmentStatus: "cancelled" | Cancelled item is excluded from sales while valid processing/delivered item is counted. | **PASS** |
| 8 | **Missing Optional Fields** | Order with omitted discountTotal and variantName | Defaults discount to 0 without throwing calculation or formatting errors. | **PASS** |
| 9 | **Explicit Null Values** | Raw collection insert with null discountTotal, null returnedQuantity, null variantName | `$convert` with `onNull: 0` handles nulls safely without runtime failure. | **PASS** |
| 10 | **Legacy Orders (`variantId` Structure)** | Order items referencing legacy `variantId` instead of `productVariantId` | `$ifNull` resolves `variantId` and maps inventory correctly. | **PASS** |
| 11 | **Empty Collection / Non-Matching Query** | Query for vendor with zero orders | Returns clean empty pagination `{ items: [], total: 0, page: 1, totalPages: 1 }`. | **PASS** |
| 12 | **Tenant Isolation (Multi-Vendor)** | Vendor A and Vendor B orders created in same database | Vendor A cannot view Vendor B's items, sales, or warehouse inventory. Strict tenant isolation. | **PASS** |
| 13 | **Date-Filtered Boundaries** | Order created 60 days ago outside 30-day window | Excluded from 30-day query; correctly included in 90-day query. | **PASS** |
| 14 | **Product with Zero Sales** | Newly created active product with zero placed orders | Query returns 0 units sold without inventory errors. | **PASS** |
| 15 | **Dual Contract Parity & Service Layer** | Execution via `analyticsService.getVendorProductPerformance` | Verifies dual contract: `currentStock == totalStockOnHand`, `availableStock == totalAvailableStock`, `netUnitsSold` computed. | **PASS** |

---

## 2. Regression & Cross-Suite Test Results

### 2.1 Backend Existing Analytics Tests
- **`tests/vendor-analytics-sort-contract.test.js`:** 10/10 passed (Canonical sort fields `unitsSold`, `grossSales`, `netSales`, `productName`, asc/desc, pagination, search).
- **`tests/vendor-analytics-vd03.test.js`:** 14/14 passed (Daily trends, overview metrics, period ranges).
- **Total Backend Analytics Passing:** 39 / 39 tests.

### 2.2 Frontend Unit Tests
- **Command:** `npm --prefix frontend test -- --watchAll=false`
- **Results:**
  - Test Suites: **258 passed**, 258 total
  - Tests: **793 passed**, 793 total
  - Regressions: **0**

### 2.3 Next.js Production Build
- **Command:** `npm --prefix frontend run build`
- **Output:**
  - Compiled successfully in 29.5s
  - Static page generation: **292/292 routes**
  - Errors / Warnings: **0**

---

## 3. Git Status & Repository Governance

- **Zero commits executed.**
- **Zero git pushes executed.**
- All pre-existing working tree modifications have been strictly preserved.

