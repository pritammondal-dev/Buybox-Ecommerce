# Buybox Multi-Vendor Marketplace — Forensic Audit Report
## Phase: VENDOR-WAREHOUSE-OPERATIONS-02
### Complete Vendor Warehouse Operations & Inventory Movement Management

**Date:** November 9, 2026  
**Auditor:** Principal MERN Architect & Enterprise Operations Auditor  
**Workspace:** `d:\MERN Stack\Buybox-Ecommerce`  
**Classification:** Warehouse Logistics, Inventory Accounting, Multi-Tenant Governance

---

## 1. Executive Summary

A comprehensive forensic inspection of the existing codebase was conducted prior to implementing operational warehouse capabilities. This audit evaluated database schemas, services, transaction repositories, reservation lifecycles, access control boundaries, notification channels, and frontend modules across both backend and frontend layers.

The audit revealed that **core operational foundations already exist** within the repository (`StockReceiving`, `StockTransfer`, `InventoryTransaction`, `StockCount`, and `Inventory`), but were originally authored as internal or admin-centric subsystems (`/warehouse-operations/*`) rather than vendor-accessible, tenant-isolated merchant workflows.

As a result, merchants currently have read visibility of inventory levels and warehouse metrics, but lack authenticated, tenant-isolated workflows for **Goods Receiving**, **Inter-Warehouse Transfers**, **Controlled Structured Adjustments**, **Consolidated Stock Movement Ledgers**, and **Custom Reorder Thresholds**.

---

## 2. Current Stock Lifecycle & Architecture Assessment

### 2.1 Inventory Schema (`backend/src/models/Inventory.js`)
- **Key Fields:**
  - `productVariantId`: References `ProductVariant` (compound unique index with `warehouseId`).
  - `warehouseId`: References `Warehouse`.
  - `onHand`: Physical units present at the facility (must be $\ge 0$).
  - `reserved`: Units allocated to active carts/orders (must be $\ge 0$).
  - `damaged`, `defective`, `expired`: Segregated non-sellable condition buckets.
  - `lowStockThreshold`: Reorder trigger level (defaults to 5).
  - `lastStockUpdateAt`: Timestamp of last mutation.
- **Authoritative Accounting Rules:**
  $$\text{Non-Sellable} = \text{damaged} + \text{defective} + \text{expired}$$
  $$\text{Available Stock} = \max(0, \text{onHand} - \text{reserved} - \text{Non-Sellable})$$
  $$\text{Invariant 1:} \quad \text{onHand} \ge 0$$
  $$\text{Invariant 2:} \quad \text{reserved} \le \text{onHand}$$

### 2.2 Inventory Transaction Model (`backend/src/models/InventoryTransaction.js`)
- **Immutable Audit Trail:** Tracks every stock mutation with:
  - `type`: Enum `["receive", "adjustment", "reservation", "release", "sale", "return", "transfer", "count_reconciliation", "condition_change"]`.
  - `quantity`: Signed integer delta.
  - `onHandBefore`, `onHandAfter`: Exact pre- and post-mutation physical counts.
  - `reservedBefore`, `reservedAfter`: Exact pre- and post-mutation reservation counts.
  - `referenceType`, `referenceId`: Upstream document linkages (`order`, `stock_receiving`, `transfer_dispatch`, `transfer_receipt`, etc.).
  - `idempotencyKey`: Unique partial index preventing duplicate executions.
  - `actorUserId`: Initiating user.
- **Finding:** The model **lacks an explicit `vendorId` field**, meaning queries for a specific vendor's transaction ledger previously required costly multi-collection joins or were not exposed.

### 2.3 Stock Receiving Subsystem (`backend/src/models/StockReceiving.js`, `stock-receiving.service.js`)
- **Existing Architecture:** Implements a two-phase receiving lifecycle: `draft` $\rightarrow$ `confirmed` (with `cancelled` fallback).
  - Generates human-readable receiving number (`RCV-YYYYMMDD-XXXXXX`).
  - Validates expected, received, and rejected quantities.
  - During confirmation: upserts `Inventory` records and writes `InventoryTransaction` with `type: "receive"`.
- **Tenant Isolation Gap:** `StockReceiving` **does not store `vendorId`**, nor does `stock-receiving.service.js` verify that variants belong to the merchant submitting the receiving record! Routes are mounted under `/warehouse-operations/receiving` guarded by `PERMISSIONS.WAREHOUSES_MANAGE`, which vendors do not possess.

