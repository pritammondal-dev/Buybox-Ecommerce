const express = require("express");

const inventoryController = require("../controllers/inventory.controller");
const { authenticate, authenticateVendor } = require("../middlewares/authentication.middleware");
const { requireApprovedVendor } = require("../middlewares/vendor.middleware");
const validate = require("../middlewares/validate.middleware");

const {
  requirePermissions,
  requireRoles,
} = require("../middlewares/authorization.middleware");

const {
  PERMISSIONS,
} = require("../constants/permissions.constants");
const { ROLES } = require("../constants/auth.constants");

const {
  createInventorySchema,
} = require("../validators/inventory/create-inventory.validator");

const {
  stockAdjustmentSchema,
} = require("../validators/inventory/stock-adjustment.validator");

const validateObjectId = require("../middlewares/validate-object-id.middleware");

const {
  positiveStockQuantitySchema,
} = require("../validators/inventory/positive-stock-quantity.validator");
const { decodeSecureId } = require("../utils/secure-id.util");
const AppError = require("../errors/AppError");

const resolveInventoryIdParam = (paramName = "id") => {
  return (req, res, next) => {
    try {
      const rawParam = req.params[paramName];
      if (!rawParam) {
        throw new AppError("Inventory ID is required", 400, "INVALID_OBJECT_ID");
      }
      const trimmed = String(rawParam).trim();

      if (/^[a-fA-F0-9]{24}$/.test(trimmed)) {
        req.params[paramName] = trimmed;
        return next();
      }

      if (trimmed.startsWith("inv_")) {
        const decodedId = decodeSecureId(trimmed, "inventory", { strict: false });
        req.params[paramName] = decodedId;
        return next();
      }

      throw new AppError(`Invalid ${paramName}`, 400, "INVALID_OBJECT_ID");
    } catch (err) {
      next(err);
    }
  };
};

const router = express.Router();

router.use(authenticate);

// Vendor-scoped inventory (must precede /:id)
router.get(
  "/vendor/my",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.getMyVendorInventory
);

// 1. Vendor Inbound Goods Receiving
router.get(
  "/vendor/receiving",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.listVendorReceivingRecords
);

router.post(
  "/vendor/receiving",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.createVendorReceivingRecord
);

router.get(
  "/vendor/receiving/:id",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.getVendorReceivingRecord
);

router.post(
  "/vendor/receiving/:id/confirm",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.confirmVendorReceiving
);

router.post(
  "/vendor/receiving/:id/cancel",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.cancelVendorReceiving
);

// 2. Vendor Inter-Warehouse Stock Transfers
router.get(
  "/vendor/transfers",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.listVendorTransfers
);

router.post(
  "/vendor/transfers",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.createVendorTransfer
);

router.get(
  "/vendor/transfers/:id",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.getVendorTransferRecord
);

router.post(
  "/vendor/transfers/:id/dispatch",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.dispatchVendorTransfer
);

router.post(
  "/vendor/transfers/:id/receive",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.receiveVendorTransfer
);

router.post(
  "/vendor/transfers/:id/cancel",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.cancelVendorTransfer
);

// 3. Vendor Controlled Inventory Adjustments
router.post(
  "/vendor/adjustments",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.adjustVendorStock
);

router.patch(
  "/vendor/my/:id/adjust",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.adjustVendorStock
);

// 4. Vendor Stock Movement History
router.get(
  "/vendor/movements",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.getMyVendorMovementHistory
);

// 5. Vendor Reorder Thresholds
router.patch(
  "/vendor/my/:id/threshold",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.updateVendorInventoryThreshold
);

// 6. Vendor Physical Stock Counting & Cycle Audit Routes
router.get(
  "/vendor/counts",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.listVendorStockCounts
);

router.post(
  "/vendor/counts",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.createVendorStockCount
);

router.get(
  "/vendor/counts/:id",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.getVendorStockCount
);

router.post(
  "/vendor/counts/:id/record",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.recordVendorPhysicalCounts
);

router.post(
  "/vendor/counts/:id/submit",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.submitVendorStockCount
);

router.post(
  "/vendor/counts/:id/recount",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.requestVendorRecount
);

router.post(
  "/vendor/counts/:id/approve",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.approveVendorStockCount
);

router.post(
  "/vendor/counts/:id/reject",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.rejectVendorStockCount
);

router.post(
  "/vendor/counts/:id/reconcile",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.reconcileVendorStockCount
);

router.post(
  "/vendor/counts/:id/cancel",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.cancelVendorStockCount
);

router.get(
  "/vendor/counts/:id/export",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.exportVendorStockCount
);

// 7. Vendor Warehouse Analytics, Aging, Turnover & Intelligence
router.get(
  "/vendor/analytics/overview",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.getVendorWarehouseOverview
);

router.get(
  "/vendor/analytics/movements",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.getVendorMovementAnalytics
);

router.get(
  "/vendor/analytics/aging",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.getVendorInventoryAging
);

router.get(
  "/vendor/analytics/turnover",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.getVendorInventoryTurnover
);

router.get(
  "/vendor/analytics/replenishment",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.getVendorDemandAndReplenishment
);

router.get(
  "/vendor/analytics/operations",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.getVendorWarehouseOperations
);

router.get(
  "/vendor/analytics/export",
  authenticateVendor,
  requireApprovedVendor,
  requireRoles(ROLES.VENDOR),
  inventoryController.exportVendorWarehouseAnalytics
);

router.get(
  "/summary",
  requirePermissions(PERMISSIONS.INVENTORY_READ),
  inventoryController.getInventorySummary
);

router.get(
  "/",
  requirePermissions(PERMISSIONS.INVENTORY_READ),
  inventoryController.listAllInventory
);

router.get(
  "/:id",
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.INVENTORY_READ),
  inventoryController.getInventory
);

router.get(
  "/variant/:variantId",
  validateObjectId("variantId"),
  requirePermissions(PERMISSIONS.INVENTORY_READ),
  inventoryController.getVariantInventory
);

router.get(
  "/warehouse/:warehouseId",
  validateObjectId("warehouseId"),
  requirePermissions(PERMISSIONS.INVENTORY_READ),
  inventoryController.getWarehouseInventory
);

router.post(
  "/",
  requirePermissions(PERMISSIONS.INVENTORY_MANAGE),
  validate(createInventorySchema),
  inventoryController.createInventory
);

router.patch(
  "/:id/adjust",
  resolveInventoryIdParam("id"),
  requirePermissions(PERMISSIONS.INVENTORY_MANAGE),
  validate(stockAdjustmentSchema),
  inventoryController.adjustStock
);

router.patch(
  "/:id/reserve",
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.INVENTORY_MANAGE),
  validate(positiveStockQuantitySchema),
  inventoryController.reserveStock
);

router.patch(
  "/:id/release",
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.INVENTORY_MANAGE),
  validate(positiveStockQuantitySchema),
  inventoryController.releaseStock
);

router.patch(
  "/:id/deduct",
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.INVENTORY_MANAGE),
  validate(positiveStockQuantitySchema),
  inventoryController.deductReservedStock
);

router.post(
  "/transfer",
  requirePermissions(PERMISSIONS.INVENTORY_MANAGE),
  inventoryController.transferStock
);

module.exports = router;