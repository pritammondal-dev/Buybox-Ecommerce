# BUYBOX E-COMMERCE
# MAIN ADMINISTRATOR DASHBOARD — FULLY DYNAMIC IMPLEMENTATION REPORT
**Target Scope:** Main Administrator Overview Dashboard Page Exclusively  
**Route:** `/administrator/dashboard` (with redirects from `/admin` and `/administrator`)  
**Status:** COMPLETE & AUTOMATED VERIFICATION PASSED  
**Date:** October 28, 2026  
**Auditor:** Senior Infrastructure, Full-Stack & UI/UX Engineer  

---

## 1. EXECUTIVE SUMMARY & EXACT DASHBOARD ROUTE

This engineering task was scoped exclusively to making the **main Administrator Dashboard overview page** fully dynamic, data-driven, and connected to authoritative Buybox-Ecommerce backend database records and aggregations.

### Exact Routes & Files Inspected
* **Primary Dashboard Route:** `/administrator/dashboard`
* **Legacy & Canonical Redirects:**
  * `frontend/src/app/admin/page.js` $\rightarrow$ redirects to `/administrator/dashboard`
  * `frontend/src/app/administrator/page.js` $\rightarrow$ redirects to `/administrator/dashboard`
* **Page Component:** `frontend/src/app/administrator/dashboard/page.js`
* **Frontend Service Client:** `frontend/src/services/admin/admin.service.js` (`dashboardService.getStats`)
* **Backend API Route:** `GET /api/v1/admin/dashboard/stats` (mounted in `backend/src/routes/index.js` via `backend/src/routes/admin-dashboard.routes.js`)
* **Backend Controller:** `backend/src/controllers/admin-dashboard.controller.js`
* **Backend Service:** `backend/src/services/admin-dashboard.service.js`

---

## 2. BEFORE-AND-AFTER BEHAVIOR

| Capability / Widget | Before Implementation | After Dynamic Implementation |
| :--- | :--- | :--- |
| **Date Range Filtering** | Non-existent; frontend made a parameterless request that only aggregated all-time counts. | Interactive button group supporting **Today**, **Last 7 Days**, **Last 30 Days (default)**, and **Last 90 Days**. Changing the filter immediately recalculates period-scoped revenue, orders, GMV, refunds, customer signups, and daily trends. |
| **Sales & Orders Trends Visualizer** | No visual chart existed on the Administrator overview page. | Added interactive continuous time-series bar chart derived directly from MongoDB aggregations. Supports dynamic toggling between **"Revenue (₹)"** and **"Orders Count"**, with interactive hover tooltips (date, revenue, orders count, signup count) and daily average indicators. |
| **Financial Metric Bounds** | Revenue aggregated all orders with `paymentStatus: "paid"` regardless of date or post-payment cancellation. | Period-scoped metrics filter strictly by `createdAt: { $gte: startDate, $lte: endDate }` and exclude cancelled or voided orders (`status: { $nin: ["cancelled", "voided"] }`). All monetary values are formatted in Indian Rupee (`INR` / `₹`) with localized precision. |
| **Operational Queues** | Static metrics with no direct action pathways. | Interactive queue cards for **Fulfillment Dispatch Queue**, **Vendor Review Queue**, **Low Stock Alerts**, and **Returns/RMAs** with direct deep-links to their canonical management modules. |
| **Recent Orders** | Displayed order list without customer name/email; order numbers were not hyperlinked. | Top 10 recent orders populated with customer name/email, canonical status and payment status badges, and direct links to `/administrator/operations/orders/${ord._id}`. |
| **Vendor Onboarding Queue** | Basic list without direct links. | Shows partner business name, slug, email, onboarding status badge, and direct links to `/administrator/vendors/${ven._id}`. |
| **Audit & Governance Events** | Basic log list without deep link. | Displays actor name, initials avatar, action type, target entity, and formatted timestamp with direct link to `/administrator/security/audit-logs`. |
| **Live Refresh & Error Recovery** | Basic fetch with unhandled background re-renders. | Implemented background refresh (`refreshing` state) with spinning indicator, skeleton loaders, error banner with **Retry** button, and empty states for zero-data intervals. |

---

## 3. DASHBOARD WIDGETS & AUTHORITATIVE DATA SOURCES

All metrics are calculated directly from authoritative MongoDB collections using server-side aggregations and indexed queries:

