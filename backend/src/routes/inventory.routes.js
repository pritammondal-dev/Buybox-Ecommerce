const express = require("express");

const inventoryController = require("../controllers/inventory.controller");
const authenticate = require("../middlewares/authentication.middleware");
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
  requireRoles(ROLES.VENDOR),
  inventoryController.getMyVendorInventory
);

router.get(
  "/summary",
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