### 2.4 Stock Transfer Subsystem (`backend/src/models/StockTransfer.js`, `stock-transfer.service.js`)
- **Existing Architecture:** Implements a multi-stage inter-warehouse transfer pipeline:
  $$\text{draft} \rightarrow \text{approved} \rightarrow \text{dispatched} \rightarrow \text{partially\_received} \mid \text{received} \mid \text{cancelled}$$
  - Generates transfer number (`TRF-YYYYMMDD-XXXXXX`).
  - At dispatch: validates source stock, subtracts from source `Inventory.onHand`, logs negative `transfer` transaction.
  - At receipt: adds to destination `Inventory.onHand`, logs positive `transfer` transaction, records item discrepancies.
- **Accounting Invariant:**
  $$\Delta \text{Source onHand} + \Delta \text{Destination onHand} + \text{In-Transit} + \text{Rejected} = 0$$
- **Tenant Isolation Gap:** `StockTransfer` **does not store `vendorId`**, and does not verify vendor ownership of the variant being transferred. Routes are mounted under `/warehouse-operations/transfers` for platform staff only.

---

## 3. Detailed Gap Analysis

| Subsystem | Existing State | Missing / Deficient Capability | Operational Risk |
|---|---|---|---|
| **Stock Receiving** | Generic admin model exists in `StockReceiving.js` | No vendor-scoped endpoint; no merchant ownership validation; missing `vendorId` on schema; no vendor UI | Cross-vendor inventory pollution; merchants cannot receive purchased stock into warehouses |
| **Warehouse Transfers** | Administrative service exists in `stock-transfer.service.js` | Missing vendor tenancy scoping; no vendor dispatch/receipt UI; status enum missing explicit `in_transit` and `rejected` states | Merchants cannot rebalance inventory across regional fulfillment nodes |
| **Stock Adjustments** | Basic delta adjustment in `adjustInventory` | No structured reason categorization (physical count, damaged, lost, expired, data correction); no condition bucket routing; minimal audit metadata | Uncontrolled stock edits without auditable business justification |
| **Movement History** | `InventoryTransaction` tracks mutations in DB | No vendor endpoint; transactions missing indexed `vendorId`; no UI movement ledger | Zero visibility for merchants into historical stock changes, order deductions, returns, or adjustments |
| **Reorder & Low Stock** | Default `lowStockThreshold: 5` on `Inventory` | Threshold is immutable from vendor UI; no calculated replenishment suggestions; no merchant alert notifications | Stockouts, missed sales, and unreplenished inventory |
| **Vendor UI** | `/vendor/inventory` and `/vendor/warehouses/[id]` | Only display static tables; no operational tabs for Receiving, Transfers, or Movement Ledger | Vendors must rely on platform administrators for basic logistics workflows |

---

## 4. Data Integrity & Security Risks

1. **Cross-Tenant Contamination:** If a vendor were given raw access to existing `/warehouse-operations/*` endpoints, they could receive stock for competitor SKUs, initiate unauthorized transfers, or inspect another vendor's inbound shipments.
2. **Negative Stock & Reservation Breach:** Stock transfers must never dispatch more stock than `onHand - reserved - nonSellable`. Unchecked adjustments could push `onHand` below committed customer orders.
3. **Double-Receipt & Duplicate Dispatch:** In concurrent environments, network retries without idempotency locks could confirm inbound shipments twice or double-deduct source warehouse stock.
4. **Orphaned In-Transit Inventory:** If a transfer is dispatched from Mumbai to Delhi, stock is removed from Mumbai immediately. If the destination never receives it and the transfer cannot be tracked, physical stock is lost in limbo.

---

## 5. Required Database & Schema Changes

To preserve backward compatibility with zero breaking changes to existing data:

1. **`backend/src/models/StockReceiving.js`:**
   - Add optional indexed field:
     ```javascript
     vendorId: {
       type: mongoose.Schema.Types.ObjectId,
       ref: "Vendor",
       default: null,
       index: true,
     }
     ```
   - Add compound index: `{ vendorId: 1, warehouseId: 1, status: 1, createdAt: -1 }`.

2. **`backend/src/models/StockTransfer.js`:**
   - Add optional indexed field:
     ```javascript
     vendorId: {
       type: mongoose.Schema.Types.ObjectId,
       ref: "Vendor",
       default: null,
       index: true,
     }
     ```
   - Expand `status` enum to support: `["draft", "pending", "approved", "dispatched", "in_transit", "partially_received", "received", "rejected", "cancelled"]`.
   - Add compound index: `{ vendorId: 1, status: 1, createdAt: -1 }`.

3. **`backend/src/models/InventoryTransaction.js`:**
   - Add optional indexed field:
     ```javascript
     vendorId: {
       type: mongoose.Schema.Types.ObjectId,
       ref: "Vendor",
       default: null,
       index: true,
     }
     ```
   - Add compound index: `{ vendorId: 1, createdAt: -1 }`.

