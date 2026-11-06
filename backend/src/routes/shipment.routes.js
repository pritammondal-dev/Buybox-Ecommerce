const express = require("express");

const shipmentController = require("../controllers/shipment.controller");
const fulfillmentOpsController = require("../controllers/fulfillment-operations.controller");

const { authenticate, authenticateVendor } = require("../middlewares/authentication.middleware");

const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");

const validate = require("../middlewares/validate.middleware");

const {
  createShipmentSchema,
} = require("../validators/shipping/create-shipment.validator");

const {
  updateShipmentStatusSchema,
  adminUpdateShipmentStatusSchema,
  vendorUpdateShipmentStatusSchema,
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
const AppError = require("../errors/AppError");

const router = express.Router();

router.use(authenticate);

// Shipments export (must precede /:shipmentId)
router.get(
  "/export",
  requirePermissions(
    PERMISSIONS.SHIPMENTS_READ
  ),
  fulfillmentOpsController.exportShipments
);

router.get(
  "/vendor/export",
  authenticateVendor,
  requirePermissions(
    PERMISSIONS.SHIPMENTS_READ_OWN
  ),
  fulfillmentOpsController.exportShipments
);

/*
 * Public / authenticated serviceability check
 */
router.get("/serviceability", shipmentController.checkServiceability);

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
  "/my/order/:orderId",
  shipmentController.getMyShipmentsByOrderId
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
  authenticateVendor,
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
  authenticateVendor,
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
  authenticateVendor,
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
  authenticateVendor,
  requirePermissions(
    PERMISSIONS.SHIPMENTS_MANAGE_OWN
  ),
  validate(vendorUpdateShipmentStatusSchema),
  shipmentController.transitionVendorShipmentStatus
);
/*
 * Schedule carrier pickup for authenticated vendor
 */
router.post(
  "/vendor/:shipmentId/pickup",
  authenticateVendor,
  requirePermissions(PERMISSIONS.SHIPMENTS_MANAGE_OWN),
  shipmentController.scheduleVendorShipmentPickup
);

/*
 * Retrieve shipping label for authenticated vendor
 */
router.get(
  "/vendor/:shipmentId/label",
  authenticateVendor,
  requirePermissions(PERMISSIONS.SHIPMENTS_READ_OWN),
  shipmentController.getVendorShipmentLabel
);

/*
 * Retrieve packing slip for authenticated vendor
 */
router.get(
  "/vendor/:shipmentId/packing-slip",
  authenticateVendor,
  requirePermissions(PERMISSIONS.SHIPMENTS_READ_OWN),
  fulfillmentOpsController.getShipmentPackingSlip
);
router.get(
  "/vendor/my/:shipmentId/packing-slip",
  authenticateVendor,
  requirePermissions(PERMISSIONS.SHIPMENTS_READ_OWN),
  fulfillmentOpsController.getShipmentPackingSlip
);

/*
 * Cancel shipment for authenticated vendor
 */
router.post(
  "/vendor/:shipmentId/cancel",
  authenticateVendor,
  requirePermissions(PERMISSIONS.SHIPMENTS_MANAGE_OWN),
  shipmentController.cancelVendorShipment
);

/*
 * Book / retry carrier booking for authenticated vendor
 */
router.post(
  "/vendor/:shipmentId/book",
  authenticateVendor,
  requirePermissions(PERMISSIONS.SHIPMENTS_MANAGE_OWN),
  shipmentController.retryVendorCarrierBooking
);
router.post(
  "/vendor/my/:shipmentId/book",
  authenticateVendor,
  requirePermissions(PERMISSIONS.SHIPMENTS_MANAGE_OWN),
  shipmentController.retryVendorCarrierBooking
);

/*
 * Vendor inspect RTO shipment upon return to origin
 */
router.post(
  "/vendor/:shipmentId/rto-inspect",
  authenticateVendor,
  requirePermissions(PERMISSIONS.SHIPMENTS_MANAGE_OWN),
  shipmentController.vendorReceiveAndInspectRtoShipment
);
router.post(
  "/vendor/my/:shipmentId/rto-inspect",
  authenticateVendor,
  requirePermissions(PERMISSIONS.SHIPMENTS_MANAGE_OWN),
  shipmentController.vendorReceiveAndInspectRtoShipment
);

/*
 * ============================================================
 * ADMIN / MANAGER OPERATIONAL RETRIEVAL
 * ============================================================
 */

router.get(
  "/",
  requirePermissions(
    PERMISSIONS.SHIPMENTS_READ
  ),
  shipmentController.listAllShipments
);

router.get(
  "/:shipmentId",
  requirePermissions(
    PERMISSIONS.SHIPMENTS_READ
  ),
  shipmentController.getShipmentById
);

router.get(
  "/:shipmentId/packing-slip",
  requirePermissions(PERMISSIONS.SHIPMENTS_READ),
  fulfillmentOpsController.getShipmentPackingSlip
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
  (req, res, next) => {
    let raw = req.params.shipmentId;
    if (typeof raw === "string" && raw.startsWith("shp_")) {
      try {
        const { decodeSecureId } = require("../utils/secure-id.util");
        raw = decodeSecureId(raw, "shipment", { strict: false });
      } catch {
        return next(
          new AppError(
            "Invalid shipmentId",
            400,
            "INVALID_OBJECT_ID"
          )
        );
      }
    }
    const mongoose = require("mongoose");
    if (!mongoose.isValidObjectId(raw)) {
      return next(
        new AppError(
          "Invalid shipmentId",
          400,
          "INVALID_OBJECT_ID"
        )
      );
    }
    req.params.shipmentId = raw;
    next();
  },
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
  validate(adminUpdateShipmentStatusSchema),
  shipmentController.transitionShipmentStatus
);
/*
 * Admin schedule courier pickup
 */
router.post(
  "/:shipmentId/pickup",
  requirePermissions(PERMISSIONS.SHIPMENTS_MANAGE),
  shipmentController.scheduleShipmentPickup
);

/*
 * Admin generate / retrieve shipping label
 */
router.get(
  "/:shipmentId/label",
  requirePermissions(PERMISSIONS.SHIPMENTS_READ),
  shipmentController.getShipmentLabel
);

/*
 * Admin cancel shipment
 */
router.post(
  "/:shipmentId/cancel",
  requirePermissions(PERMISSIONS.SHIPMENTS_MANAGE),
  shipmentController.cancelShipment
);

/*
 * Admin book / retry carrier booking
 */
router.post(
  "/:shipmentId/book",
  requirePermissions(PERMISSIONS.SHIPMENTS_MANAGE),
  shipmentController.retryCarrierBooking
);

/*
 * Admin inspect RTO shipment upon return to origin
 */
router.post(
  "/:shipmentId/rto-inspect",
  requirePermissions(PERMISSIONS.SHIPMENTS_MANAGE),
  shipmentController.receiveAndInspectRtoShipment
);

module.exports = router;