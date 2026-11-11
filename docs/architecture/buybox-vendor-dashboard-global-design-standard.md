# BUYBOX VENDOR DASHBOARD — GLOBAL DESIGN STANDARD

---

## 1. EXECUTIVE OVERVIEW & PHILOSOPHY

The **Buybox Vendor Dashboard** is the primary operational console for marketplace merchants, sellers, and brand owners. Designed with reference to the information density, visual hierarchy, and high-efficiency workflows of **Amazon Seller Central**, the interface provides a dedicated seller operating system while maintaining the distinct, original **Buybox Brand Identity** (Buybox Emerald `#004D38` / `#007A55`, crisp Slate neutrals, and Tailwind CSS).

### Core Principles
1. **Operational Density**: Maximize functional utility per screen area without visual clutter. Prioritize critical metrics, inventory health, order fulfillment states, and financial balances.
2. **Authoritative Backend Data (Zero Mock Data)**: Every KPI metric, chart data point, table row, and notification badge is strictly backed by live MongoDB database aggregations. Falsified or static mock values are strictly forbidden.
3. **Multi-Tenant Scoping & Security**: All listings, inventory quantities, customer order line items, shipments, and payouts are tenant-isolated and authorized via vendor middleware and secure ID mappings.
4. **Consistency Through Shared Reusable Components**: All modules consume a single standardized UI library (`@/components/vendor`) rather than hand-rolling divergent page headers, tables, badges, or empty states.
5. **Responsive & Accessible**: Fully functional on desktop (optimized for fast mouse/keyboard data entry) and mobile devices (touch-friendly collapsible side navigation).

---

## 2. COLOR PALETTE & TYPOGRAPHIC HIERARCHY

### 2.1 Brand & Accent Colors
| Role | Color Name | Hex Code | Tailwind Token | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Primary** | Buybox Deep Forest | `#004D38` | `bg-[#004D38]` | Primary CTA buttons, active sidebar selections, header badges |
| **Primary Accent** | Buybox Emerald | `#007A55` | `text-[#007A55]` | Links, hover highlights, sales trends, positive KPI cards |
| **Neutral Slate** | Dark Charcoal | `#0F172A` | `text-slate-900` | Section headings, primary metric numerals, table headers |
| **Neutral Slate** | Medium Gray | `#64748B` | `text-slate-500` | Subtitles, field labels, secondary table cells |
| **Neutral Border** | Subtle Slate | `#E2E8F0` | `border-slate-200` | Card borders, table dividers, input borders |
| **Surface** | Pure White | `#FFFFFF` | `bg-white` | Card backgrounds, dropdown menus, table bodies |
| **Background** | Clean Slate Canvas | `#F8FAFC` | `bg-slate-50` | Layout canvas, table header bands, search backgrounds |

### 2.2 Semantic State Color System
Standardized across `STATUS_STYLES` (`@/utils/status-badge.util.js`) and `VendorKpiCard`:
- **Emerald** (`bg-emerald-50 text-emerald-800 border-emerald-200`): Fulfilled, Delivered, Active, Healthy, Disbursed.
- **Blue** (`bg-blue-50 text-blue-800 border-blue-200`): Shipped, Partially Fulfilled, In Transit, Manifested, Inspected.
- **Amber** (`bg-amber-50 text-amber-800 border-amber-200`): Processing, Confirmed, Low Stock, Pending Review, Pending Inspection.
- **Rose** (`bg-rose-50 text-rose-800 border-rose-200`): Out of Stock, Cancelled, Rejected, Delivery Failed, Changes Requested.
- **Purple** (`bg-purple-50 text-purple-800 border-purple-200`): Out for Delivery, Variable Listings, High-Priority Alerts.
- **Teal** (`bg-teal-50 text-teal-800 border-teal-200`): Financial Settlements, Bank Accounts, Payout Summaries.
- **Slate** (`bg-slate-100 text-slate-700 border-slate-200`): Draft, Inactive, Archived, Fallback neutral state.

---