| Widget / Card | Authoritative Database Source | Aggregation / Selection Semantics |
| :--- | :--- | :--- |
| **Captured Revenue** | `Order` collection | `$match: { createdAt: { $gte: startDate, $lte: endDate }, paymentStatus: "paid", status: { $nin: ["cancelled", "voided"] } }`, summed via `$toDouble: "$grandTotal"`. |
| **Gross Merchandise Value (GMV)** | `Order` collection | `$match: { createdAt: { $gte: startDate, $lte: endDate }, status: { $nin: ["cancelled", "voided"] } }`, summed via `$toDouble: "$grandTotal"`. |
| **Total Orders** | `Order` collection | Period orders: count of non-cancelled orders created in the interval. All-time orders and pending orders (`pending`, `confirmed`, `processing`) displayed for operational context. |
| **Platform Take / Commission** | `VendorSettlement` & `Order` | Sum of platform commission from settlements or derived platform fee (10% of captured revenue). |
| **Customers** | `User` collection | Total customer accounts (`role: "customer"`), active accounts, and `+X new customers` registered in the selected period. |
| **Vendors** | `Vendor` collection | Total non-deleted vendors, active approved vendors, and pending review queue (`pending`, `under_review`, `changes_requested`). |
| **Catalog Items** | `Product` collection | Total active products and items pending moderation (`status: "pending_approval"`). |
| **Low Stock Alerts** | `Inventory` collection | `$expr: { $lte: [{ $subtract: ["$onHand", "$reserved"] }, "$lowStockThreshold"] }`. |
| **Returns Queue** | `ReturnRequest` collection | Count of return requests with status in `["requested", "under_review", "refund_pending"]`. |
| **Refunds Issued** | `Refund` collection | Bounded sum of completed/processed refunds (`status: { $ne: "failed" }`) within the selected period. |
| **Vendor Settlements** | `VendorSettlement` collection | Count of settlement periods with status in `["pending", "eligible", "processing", "payable"]`. |
| **Support Tickets** | `SupportTicket` collection | Count of open inquiries with status in `["open", "pending", "in_progress"]`. |
| **Sales & Orders Trend Chart** | `Order` collection | Grouped by `$dateToString: { format: "%Y-%m-%d", date: "$createdAt" }`. Trend map filled continuously across every day in the interval to prevent gaps or broken visual charts. |
| **Recent Customer Orders** | `Order` collection | Latest 10 orders, sorted by `createdAt: -1`, with `customerId` populated (`firstName`, `lastName`, `email`). |
| **Vendor Onboarding Queue** | `Vendor` collection | Latest 8 applications sorted by `createdAt: -1`. |
| **Audit & Governance Activity** | `AuditLog` collection | Latest 8 audit events with `actorId` populated (`firstName`, `lastName`, `email`, `role`). |

---

## 4. BACKEND ENDPOINTS & API CONTRACT

### Reused Canonical Endpoint
`GET /api/v1/admin/dashboard/stats`  
*(Also accessible at canonical alias `GET /api/v1/administrator/dashboard/stats`)*

### Query Parameters
* `range` *(optional, string)*: `"today"` | `"7d"` | `"30d"` (default) | `"90d"` | `"custom"`
* `startDate` *(optional, ISO 8601 string)*: Custom range start
* `endDate` *(optional, ISO 8601 string)*: Custom range end

### Verified Response Contract
```json
{
  "success": true,
  "data": {
    "stats": { ... },
    "kpis": {
      "totalCustomers": 124,
      "activeCustomers": 118,
      "periodNewCustomers": 14,
      "totalVendors": 18,
      "pendingVendors": 3,
      "totalProducts": 340,
      "pendingProducts": 5,
      "totalOrders": 89,
      "pendingOrders": 7,
      "periodOrders": 22,
      "gmv": 145000.00,
      "revenue": 128500.00,
      "refunds": 1200.00,
      "commission": 12850.00,
      "lowStock": 4,
      "pendingReturns": 2,
      "openSupportTickets": 1
    },
    "periodMetrics": {
      "range": "30d",
      "startDate": "2026-09-29T00:00:00.000Z",
      "endDate": "2026-10-28T23:59:59.999Z",
      "orders": 22,
      "pendingOrders": 3,
      "gmv": 45000.00,
      "revenue": 38500.00,
      "refunds": 500.00,
      "commission": 3850.00,
      "newCustomers": 14,
      "newVendors": 2
    },
    "trends": [
      { "date": "2026-10-22", "sales": 4500.00, "gmv": 5200.00, "orders": 3, "newCustomers": 2 },
      { "date": "2026-10-23", "sales": 0.00, "gmv": 0.00, "orders": 0, "newCustomers": 1 }
    ],
    "recentOrders": [ ... ],
    "recentVendors": [ ... ],
    "recentActivity": [ ... ],
    "authorizedSections": {
      "customers": true,
      "vendors": true,
      "products": true,
      "orders": true,
      "finance": true,
      "inventory": true,
      "returns": true,
      "support": true,
      "tasks": true,
      "activity": true
    }
  }
}
```

---

## 5. METRIC DEFINITIONS, DATE & TIMEZONE RULES

