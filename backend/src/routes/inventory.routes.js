const express = require("express");

const inventoryController = require("../controllers/inventory.controller");
const authenticate = require("../middlewares/authentication.middleware");
const validate = require("../middlewares/validate.middleware");

const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");

const {
  PERMISSIONS,
} = require("../constants/permissions.constants");

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

const router = express.Router();

router.use(authenticate);

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
  validateObjectId("id"),
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

module.exports = router;