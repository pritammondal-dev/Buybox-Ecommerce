# Analytics & Business Reporting (Feature 7)

## 1. Overview & Architectural Scope

The Analytics & Business Reporting module provides financial metrics, top-performing product rankings, and daily sales trend intervals for the Buybox E-Commerce platform. It supports two operational scopes:

1. **Admin / Platform-Wide Analytics**: Enables authorized administrators and managers to view platform-wide aggregated business performance or filter metrics by a specific seller (`vendorId`).
2. **Vendor / Seller Analytics**: Enables authenticated sellers to access self-service analytics strictly isolated to their own product sales.

### Core Architectural Principles
- **Item-Level Vendor Isolation**: Seller revenue and performance are derived strictly from unwound order items (`Order.items`) matching the seller's verified identity. Order-level totals (`grandTotal`, `subtotal`) are never attributed to individual sellers in mixed-vendor orders.
- **Authoritative Accounting**: Financial formulas are computed directly from unit prices, item quantities, and item-level discounts and taxes. The module explicitly avoids relying on unverified precalculated line totals.
- **Strict Endpoint-Specific Parameter Contracts**: Every endpoint consumes and validates only the query parameters required for its specific aggregation. Extraneous or unused parameters are rejected with HTTP 400 `VALIDATION_ERROR`.
- **Deterministic UTC Reporting**: All calendar date calculations and interval boundaries operate strictly in Universal Coordinated Time (UTC).
- **Disk-Spill Safety**: All MongoDB aggregation pipelines execute with `{ allowDiskUse: true }` to defensively guard against the 100 MB aggregation stage memory ceiling.

---

## 2. Authentication & RBAC Contract

All analytics routes require an authenticated user session (`Authorization: Bearer <JWT>`). Permissions are enforced via the `requirePermissions` middleware:

| Role | Supported Permissions | Access Rights |
| :--- | :--- | :--- |
| `admin` | `analytics:read` | Full platform-wide analytics; can filter by `vendorId`. |
| `super_admin` | `analytics:read` | Full platform-wide analytics; can filter by `vendorId`. |
| `manager` | `analytics:read` | Full platform-wide analytics; can filter by `vendorId`. |
| `vendor` | `analytics:read_own` | Self-service seller analytics strictly isolated to own `vendorId`. |
| `customer` | *None* | HTTP 403 `INSUFFICIENT_PERMISSIONS`. |
| `support` | *None* | HTTP 403 `INSUFFICIENT_PERMISSIONS`. |

### Vendor Identity Resolution
Vendor endpoints (`/api/v1/analytics/vendor/*`) derive the seller's active identity automatically from `req.user.sub` by querying the `Vendor` collection (`{ userId, isActive: true, deletedAt: null }`). If no active vendor profile exists, an HTTP 404 `VENDOR_NOT_FOUND` error is returned. Vendors cannot pass or override `vendorId`.

---

## 3. Authoritative Accounting Semantics

### Realized Order Scope
Only realized, non-cancelled orders are included in revenue and sales metrics:
- **Included Order Status**: `status != 'cancelled'` (`pending`, `confirmed`, `processing`, `shipped`, `delivered`, `completed`).
- **Included Payment Status**: `paymentStatus IN ['paid', 'partially_refunded', 'refunded']`.
- **Excluded Payment Status**: Orders with `paymentStatus IN ['pending', 'authorized', 'failed']` are excluded from realized sales.

### Financial Formulas
For any given period and vendor scope (platform or isolated seller):

- **Gross Sales**:
  $$\text{grossSales} = \sum (\text{item.unitPrice} \times \text{item.quantity})$$
  *(Note: Does not use `lineTotal`).*
- **Discounts**:
  $$\text{discounts} = \sum (\text{item.discountTotal} \mathbin{\Vert} 0)$$
- **Merchandise Sales (Net Sales before Tax)**:
  $$\text{merchandiseSales} = \max(0, \text{grossSales} - \text{discounts})$$
- **Tax**:
  $$\text{tax} = \sum (\text{item.taxTotal} \mathbin{\Vert} 0)$$
- **Units Sold**:
  $$\text{unitsSold} = \sum \text{item.quantity}$$
