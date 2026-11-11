# BUYBOX E-COMMERCE — PRODUCTION VENDOR ORDER, FULFILLMENT, SHIPPING, RETURNS & SETTLEMENT ENGINE

## 1. Executive Architecture Overview

The Buybox Vendor Order, Fulfillment, Shipping, Returns/Refunds, and Settlement lifecycle is designed for a secure, multi-vendor marketplace where independent merchants operate autonomously within strict tenant isolation boundaries.

```mermaid
graph TD
    A[Customer Checkout / Payment Captured] -->|Order Created| B[Order Confirmed]
    B -->|Vendor Discovers Order| C[/api/v1/vendors/me/orders]
    C -->|Process & Pack| D[Vendor Order Item: Processing -> Ready to Ship]
    D -->|Create Dispatch| E[Shipment Created: SHP-XXXX]
    E -->|Courier Carrier / Delhivery / Shiprocket| F[In Transit -> Out for Delivery]
    F -->|Delivered| G[Order Item Fulfilled & Order Status Delivered]
    G -->|Customer RMA Request| H[Return Filed: RET-XXXX]
    H -->|Vendor Approval / Inspection| I[Receive & Restock to Warehouse]
    I -->|Line Refund| J[Customer Refunded: paymentStatus -> partially_refunded]
    G -->|7-Day Return Window Closes| K[Settlement Eligibility Engine]
    K -->|Gross Sales - Returns - Commission| L[Vendor Statement Generated: SET-XXXX]
    L -->|Finance Ops Payout| M[Bank Wire / NEFT Settled: Status Paid]
```

---

## 2. Multi-Vendor Isolation & Security Model

1. **Vendor Boundary Enforcement**:
   - Every merchant endpoint is scoped under `/api/v1/vendors/me/*`.
   - The merchant's identity is resolved dynamically from `req.user.id` using `resolveApprovedVendor()`. Under-review, pending, or suspended vendors are rejected with `403 VENDOR_ONBOARDING_NOT_APPROVED` or `403 VENDOR_INACTIVE`.
   - In multi-item, multi-vendor orders, each vendor only sees their own assigned order items (`items.vendorId == vendor._id`), their computed subtotal, and their specific dispatches. Cross-tenant order details and other vendors' items are strictly redacted.

2. **Secure Identifier Subsystem (`secure-id.util.js`)**:
   - Public vendor endpoints require encrypted, opaque identifiers:
     - Orders: `ord_<base64Url>`
     - Shipments: `shp_<base64Url>`
     - Returns: `ret_<base64Url>`
     - Settlements: `stl_<base64Url>` (or `set_`)
     - Vendors: `ven_<base64Url>`
   - Raw 24-character hexadecimal MongoDB ObjectIds are strictly disallowed on public vendor endpoints (`400 RAW_IDENTIFIER_DISALLOWED`).

---

## 3. Order & Fulfillment Lifecycle State Machine

### 3.1 Order Item Fulfillment States
- `unfulfilled`: Default upon customer payment capture.
- `processing`: Merchant has acknowledged and started picking the order.
- `ready_to_ship`: Items packed in tamper-evident packaging.
- `shipped`: Shipment picked up by courier carrier.
- `delivered`: Courier confirms delivery to customer.
- `cancelled`: Item cancelled before shipment pickup.

### 3.2 Shipment Lifecycle & Inventory Sync
- When a vendor creates a shipment (`POST /api/v1/vendors/me/orders/:orderId/shipments`), items are linked via `item.shipmentId = shipment._id`.
- On `picked_up`, reserved inventory transitions to sold inventory (`inventory.reserved -= qty`).
- On shipment cancellation before pickup, reserved inventory is safely restored via atomic CAS (`claimReservationRelease`).
- On `delivered`, the order items are marked as `fulfillmentStatus: "delivered"`. If all shipments in the order have reached `delivered`, the top-level order is synchronized to `status: "delivered"` and `order.deliveredAt` timestamp is recorded.

---

## 4. Return Merchandise Authorization (RMA) & Restock Engine

### 4.1 Return Lifecycle
- Customer submits return request via `POST /api/v1/returns` (only permitted when order `status === "delivered"` within return window).
- Initial status: `requested`.
- Vendor operations console (`/vendor/returns/[id]`):
  - **Approve**: `POST /api/v1/vendors/me/returns/:returnId/approve` (Transitions to `approved`).
  - **Reject**: `POST /api/v1/vendors/me/returns/:returnId/reject` (Requires rejection reason).
  - **Receive & Restock**: `POST /api/v1/vendors/me/returns/:returnId/receive`. Atomically increments `inventory.onHand += returnedQty` in the specified warehouse.
  - **Process Refund**: `POST /api/v1/vendors/me/returns/:returnId/refund`. Reconciles line refund, triggers payment refund via Razorpay (if gateway payment exists) or updates `order.paymentStatus = "partially_refunded"`, and logs an immutable audit trail.

---

## 5. Settlement & Finance Reconciliation Engine

### 5.1 Eligibility Rules (7-Day Cooling Period)
1. Order must be in `delivered` or `completed` status.
2. Order `paymentStatus` must be `paid` or `partially_refunded`.
3. `order.deliveredAt` must be older than 7 days (`deliveredAt <= (now - 7 days)`).
4. Unsettled items (`!item.settlementId`) with `fulfillmentStatus !== "cancelled"`.

### 5.2 Commission & Net Payout Formula
$$\text{Gross Sales} = \sum (\text{Line Total of Eligible Items})$$
$$\text{Discounts} = \sum (\text{Merchant-funded discounts})$$
$$\text{Refunds} = \sum (\text{Completed Returns for Vendor's Items})$$
$$\text{Net Sales} = \max(0, \text{Gross Sales} - \text{Discounts})$$
$$\text{Platform Commission} = \text{Net Sales} \times \text{Vendor Commission Rate}$$
$$\text{Net Payable} = \max(0, \text{Gross Sales} - \text{Discounts} - \text{Refunds} - \text{Platform Commission})$$

### 5.3 Cycle Generation & Payout
- Generated via `POST /api/v1/vendor-settlements/generate` (Admin triggered or scheduled CRON).
- Creates `VendorSettlement` document (`SET-XXXXXXXX-XXXX`) and transactionally tags `item.settlementId = settlement._id`.
- Payout is recorded via `POST /api/v1/vendor-settlements/:settlementId/pay` with bank reference code (`payoutReference`), transitioning statement status to `paid`.

---

## 6. Verification & Test Evidence

| Test Suite | Scope | Status |
| :--- | :--- | :--- |
| `tests/vendor-order-fulfillment-lifecycle.test.js` | Full 6-step lifecycle: Order -> Fulfillment -> Shipment -> RMA -> Settlement -> Audit | **6 / 6 PASSED** |
| `tests/vendor-onboarding-workflow.test.js` | Onboarding lifecycle, review, change requests, RBAC boundaries | **15 / 15 PASSED** |
| `tests/vendor-shipment-splitting.test.js` | Multi-vendor shipment splitting, inventory deduction, order isolation | **21 / 21 PASSED** |
| Frontend Turbopack Build (`npm run build`) | Static page generation across 152 routes (Admin & Vendor console) | **152 / 152 PASSED** |