1. **Date Boundaries:**
   - Evaluated using deterministic local start-of-day (`00:00:00.000`) and end-of-day (`23:59:59.999`) timestamps, converted to UTC ISO strings for MongoDB date operators.
   - Default range: `30d` (past 30 days inclusive).
   - "Today" range: strictly from 00:00:00.000 of the current day to 23:59:59.999.
2. **Revenue vs. GMV:**
   - **GMV:** Gross value of all placed orders excluding `cancelled` and `voided`.
   - **Revenue:** Only orders where `paymentStatus === "paid"` and `status` is not `cancelled` or `voided`.
3. **Refund Accounting:**
   - Excludes `failed` refund attempts to prevent false deductions.
4. **Continuous Timeline Guarantee:**
   - The trend aggregator creates a continuous calendar day sequence from `startDate` to `endDate`. If no orders occurred on a day, it emits `{ date, sales: 0, gmv: 0, orders: 0, newCustomers: 0 }`, guaranteeing chart stability without gaps.

---

## 6. SECURITY & RBAC ENFORCEMENT

1. **Route-Level Guarding:**
   - Guaranteed by `authenticate` (JWT authentication) and `requirePermissions(PERMISSIONS.DASHBOARD_VIEW)`.
   - Unauthenticated requests are rejected with `401 Unauthorized`.
2. **Service-Level Column-Level Security:**
   - If an administrator lacks `finance.view` (or `finance:read`), financial metrics (`revenue`, `gmv`, `refunds`, `commission`) are omitted (`null`), and financial chart trend points return `0`.
   - If an administrator lacks `orders.view`, order lists and order counts are redacted.
   - If an administrator lacks `customers.view`, customer counts and customer signups are redacted.
   - If an administrator has `super_admin` privilege, all sections are authorized.

---

## 7. FILES CHANGED & WHY

| File Path | Nature of Change |
| :--- | :--- |
| `backend/src/controllers/admin-dashboard.controller.js` | Extracted `range`, `startDate`, and `endDate` from `req.query` and passed options to service. |
| `backend/src/services/admin-dashboard.service.js` | Added `resolveDateRange` helper, period-scoped aggregations, continuous daily trend generator, and customer population on recent orders. |
| `frontend/src/services/admin/admin.service.js` | Updated `dashboardService.getStats` to accept optional `params = {}` and forward them to Axios. |
| `frontend/src/app/administrator/dashboard/page.js` | Full dynamic rewrite: interactive date-range filter, live refresh state, trend chart with metric toggle, operational quick-queue cards, formatted INR currency, direct canonical deep-links, and loading/empty/error states. |
| `backend/tests/admin-dashboard.test.js` | **New**: 11 unit & integration tests for date range resolution, RBAC boundaries, backward compatibility, and trend contracts. |
| `frontend/tests/unit/admin-dashboard-page.test.js` | **New**: 7 unit tests for UI contracts, query parameters, date range options, and canonical route links. |

---

## 8. AUTOMATED VERIFICATION & TEST RESULTS

| Test Suite / Command | Scope | Result | Status |
| :--- | :--- | :---: | :---: |
| `npm test -- tests/admin-dashboard.test.js` | Backend date range resolution, RBAC access control, trend aggregation, KPI backward compatibility | **11 / 11 passed** | Pass |
| `npm test -- tests/environment-bootstrap.test.js` | Backend dotenv configuration, Cwd independence, secret safety | **12 / 12 passed** | Pass |
| `npm test -- tests/phase-e12e-worker-coordination.test.js` | Distributed locks, worker schedulers, health/readiness probe transitions | **22 / 22 passed** | Pass |
| `node --test tests/unit/admin-dashboard-page.test.js` | Frontend dashboard contract, dynamic range filters, chart toggles, deep-links | **7 / 7 passed** | Pass |
| `npm test` (Frontend Full Suite) | Storefront, admin, vendor, checkout, and catalog test suites | **537 / 537 passed** | Pass |
| Live API Route Probe (`GET /api/v1/admin/dashboard/stats`) | Direct probe against running dev server on port 5000 | **401 Unauthorized** (auth guarded) | Verified |

---

## 9. CONFIRMATION OF BOUNDARIES & UNTOUCHED MODULES

As mandated by Safety Requirements:
1. **Superadmin Dashboard:** Untouched (`frontend/src/app/superadmin/` preserved).
2. **Vendor Console:** Untouched (`frontend/src/app/vendor/` preserved).
3. **Staff Dashboard:** Untouched (`frontend/src/app/admin/staff/` preserved).
4. **Unrelated Admin Modules:** Products, Categories, Brands, Customers, Campaigns, Promotions, Settings, and Taxes were strictly preserved without modification.
5. **No Fake/Mock Data:** All displayed metrics, trends, and recent records are derived directly from real MongoDB collections and live backend responses.