- **Distinct Order Count**:
  $$\text{orderCount} = \text{COUNT}(\text{DISTINCT } \text{orderId})$$
  *(Computed via `$addToSet` in MongoDB aggregation; for a mixed-vendor order containing items from Vendor A and Vendor B, the order counts as 1 towards Vendor A and 1 towards Vendor B).*
- **Average Order Value (AOV)**:
  $$\text{averageOrderValue} = \begin{cases} \dfrac{\text{merchandiseSales}}{\text{orderCount}}, & \text{if } \text{orderCount} > 0 \\ "0.00", & \text{if } \text{orderCount} = 0 \end{cases}$$

### Monetary Representation
All monetary fields in response payloads (`grossSales`, `discounts`, `merchandiseSales`, `tax`, `averageOrderValue`, `refunds`, `revenue`, `grossRevenue`, `sales`) are formatted as fixed 2-decimal strings (e.g. `"1250.00"`).

---

## 4. Date & Time Contract

- **Reporting Timezone**: UTC (`+00:00`). All day boundaries, presets, and bucketing start at `00:00:00.000Z` and end at `23:59:59.999Z`.
- **Date String Format**:
  - Date-only strings (`YYYY-MM-DD`): Expanded to full calendar day (start: `T00:00:00.000Z`, end: `T23:59:59.999Z`).
  - Full ISO-8601 strings (`YYYY-MM-DDTHH:mm:ss.sssZ`): Preserves exact UTC timestamp.
- **Calendar Validation**: Impossible calendar dates (e.g. `2026-02-31`, `2026-04-31`) are strictly rejected with HTTP 400 `VALIDATION_ERROR`.
- **Presets**:
  - `today` (default): Covers current UTC day from `00:00:00.000Z` through `23:59:59.999Z`.
  - `last_7_days`: Spans exactly 7 complete UTC calendar days ending today at `23:59:59.999Z` (i.e. `now - 6 days 00:00:00.000Z` to `today 23:59:59.999Z`).
  - `last_30_days`: Spans exactly 30 complete UTC calendar days ending today at `23:59:59.999Z` (i.e. `now - 29 days 00:00:00.000Z` to `today 23:59:59.999Z`).
  - `custom`: Requires both `startDate` and `endDate`. Rejects requests where `startDate > endDate`.

---

## 5. Refund Semantics & Architectural Limitation

- **Platform-Level Authoritative Refunds**:
  - Processed platform refunds are aggregated from the authoritative `Refund` collection (`status == 'processed'`).
  - Available **only** on unfiltered Admin Overview requests (`isPlatformWide == true`).
  - `refunds` is returned as a 2-decimal string (e.g. `"75.00"`), with `refundAttributionAvailable: true`.
- **Seller-Level Refund Limitation**:
  - The Buybox `Refund` collection processes refunds at the order and payment level (`orderId`, `paymentId`), without verified item-level or vendor-level allocation.
  - In seller analytics (`/vendor/*`) and admin vendor-filtered analytics (`?vendorId=...`):
    - `refunds: null`
    - `refundAttributionAvailable: false`
    - `refundAttributionNote`: `"Seller-level refund attribution is unavailable because refunds are processed at the order/payment level."`
  - *No proportional or artificial seller refund allocations are fabricated.*

---

## 6. API Endpoints & Validation Specifications

### A. Admin Endpoints (`requirePermissions(PERMISSIONS.ANALYTICS_READ)`)

#### 1. `GET /api/v1/analytics/admin/overview`
Returns platform-wide or vendor-filtered revenue, tax, units, order counts, AOV, and platform refunds.

- **Allowed Parameters**:
  - `period`: `"today"` (default) \| `"last_7_days"` \| `"last_30_days"` \| `"custom"`
  - `startDate`: ISO date string (required if `period=custom`)
  - `endDate`: ISO date string (required if `period=custom`)
  - `vendorId`: 24-hex string (optional; filters platform metrics to specified vendor)
