const express = require("express");

const shipmentController = require("../controllers/shipment.controller");

const authenticate = require("../middlewares/authentication.middleware");

const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");

const validate = require("../middlewares/validate.middleware");

const {
  createShipmentSchema,
} = require("../validators/shipping/create-shipment.validator");

const {
  updateShipmentStatusSchema,
} = require("../validators/shipping/update-shipment-status.validator");

const {
  shipmentOrderIdSchema,
} = require("../validators/shipping/shipment-order-id.validator");

const {
  PERMISSIONS,
} = require("../constants/permissions.constants");

const validateObjectId = require("../middlewares/validate-object-id.middleware");
const { requireScope } = require("../middlewares/scope.middleware");
const { SCOPE_TYPES } = require("../constants/scope.constants");
const { resolveShipmentScope } = require("../services/scope-authorization.service");

const router = express.Router();

router.use(authenticate);

/*
 * ============================================================
 * CUSTOMER SELF-SERVICE
 * ============================================================
 */

router.get(
  "/my",
  shipmentController.getMyShipments
);

router.get(
  "/my/:shipmentId",
  shipmentController.getMyShipmentById
);

router.get(
  "/tracking/:trackingNumber",
  shipmentController.getShipmentByTrackingNumber
);

/*
 * ============================================================
 * VENDOR SELF-SERVICE
 * ============================================================
 *
 * Vendor ownership is enforced inside the service layer.
 * The controller receives the authenticated User ID and
 * resolves it to the corresponding Vendor profile.
 */

/*
 * List shipments belonging to the authenticated vendor.
 */
router.get(
  "/vendor/my",
  requirePermissions(
    PERMISSIONS.SHIPMENTS_READ_OWN
  ),
  shipmentController.getMyVendorShipments
);

/*
 * Retrieve one shipment belonging to the authenticated vendor.
 */
router.get(
  "/vendor/my/:shipmentId",
  requirePermissions(
    PERMISSIONS.SHIPMENTS_READ_OWN
  ),
  shipmentController.getMyVendorShipmentById
);

/*
 * Create a shipment for the authenticated vendor.
 */
router.post(
  "/vendor",
  requirePermissions(
    PERMISSIONS.SHIPMENTS_MANAGE_OWN
  ),
  validate(createShipmentSchema),
  shipmentController.createVendorShipment
);

/*
 * Update shipment status for the authenticated vendor.
 */
router.patch(
  "/vendor/:shipmentId/status",
  requirePermissions(
    PERMISSIONS.SHIPMENTS_MANAGE_OWN
  ),
  validate(updateShipmentStatusSchema),
  shipmentController.transitionVendorShipmentStatus
);

/*
 * ============================================================
 * ADMIN / MANAGER OPERATIONAL RETRIEVAL
 * ============================================================
 */

router.get(
  "/:shipmentId",
  requirePermissions(
    PERMISSIONS.SHIPMENTS_READ
  ),
  shipmentController.getShipmentById
);

router.get(
  "/order/:orderId",
  requirePermissions(
    PERMISSIONS.SHIPMENTS_READ
  ),
  validate(shipmentOrderIdSchema, "params"),
  shipmentController.getShipmentsByOrderId
);

router.get(
  "/vendor/:vendorId",
  validateObjectId("vendorId"),
  requirePermissions(
    PERMISSIONS.SHIPMENTS_READ
  ),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.vendorId",
    allowGlobalPlatformActor: true,
  }),
  shipmentController.getShipmentsByVendorId
);

router.get(
  "/warehouse/:warehouseId",
  validateObjectId("warehouseId"),
  requirePermissions(
    PERMISSIONS.SHIPMENTS_READ
  ),
  requireScope({
    scopeType: SCOPE_TYPES.WAREHOUSE,
    resolveScopeId: "params.warehouseId",
    allowGlobalPlatformActor: true,
  }),
  shipmentController.getShipmentsByWarehouseId
);


/*
 * ============================================================
 * ADMIN / MANAGER SHIPMENT CREATION
 * ============================================================
 *
 * These controllers intentionally do NOT pass a vendor userId.
 * Admins/managers can create operational shipments without
 * having a Vendor profile.
 */

router.post(
  "/",
  requirePermissions(
    PERMISSIONS.SHIPMENTS_MANAGE
  ),
  validate(createShipmentSchema),
  requireScope({
    scopeType: SCOPE_TYPES.WAREHOUSE,
    resolveScopeId: "body.warehouseId",
    allowGlobalPlatformActor: true,
  }),
  shipmentController.createShipment
);

/*
 * Admin / manager shipment lifecycle management.
 */
router.patch(
  "/:shipmentId/status",
  validateObjectId("shipmentId"),
  requirePermissions(
    PERMISSIONS.SHIPMENTS_MANAGE
  ),
  requireScope({
    scopeType: SCOPE_TYPES.WAREHOUSE,
    resolveScopeId: async (req) => {
      const scope = await resolveShipmentScope(req.params.shipmentId);
      return scope ? scope.warehouseId : null;
    },
    allowGlobalPlatformActor: true,
  }),
  validate(updateShipmentStatusSchema),
  shipmentController.transitionShipmentStatus
);

module.exports = router;