## 3. GLOBAL SHELL & NAVIGATION ARCHITECTURE

```
+----------------------------------------------------------------------------------------------------+
|  [Buybox Seller Central]   [ Q  Search orders (ORD-...) or products... ]   (Notif) (Store) (User v)|
+-------------------+--------------------------------------------------------------------------------+
| [=] Hide Sidebar  | Home / Products                                                                |
|                   | Product Catalog                                            [Refresh] [+ Add New]|
| [Dashboard]       | Manage your marketplace listings, variants, and pricing.                       |
| [Catalog v]       +--------------------------------------------------------------------------------+
|   Products        | [ Q Search by title, SKU... ]  [All] [Active] [Draft] [Pending Review]          |
|   Add Listing     +--------------------------------------------------------------------------------+
|   Import / Export | Product            SKU       Category    Price      Status      Actions        |
| [Orders v]        | ------------------------------------------------------------------------------ |
|   Manage Orders   | [Img] Wireless...  SKU-001   Electronics Rs. 999   (•) Active  [Edit] [Storefront]|
|   Shipments       | ------------------------------------------------------------------------------ |
|   Returns / RMA   | Showing 1 - 20 of 142 items                   [<] [1] [2] [3] ... [8] [>]       |
| [Inventory]       +--------------------------------------------------------------------------------+
| [Finance v]       |                                                                                |
|   Overview        |                                                                                |
|   Bank Accounts   |                                                                                |
|   Statements      |                                                                                |
| [Settings]        |                                                                                |
+-------------------+--------------------------------------------------------------------------------+
```

### 3.1 Header (`VendorHeader.jsx`)
- **Seller Central Search Bar**: Prominent center search. Inspects input dynamically:
  - Strings matching `ORD` prefix or $\ge 5$ numeric digits $\to$ routed directly to `/vendor/orders?search=...`.
  - All other inputs $\to$ routed directly to `/vendor/products?search=...`.
- **Notification Dot**: Real-time actionable notifications alert.
- **Merchant Identity Pill**: Displays store name, verified status badge, and role.
- **Account Dropdown**: Provides quick links to Store Profile, Bank Accounts, and Secure Signout.

### 3.2 Sidebar (`VendorSidebar.jsx`)
- **Collapsible Toggle**: Saves horizontal screen real estate for wide data tables.
- **Structured Categories**:
  1. *Operations Hub*: Dashboard overview.
  2. *Catalog & Products*: Listings, Product Editor, Bulk Import.
  3. *Orders & Logistics*: Customer Orders, Outbound Shipments, Returns/RMA.
  4. *Inventory Control*: Warehouse Allocations, Stock Adjustments.
  5. *Finance & Payouts*: Settlement Ledger, Bank Accounts, Account Statements.
  6. *Store & Settings*: Merchant Profile, Storefront Customization, Business Compliance.
- **Exact-Route Matching**: Prevents active prefix collision between parent (`/vendor/finance`) and subroutes (`/vendor/finance/bank-accounts`).

---

## 4. STANDARDIZED COMPONENT LIBRARY (`@/components/vendor`)

All vendor-facing screens import from the barrel export `@/components/vendor`:

```javascript
import {
  VendorShell,
  VendorHeader,
  VendorSidebar,
  VendorPageHeader,
  VendorBreadcrumbs,
  VendorKpiCard,
  VendorStatusBadge,
  VendorEmptyState,
  VendorTablePagination,
} from "@/components/vendor";
```

### 4.1 `VendorPageHeader`
Standardizes the top section of every vendor screen:
- **`breadcrumbs`**: Array of `{ label, href }` items rendered via `VendorBreadcrumbs`.
- **`title`**: Screen heading with bold typography.
- **`subtitle`**: Contextual explanation of the module's scope.
- **`badge`**: Optional status pill (e.g., active store status).
- **`actions`**: Contextual toolbar slot (Refresh buttons, export menus, create actions).