- **Strictly Rejected Parameters**: `limit`, `sortBy`, unknown parameters (`400 VALIDATION_ERROR`).
- **Response Payload**:
  ```json
  {
    "success": true,
    "message": "Overview analytics retrieved successfully",
    "data": {
      "period": "today",
      "startDate": "2026-09-11T00:00:00.000Z",
      "endDate": "2026-09-11T23:59:59.999Z",
      "metrics": {
        "grossSales": "1250.00",
        "discounts": "50.00",
        "merchandiseSales": "1200.00",
        "tax": "120.00",
        "unitsSold": 15,
        "orderCount": 4,
        "averageOrderValue": "300.00",
        "refunds": "75.00",
        "refundAttributionAvailable": true
      }
    }
  }
  ```

#### 2. `GET /api/v1/analytics/admin/top-products`
Returns ranked top-selling products across the platform or for a filtered vendor.

- **Allowed Parameters**:
  - `period`: `"today"` (default) \| `"last_7_days"` \| `"last_30_days"` \| `"custom"`
  - `startDate`: ISO date string (required if `period=custom`)
  - `endDate`: ISO date string (required if `period=custom`)
  - `vendorId`: 24-hex string (optional)
  - `limit`: Integer, `1` to `100` (default `10`)
  - `sortBy`: `"units"` (default) \| `"revenue"`
- **Strictly Rejected Parameters**: Unknown parameters (`400 VALIDATION_ERROR`).
- **Response Payload**:
  ```json
  {
    "success": true,
    "message": "Top products retrieved successfully",
    "data": {
      "period": "today",
      "startDate": "2026-09-11T00:00:00.000Z",
      "endDate": "2026-09-11T23:59:59.999Z",
      "items": [
        {
          "productId": "651f1f1f1f1f1f1f1f1f1f1f",
          "productVariantId": "651f2f2f2f2f2f2f2f2f2f2f",
          "productName": "Wireless Headphones",
          "variantName": "Matte Black",
          "sku": "WH-BLK-001",
          "unitsSold": 25,
          "revenue": "2499.75",
          "grossRevenue": "2599.75"
        }
      ]
    }
  }
  ```

#### 3. `GET /api/v1/analytics/admin/sales-trend`
Returns daily interval sales buckets across the period with zero-filled gaps.

- **Allowed Parameters**:
  - `period`: `"today"` (default) \| `"last_7_days"` \| `"last_30_days"` \| `"custom"`
  - `startDate`: ISO date string (required if `period=custom`)
  - `endDate`: ISO date string (required if `period=custom`)
  - `vendorId`: 24-hex string (optional)
- **Strictly Rejected Parameters**: `limit`, `sortBy`, unknown parameters (`400 VALIDATION_ERROR`).
- **Response Payload**:
  ```json
  {
    "success": true,
    "message": "Sales trend retrieved successfully",
    "data": {
      "period": "today",
      "startDate": "2026-09-11T00:00:00.000Z",
      "endDate": "2026-09-11T23:59:59.999Z",
      "intervals": [
        {
          "date": "2026-09-11",
          "sales": "250.00",
          "units": 3,
          "orders": 2
        }
      ]
    }
  }
  ```

---

### B. Vendor Endpoints (`requirePermissions(PERMISSIONS.ANALYTICS_READ_OWN)`)

#### 4. `GET /api/v1/analytics/vendor/overview`
Returns self-service sales overview isolated to the authenticated vendor.

- **Allowed Parameters**:
  - `period`: `"today"` (default) \| `"last_7_days"` \| `"last_30_days"` \| `"custom"`
  - `startDate`: ISO date string (required if `period=custom`)
  - `endDate`: ISO date string (required if `period=custom`)
- **Strictly Rejected Parameters**: `vendorId`, `limit`, `sortBy`, unknown parameters (`400 VALIDATION_ERROR`).

#### 5. `GET /api/v1/analytics/vendor/top-products`
Returns top-performing products ranked within the authenticated vendor's catalog.

- **Allowed Parameters**:
  - `period`: `"today"` (default) \| `"last_7_days"` \| `"last_30_days"` \| `"custom"`
  - `startDate`: ISO date string (required if `period=custom`)
  - `endDate`: ISO date string (required if `period=custom`)
  - `limit`: Integer, `1` to `100` (default `10`)
  - `sortBy`: `"units"` (default) \| `"revenue"`
- **Strictly Rejected Parameters**: `vendorId`, unknown parameters (`400 VALIDATION_ERROR`).

