const express = require("express");

const warehouseController = require("../controllers/warehouse.controller");
const authenticate = require("../middlewares/authentication.middleware");
const validate = require("../middlewares/validate.middleware");
const validateObjectId = require("../middlewares/validate-object-id.middleware");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");
const { requireScope } = require("../middlewares/scope.middleware");
const { SCOPE_TYPES } = require("../constants/scope.constants");

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
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.WAREHOUSES_READ),
  requireScope({
    scopeType: SCOPE_TYPES.WAREHOUSE,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
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
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  validate(updateWarehouseSchema),
  requireScope({
    scopeType: SCOPE_TYPES.WAREHOUSE,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  warehouseController.updateWarehouse
);

router.delete(
  "/:id",
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.WAREHOUSES_MANAGE),
  requireScope({
    scopeType: SCOPE_TYPES.WAREHOUSE,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  warehouseController.deleteWarehouse
);

module.exports = router;