const express = require("express");

const warehouseController = require("../controllers/warehouse.controller");
const authenticate = require("../middlewares/authentication.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");

const {
  PERMISSIONS,
} = require("../constants/permissions.constants");

const {
  createWarehouseSchema,
} = require("../validators/warehouse/create-warehouse.validator");

const {
  updateWarehouseSchema,
} = require("../validators/warehouse/update-warehouse.validator");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  requirePermissions(PERMISSIONS.WAREHOUSES_READ),
  warehouseController.listWarehouses
);

router.get(
  "/:id",
  requirePermissions(PERMISSIONS.WAREHOUSES_READ),
  warehouseController.getWarehouse
);

router.post(
  "/",
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  validate(createWarehouseSchema),
  warehouseController.createWarehouse
);

router.patch(
  "/:id",
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  validate(updateWarehouseSchema),
  warehouseController.updateWarehouse
);

router.delete(
  "/:id",
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  warehouseController.deleteWarehouse
);

module.exports = router;