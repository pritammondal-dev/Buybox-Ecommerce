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
  orderIdSchema,
} = require("../validators/order/order-id.validator");

const {
  PERMISSIONS,
} = require("../constants/permissions.constants");

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
  validate(orderIdSchema, "params"),
  shipmentController.getShipmentsByOrderId
);

router.get(
  "/vendor/:vendorId",
  requirePermissions(
    PERMISSIONS.SHIPMENTS_READ
  ),
  shipmentController.getShipmentsByVendorId
);

router.get(
  "/warehouse/:warehouseId",
  requirePermissions(
    PERMISSIONS.SHIPMENTS_READ
  ),
  shipmentController.getShipmentsByWarehouseId
);

router.get(
  "/tracking/:trackingNumber",
  requirePermissions(
    PERMISSIONS.SHIPMENTS_READ
  ),
  shipmentController.getShipmentByTrackingNumber
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
  shipmentController.createShipment
);

/*
 * Admin / manager shipment lifecycle management.
 */
router.patch(
  "/:shipmentId/status",
  requirePermissions(
    PERMISSIONS.SHIPMENTS_MANAGE
  ),
  validate(updateShipmentStatusSchema),
  shipmentController.transitionShipmentStatus
);

module.exports = router;