const express = require("express");
const warehouseOpsController = require("../controllers/warehouse-operations.controller");
const authenticate = require("../middlewares/authentication.middleware");
const validateObjectId = require("../middlewares/validate-object-id.middleware");
const { requirePermissions } = require("../middlewares/authorization.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");

const router = express.Router();

router.use(authenticate);

// ==========================================
// 1. STOCK RECEIVING ROUTES
// ==========================================
router.get(
  "/receiving",
  requirePermissions(PERMISSIONS.WAREHOUSES_READ),
  warehouseOpsController.listReceivingRecords
);

router.get(
  "/receiving/:id",
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.WAREHOUSES_READ),
  warehouseOpsController.getReceivingRecord
);

router.post(
  "/receiving",
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  warehouseOpsController.createReceivingRecord
);

router.patch(
  "/receiving/:id",
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  warehouseOpsController.updateReceivingRecord
);

router.post(
  "/receiving/:id/confirm",
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  warehouseOpsController.confirmReceiving
);

router.post(
  "/receiving/:id/cancel",
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  warehouseOpsController.cancelReceiving
);

// ==========================================
// 2. STOCK TRANSFER ROUTES
// ==========================================
router.get(
  "/transfers",
  requirePermissions(PERMISSIONS.INVENTORY_READ),
  warehouseOpsController.listTransfers
);

router.get(
  "/transfers/:id",
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.INVENTORY_READ),
  warehouseOpsController.getTransferRecord
);

router.post(
  "/transfers",
  requirePermissions(PERMISSIONS.INVENTORY_MANAGE),
  warehouseOpsController.createTransfer
);

router.post(
  "/transfers/:id/approve",
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.INVENTORY_MANAGE),
  warehouseOpsController.approveTransfer
);

router.post(
  "/transfers/:id/dispatch",
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.INVENTORY_MANAGE),
  warehouseOpsController.dispatchTransfer
);

router.post(
  "/transfers/:id/receive",
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.INVENTORY_MANAGE),
  warehouseOpsController.receiveTransfer
);

router.post(
  "/transfers/:id/cancel",
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.INVENTORY_MANAGE),
  warehouseOpsController.cancelTransfer
);

// ==========================================
// 3. BIN / LOCATION ROUTES
// ==========================================
router.get(
  "/locations",
  requirePermissions(PERMISSIONS.WAREHOUSES_READ),
  warehouseOpsController.listLocations
);

router.post(
  "/locations",
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  warehouseOpsController.createLocation
);

router.patch(
  "/locations/:id",
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  warehouseOpsController.updateLocation
);

router.post(
  "/locations/:id/assign",
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  warehouseOpsController.assignItemToLocation
);

router.post(
  "/locations/move",
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  warehouseOpsController.moveItemBetweenLocations
);

// ==========================================
// 4. STOCK COUNT / CYCLE COUNT ROUTES
// ==========================================
router.get(
  "/counts",
  requirePermissions(PERMISSIONS.INVENTORY_READ),
  warehouseOpsController.listStockCounts
);

router.get(
  "/counts/:id",
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.INVENTORY_READ),
  warehouseOpsController.getStockCount
);

router.post(
  "/counts",
  requirePermissions(PERMISSIONS.INVENTORY_MANAGE),
  warehouseOpsController.createStockCount
);

router.post(
  "/counts/:id/record",
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.INVENTORY_MANAGE),
  warehouseOpsController.recordPhysicalCounts
);

router.post(
  "/counts/:id/reconcile",
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.INVENTORY_MANAGE),
  warehouseOpsController.reconcileAndFinalizeCount
);

router.post(
  "/counts/:id/cancel",
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.INVENTORY_MANAGE),
  warehouseOpsController.cancelStockCount
);

// ==========================================
// 5. ORDER ALLOCATION ROUTES
// ==========================================
router.get(
  "/allocations/eligible/:productVariantId",
  validateObjectId("productVariantId"),
  requirePermissions(PERMISSIONS.WAREHOUSES_READ),
  warehouseOpsController.getEligibleWarehousesForItem
);

router.post(
  "/allocations/orders/:orderId/reallocate",
  validateObjectId("orderId"),
  requirePermissions(PERMISSIONS.ORDERS_MANAGE),
  warehouseOpsController.reallocateOrderItem
);

// ==========================================
// 6. WAREHOUSE DASHBOARD & REPORTING ROUTES
// ==========================================
router.get(
  "/reports/overview",
  requirePermissions(PERMISSIONS.WAREHOUSES_READ),
  warehouseOpsController.getWarehouseDashboardOverview
);

router.get(
  "/reports/inventory",
  requirePermissions(PERMISSIONS.WAREHOUSES_READ),
  warehouseOpsController.getWarehouseInventoryReport
);

router.get(
  "/reports/movement-history",
  requirePermissions(PERMISSIONS.WAREHOUSES_READ),
  warehouseOpsController.getWarehouseMovementHistory
);

// ==========================================
// 7. WAREHOUSE PICK LISTS & PACKING SLIPS
// ==========================================
const fulfillmentOpsController = require("../controllers/fulfillment-operations.controller");

router.get(
  "/pick-lists",
  requirePermissions(PERMISSIONS.WAREHOUSES_READ),
  fulfillmentOpsController.getPickList
);

router.get(
  "/pick-lists/export",
  requirePermissions(PERMISSIONS.WAREHOUSES_READ),
  fulfillmentOpsController.exportPickList
);

router.get(
  "/packing-slips/order/:orderId",
  validateObjectId("orderId"),
  requirePermissions(PERMISSIONS.WAREHOUSES_READ),
  fulfillmentOpsController.getOrderPackingSlip
);

router.get(
  "/packing-slips/shipment/:shipmentId",
  validateObjectId("shipmentId"),
  requirePermissions(PERMISSIONS.WAREHOUSES_READ),
  fulfillmentOpsController.getShipmentPackingSlip
);

module.exports = router;