#### 6. `GET /api/v1/analytics/vendor/sales-trend`
Returns daily sales intervals strictly for the authenticated vendor.

- **Allowed Parameters**:
  - `period`: `"today"` (default) \| `"last_7_days"` \| `"last_30_days"` \| `"custom"`
  - `startDate`: ISO date string (required if `period=custom`)
  - `endDate`: ISO date string (required if `period=custom`)
- **Strictly Rejected Parameters**: `vendorId`, `limit`, `sortBy`, unknown parameters (`400 VALIDATION_ERROR`).

---

## 7. Aggregation Pipeline & Index Architecture

### Pipeline Execution Flow
1. **Initial Date & Status Match (`$match`)**:
   - Matches `createdAt: { $gte: startDate, $lte: endDate }`.
   - Restricts `status: { $ne: "cancelled" }`.
   - Restricts `paymentStatus: { $in: ["paid", "partially_refunded", "refunded"] }`.
   - For vendor queries, applies pre-unwind filter `items.vendorId: vendorId` to leverage multikey index boundaries before unwinding.
2. **Item Unwinding (`$unwind`)**:
   - Unwinds `$items` array to access individual line items.
3. **Secondary Vendor Isolation Match (`$match`)**:
   - For vendor queries, immediately filters `"items.vendorId": vendorId` post-unwind to discard line items belonging to other sellers in mixed orders.
4. **Grouping & Projection (`$group`)**:
   - First `$group` by `_id: "$_id"` (per-order accumulation) to ensure proper distinct order aggregation.
   - Second `$group` by `_id: null` to compute platform/vendor totals.
5. **Disk-Spill Protection**:
   - All Mongoose `aggregate()` calls pass `{ allowDiskUse: true }`.

### MongoDB Indexes
The analytics pipelines rely on the following compound indexes:

| Collection | Index Key Specification | Covered Query Operations |
| :--- | :--- | :--- |
| `orders` | `{ "items.vendorId": 1, status: 1, createdAt: -1 }` | Vendor-filtered overview, top products, sales trend |
| `orders` | `{ status: 1, paymentStatus: 1, createdAt: -1 }` | Platform-wide overview, top products, sales trend |
| `refunds` | `{ status: 1, createdAt: -1 }` | Platform-wide authoritative refund aggregation |

*(Note: Obsolete prefix indexes `{ status: 1, paymentStatus: 1 }`, `{ items.vendorId: 1 }`, and `{ items.vendorId: 1, status: 1 }` were safely removed in Task 7D.4 and 7D.5 to eliminate write overhead).*

---

## 8. Error Codes & Contract Summary

| HTTP Status | Error Code | Description |
| :--- | :--- | :--- |
| `400` | `VALIDATION_ERROR` | Schema validation failure (unrecognized keys, invalid dates, reversed date ranges, out-of-range limit, invalid sortBy, array parameters). |
| `400` | `INVALID_VENDOR_ID` | Malformed 24-hex string supplied as `vendorId`. |
| `401` | `AUTHENTICATION_REQUIRED` | Missing or invalid JWT access token. |
| `403` | `INSUFFICIENT_PERMISSIONS` | Token role does not possess the required permission. |
| `404` | `VENDOR_NOT_FOUND` | Authenticated vendor lacks an active, non-deleted vendor record. |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected internal failure. |

---

## 9. Testing & Operational Verification

- **Automated Unit & Contract Tests**: 71 passing tests in `backend/tests/analytics.test.js` covering routes, RBAC, input validation, calendar boundary logic, gap-filling algorithms, formulas, and mock aggregation execution.
- **Database-Free Test Architecture**: `npm test` runs 100% in-memory without connecting to MongoDB, completing in ~10–14 seconds.
- **Live Database Audits**: Live MongoDB aggregation execution, `IXSCAN` index plan confirmation, Decimal128 precision, and memory footprints (<16 KB, 0 disk spill) were verified on live collections during Tasks 7D.1, 7D.2, 7E, and 7G.
- **Integration Test Status**: Dedicated live integration testing (`npm run test:integration`) is deferred until project-wide CI and database fixture infrastructure are introduced.