### 4.2 `VendorBreadcrumbs`
- Accessible `<nav aria-label="Breadcrumb">` implementation.
- Root element defaults to Home icon linking to `/vendor/dashboard`.
- Separators use subtle chevron icons with proper `aria-hidden` attributes.

### 4.3 `VendorKpiCard`
Information-dense metrics card supporting:
- **`title`**: Uppercase tracking-wider label.
- **`value`**: Prominent bold number/currency formatted string.
- **`subtitle`**: Secondary contextual detail.
- **`trend`**: Optional `{ value: "+12.4%", isPositive: true }` indicator.
- **`icon`**: Lucide icon component.
- **`variant`**: Semantic theme (`emerald`, `blue`, `amber`, `rose`, `purple`, `teal`, `indigo`, `slate`).
- **`alert`**: Animated pulse dot when operational intervention is required.
- **`href`**: Clickable navigation wrapper with hover elevation.
- **`isLoading`**: Smooth skeleton loader state.

### 4.4 `VendorStatusBadge`
Uniform status pills driven by `resolveStatusMeta` (`@/utils/status-badge.util.js`):
- Single source of truth for semantic color mapping and human-readable labels.
- Supports order fulfillment, catalog review, physical stock health, carrier shipment, return RMA, and financial disbursement statuses.
- Includes colored indicator dot (`showDot=true`).

### 4.5 `VendorEmptyState`
Friendly, informative placeholder card for zero-state scenarios:
- Displays contextual icon in muted slate circle.
- Explains why the view is currently empty.
- Provides clear primary call-to-action (e.g., "Create Product", "Clear Filters").

### 4.6 `VendorTablePagination`
Seller Central style pagination controls:
- **Smart Windowing**: Displays numbers `1 .. 4 5 6 .. 20` using `getPaginationRange`.
- **Record Counters**: Authoritative "Showing 21 - 40 of 142 items".
- **Items Per Page**: Configurable page size selector (`10`, `20`, `50`, `100`).
- **Accessible State**: Disables buttons during asynchronous loading.

---

## 5. MODULE ADOPTION AUDIT MATRIX

| Module | Route | Standard Header | KPI Cards | Status Badges | Empty States | Pagination |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Dashboard Overview** | `/vendor/dashboard` | Yes | Yes (6 KPIs) | Yes | Yes | N/A |
| **Product Catalog** | `/vendor/products` | Yes | N/A | Yes | Yes | Yes |
| **Customer Orders** | `/vendor/orders` | Yes | N/A | Yes | Yes | Yes |
| **Shipment Logistics** | `/vendor/shipments` | Yes | N/A | Yes | Yes | Yes |
| **Customer Returns** | `/vendor/returns` | Yes | N/A | Yes | Yes | Yes |
| **Inventory Control** | `/vendor/inventory` | Yes | Yes (3 KPIs) | Yes | Yes | Yes |
| **Finance Overview** | `/vendor/finance` | Yes | Yes | Yes | Yes | Yes |
| **Bank Accounts** | `/vendor/finance/bank-accounts` | Yes | N/A | Yes | Yes | N/A |
| **Statements** | `/vendor/finance/statements` | Yes | N/A | Yes | Yes | Yes |

---

## 6. VERIFICATION & QUALITY ASSURANCE

- **Unit Tests**: `frontend/tests/unit/vendor-design-standard.test.js` (5/5 passing).
- **Core Remediation Tests**: `frontend/tests/unit/phase-vd02-core-remediation.test.js` (7/7 passing).
- **Console Service Contract Tests**: `frontend/tests/unit/vendor-console.test.js` (10/10 passing).
- **Bank Account Compliance Tests**: `frontend/tests/unit/vendor-bank-account-ui.test.js` (21/21 passing).
- **Navigation Tests**: `frontend/tests/unit/phase-vb04r2-remediation.test.js` (7/7 passing).
- **Zero Mock Data Invariant**: All KPI metrics, trend lines, and listings directly consume live backend APIs (`vendorService.getDashboardAnalytics`, `vendorService.getMyProducts`, etc.).