4. **`backend/src/models/Inventory.js`:**
   - Add configurable reorder level:
     ```javascript
     reorderLevel: {
       type: Number,
       min: 0,
       default: 10,
     }
     ```

---

## 6. Required API Endpoints

Extend `backend/src/routes/inventory.routes.js` with dedicated, vendor-authenticated endpoints:

### Inbound Stock Receiving
- `POST /api/v1/inventory/vendor/receiving`: Create vendor inbound receiving record (with strict variant ownership validation).
- `POST /api/v1/inventory/vendor/receiving/:id/confirm`: Confirm receiving, update inventory atomically, and generate immutable audit logs.
- `POST /api/v1/inventory/vendor/receiving/:id/cancel`: Cancel draft receiving record.
- `GET /api/v1/inventory/vendor/receiving`: List receiving records strictly partitioned to authenticated vendor.
- `GET /api/v1/inventory/vendor/receiving/:id`: Get full receiving details.

### Inter-Warehouse Transfers
- `POST /api/v1/inventory/vendor/transfers`: Create transfer request between authorized warehouses.
- `POST /api/v1/inventory/vendor/transfers/:id/dispatch`: Dispatch goods, deduct source stock, enter in-transit state.
- `POST /api/v1/inventory/vendor/transfers/:id/receive`: Receive goods at destination warehouse with discrepancy accounting.
- `POST /api/v1/inventory/vendor/transfers/:id/cancel`: Cancel transfer before dispatch.
- `GET /api/v1/inventory/vendor/transfers`: List vendor transfers with status, warehouse, and date filters.
- `GET /api/v1/inventory/vendor/transfers/:id`: Get full transfer details.

### Controlled Adjustments
- `POST /api/v1/inventory/vendor/adjustments`: Execute structured inventory adjustments with reason codes, notes, before/after values, and condition bucket tracking.

### Stock Movement History
- `GET /api/v1/inventory/vendor/movements`: Consolidated transaction ledger for the vendor's catalog with movement type filtering, warehouse filtering, date range, search, and pagination.

### Reorder & Threshold Management
- `PATCH /api/v1/inventory/vendor/my/:id/threshold`: Update `lowStockThreshold` / `reorderLevel` for an inventory SKU.
- Auto-trigger low-stock in-app alerts via `CustomerNotification` when available stock $\le$ threshold.

---

## 7. Required Frontend Enhancements

In `frontend/src/app/vendor/inventory/page.js` and `frontend/src/services/vendor.service.js`:
1. **Four Operational Tabs:**
   - **Tab 1: Live Inventory** — SKU stock table, low stock alerts, threshold editing modal, quick replenishment suggestions.
   - **Tab 2: Goods Receiving** — Inbound shipments list, receiving status badges, "New Inbound Shipment" modal.
   - **Tab 3: Stock Transfers** — Multi-stage transfer list, in-transit status tracking, "New Stock Transfer" modal, dispatch & receipt action triggers.
   - **Tab 4: Movement Ledger** — Full historical transaction ledger with search, movement-type filters, quantity changes, and audit notes.
2. **Standardized Design Integration:**
   - Seamlessly match Buybox Vendor Console aesthetic (`bg-[#004D38]`, rounded-3xl containers, `VendorKpiCard`, `VendorStatusBadge`, `VendorEmptyState`, `VendorTablePagination`).
   - Retain existing layout, breadcrumbs, and sidebar grouping (Marketplace Operations).

---

## 8. Next Steps & Implementation Plan

1. **Step 1:** Update `StockReceiving.js`, `StockTransfer.js`, `InventoryTransaction.js`, and `Inventory.js` with non-breaking optional vendor fields and enum extensions.
2. **Step 2:** Update `inventory-transaction.service.js` to auto-resolve and persist `vendorId` during transaction creation.
3. **Step 3:** Implement vendor-scoped operational services in `stock-receiving.service.js`, `stock-transfer.service.js`, and `inventory.service.js`.
4. **Step 4:** Expose and secure vendor API endpoints in `inventory.controller.js` and `inventory.routes.js`.
5. **Step 5:** Update `frontend/src/services/vendor.service.js` with client methods.
6. **Step 6:** Modernize `frontend/src/app/vendor/inventory/page.js` with comprehensive operational tabs and modals.
7. **Step 7:** Write dedicated automated tests in `backend/tests/phase-vendor-warehouse-operations-02.test.js`.
8. **Step 8:** Run regressions, full frontend test suite, Next.js production build, and generate final documentation.

