# Forensic Audit Report: Vendor Analytics Product Performance MongoDB Aggregation Error

**Target:** Vendor Analytics Product Performance  
**Incident:** `Executor error during aggregate command on namespace: buybox.orders caused by :: can't $subtract array from array`  
**Frontend Trigger:** `frontend/src/app/vendor/analytics/page.js` line 155 (`fetchProductPerformance`) & line 189 (`loadAllData`)  
**Status:** Audit Completed & Root Cause Pinpointed

---

## 1. Executive Summary

During execution of the Vendor Analytics Product Performance dashboard on `/vendor/analytics`, requests to `GET /api/v1/analytics/vendor/product-performance` failed with a fatal MongoDB Aggregation pipeline exception:
```text
Executor error during aggregate command on namespace: buybox.orders
caused by :: can't $subtract array from array
```
This error prevented the vendor from viewing product-level performance metrics (units sold, gross sales, discounts, net sales, order counts, and on-hand/available stock).

A forensic audit of the end-to-end data flow was executed, spanning the frontend data fetcher, API routes, controller, service layer, and MongoDB repository aggregation pipeline.

---

## 2. Forensic Trace & Error Location

### 2.1 Frontend Call Origin
- File: [page.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/frontend/src/app/vendor/analytics/page.js#L140-L175)
- Calling function: `fetchProductPerformance` invoked in `loadAllData`.
- API Call: `vendorService.getProductPerformance(params)` querying endpoint `GET /api/v1/analytics/vendor/product-performance`.

### 2.2 Backend Endpoint & Routing
- Route: [analytics.routes.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/routes/analytics.routes.js) -> `analyticsController.getVendorProductPerformance`.
- Service: [analytics.service.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/services/analytics.service.js#L663-L720) -> `getVendorProductPerformance({ userId, query })`.
- Repository: [analytics.repository.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/repositories/analytics.repository.js#L584-L730) -> `getProductPerformance(...)`.

### 2.3 The Faulty Aggregation Pipeline
In `backend/src/repositories/analytics.repository.js`, after grouping order line items by `productId` and `sku`, the pipeline performed a `$lookup` into the `inventories` collection:
```javascript
{
  $lookup: {
    from: "inventories",
    localField: "productVariantId",
    foreignField: "productVariantId",
    as: "inventoryData",
  },
},
{
  $addFields: {
    currentStock: {
      $ifNull: [{ $sum: "$inventoryData.onHand" }, 0],
    },
    availableStock: {
      $ifNull: [
        {
          $sum: {
            $subtract: [
              "$inventoryData.onHand",
              { $ifNull: ["$inventoryData.reserved", 0] },
            ],
          },
        },
        0,
      ],
    },
  },
}
```

---

## 3. Mathematical & Type Analysis: The Root Cause

### 3.1 MongoDB `$lookup` Semantics
1. MongoDB's `$lookup` stage yields an **Array of Documents** as the target field `inventoryData`.
2. When referencing sub-fields of an array of documents using dot syntax (e.g., `"$inventoryData.onHand"` and `"$inventoryData.reserved"`), MongoDB returns **Arrays of Values**:
   - `"$inventoryData.onHand"` evaluates to `[40, 20]` (or `[]` if no inventory document matches).
   - `"$inventoryData.reserved"` evaluates to `[5, 2]` (or `[]`).

### 3.2 MongoDB `$subtract` Operator Contract
1. According to official MongoDB specifications, `$subtract` accepts strictly an array of **two numeric scalar operands**:
   $$\text{\$subtract: } [ \text{Number}_1, \text{Number}_2 ]$$
2. When passed `"$inventoryData.onHand"` and `"$inventoryData.reserved"`, the expression evaluated to:
   $$\text{\$subtract: } [ [40, 20], [5, 2] ]$$
3. MongoDB does not implement vector or array subtraction across operands. Encountering two arrays as operands immediately causes the query engine to throw:
   ```text
   can't $subtract array from array
   ```

### 3.3 The False `$ifNull` Guard
In `{ $ifNull: ["$inventoryData.reserved", 0] }`, the operand is the array `[5, 2]` or `[]`. In BSON type semantics, an empty array `[]` is **NOT null**; it is an existing BSON Array. Thus, `$ifNull` never evaluated to the scalar `0`, passing the array directly into `$subtract`.

---

## 4. Multi-Warehouse Inventory Schema Requirements

According to [Inventory.js](file:///d:/MERN%20Stack/Buybox-Ecommerce/backend/src/models/Inventory.js#L1-L105):
- An inventory record represents variant stock stored in a specific `warehouseId`.
- Available sellable stock is defined by the virtual:
  $$\text{available} = \max(\text{onHand} - \text{reserved} - (\text{damaged} + \text{defective} + \text{expired}), 0)$$
- A merchant may hold stock across multiple regional fulfillment centers.
- Therefore, the correct calculation requires computing the available stock **per warehouse document** as a scalar, and then summing those scalars across the array.

---

## 5. Secondary Pipeline Deficiencies Identified

1. **Unprotected Null Lookups:**
   If an order item had `productVariantId: null`, MongoDB's `localField: "productVariantId"` with `null` would match any inventory document with `productVariantId: null`. The lookup must use a correlation condition ensuring `$$pvId != null`.
2. **Order Item Level Realization:**
   Multi-item orders can have individual items cancelled (`fulfillmentStatus: "cancelled"`). These items must not be counted as sales.
3. **Cancellation Status Exclusions:**
   Orders with `cancellationStatus: "completed"` must be excluded from realized sales.
4. **Data Type Coercion Safety:**
   `Order` schema fields (`unitPrice`, `discountTotal`, `lineTotal`) are stored as `Decimal128`. In arithmetic aggregations, explicit conversion to double via `$convert` with `onError: 0, onNull: 0` is required to prevent type mismatches.
5. **Dual Contract Parity:**
   The frontend expected `totalStockOnHand` and `totalAvailableStock` while the backend emitted `currentStock` and `availableStock`. Both contracts must be supported simultaneously.
6. **Frontend Error Isolation:**
   In `frontend/src/app/vendor/analytics/page.js`, `Promise.all` in `loadAllData` coupled the overview metrics with product performance. Failure in product performance caused the entire dashboard refresh to fail. `Promise.allSettled` and dedicated inline error handling with a retry button were needed.

---

## 6. Audit Conclusion

The bug is isolated to `backend/src/repositories/analytics.repository.js` lines 659–686. Remediation requires replacing the invalid array subtraction with a scalar-level `$map` + `$subtract` + `$sum` pipeline with full `Decimal128` type conversion safety.

