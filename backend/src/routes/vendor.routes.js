const express = require("express");

const vendorController = require("../controllers/vendor.controller");
const orderController = require("../controllers/order.controller");
const shipmentController = require("../controllers/shipment.controller");
const returnRequestController = require("../controllers/return-request.controller");
const vendorSettlementController = require("../controllers/vendor-settlement.controller");
const authenticate = require("../middlewares/authentication.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  requirePermissions,
  requireRoles,
} = require("../middlewares/authorization.middleware");

const AppError = require("../errors/AppError");
const { decodeSecureId } = require("../utils/secure-id.util");
const { requireScope } = require("../middlewares/scope.middleware");
const { SCOPE_TYPES } = require("../constants/scope.constants");
const { authRegistrationLimiter } = require("../middlewares/rate-limiter.middleware");

const {
  registerVendorSchema,
} = require("../validators/vendor/register-vendor.validator");

const {
  createVendorSchema,
} = require("../validators/vendor/create-vendor.validator");

const {
  updateVendorSchema,
} = require("../validators/vendor/update-vendor.validator");

const {
  updateVendorStatusSchema,
} = require("../validators/vendor/update-vendor-status.validator");

const {
  rejectVendorSchema,
  requestChangesSchema,
  listVendorsQuerySchema,
} = require("../validators/vendor/review-vendor.validator");

const {
  vendorOrderIdSchema,
} = require("../validators/order/vendor-order-id.validator");
const {
  vendorOrderTransitionSchema,
  vendorOrderQuerySchema,
  createVendorOrderShipmentSchema,
} = require("../validators/order/vendor-order.validator");
const {
  rejectReturnSchema,
  restockReturnSchema,
  returnActionNotesSchema,
} = require("../validators/order/return-request.validator");

const {
  PERMISSIONS,
} = require("../constants/permissions.constants");

const { ROLES } = require("../constants/auth.constants");

const router = express.Router();

/**
 * Middleware to resolve either secure ID (ven_...) or raw 24-hex ObjectId.
 * In strict mode, raw 24-hex identifiers are rejected with RAW_IDENTIFIER_DISALLOWED.
 */
const resolveVendorIdParam = (paramName = "id", { strict = false } = {}) => {
  return (req, res, next) => {
    try {
      const rawParam = req.params[paramName];
      if (!rawParam) {
        throw new AppError("Vendor ID is required", 400, "INVALID_OBJECT_ID");
      }
      const trimmed = String(rawParam).trim();

      // Check if it's a 24-hex ObjectId
      if (/^[a-fA-F0-9]{24}$/.test(trimmed)) {
        if (strict) {
          throw new AppError(
            "Raw database identifiers are disallowed on this endpoint. Encrypted secure identifier required.",
            400,
            "RAW_IDENTIFIER_DISALLOWED"
          );
        }
        req.params[`original_${paramName}`] = rawParam;
        req.params[paramName] = trimmed;
        return next();
      }

      // Check if it starts with ven_
      if (trimmed.startsWith("ven_")) {
        const decodedId = decodeSecureId(trimmed, "vendor", { strict: false });
        req.params[`original_${paramName}`] = rawParam;
        req.params[paramName] = decodedId;
        return next();
      }

      // Neither valid ObjectId nor valid ven_ secure ID
      throw new AppError(`Invalid ${paramName}`, 400, "INVALID_OBJECT_ID");
    } catch (err) {
      next(err);
    }
  };
};

/*
 * Public Vendor Onboarding Registration
 */
router.post(
  "/register",
  authRegistrationLimiter,
  validate(registerVendorSchema),
  vendorController.registerVendor
);

router.use(authenticate);

const {
  requireApprovedVendor,
} = require("../middlewares/vendor.middleware");

/*
 * Vendor self-service
 */

router.get(
  "/me/dashboard",
  requireApprovedVendor,
  vendorController.getDashboardAnalytics
);

router.get(
  "/me/activity",
  requireApprovedVendor,
  vendorController.getActivityLogs
);

/*
 * Vendor Orders & Fulfillment
 */
router.get(
  "/me/orders",
  requireApprovedVendor,
  validate(vendorOrderQuerySchema, "query"),
  orderController.getMyVendorOrders
);

router.get(
  "/me/orders/:orderId",
  requireApprovedVendor,
  validate(vendorOrderIdSchema, "params"),
  orderController.getMyVendorOrderById
);

router.post(
  "/me/orders/:orderId/process",
  requireApprovedVendor,
  validate(vendorOrderIdSchema, "params"),
  (req, res, next) => {
    req.body.action = "process";
    next();
  },
  orderController.transitionVendorOrderStatus
);

router.post(
  "/me/orders/:orderId/ready-to-ship",
  requireApprovedVendor,
  validate(vendorOrderIdSchema, "params"),
  (req, res, next) => {
    req.body.action = "ready_to_ship";
    next();
  },
  orderController.transitionVendorOrderStatus
);

router.post(
  "/me/orders/:orderId/transition",
  requireApprovedVendor,
  validate(vendorOrderIdSchema, "params"),
  validate(vendorOrderTransitionSchema),
  orderController.transitionVendorOrderStatus
);

router.post(
  "/me/orders/:orderId/shipments",
  requireApprovedVendor,
  validate(vendorOrderIdSchema, "params"),
  validate(createVendorOrderShipmentSchema),
  (req, res, next) => {
    req.body.orderId = req.params.orderId;
    next();
  },
  shipmentController.createVendorShipment
);

/*
 * Vendor Returns Lifecycle
 */
router.get(
  "/me/returns",
  requireApprovedVendor,
  returnRequestController.getMyVendorReturns
);

router.get(
  "/me/returns/:returnId",
  requireApprovedVendor,
  returnRequestController.getMyVendorReturnById
);

router.post(
  "/me/returns/:returnId/approve",
  requireApprovedVendor,
  validate(returnActionNotesSchema),
  returnRequestController.approveReturn
);

router.post(
  "/me/returns/:returnId/reject",
  requireApprovedVendor,
  validate(rejectReturnSchema),
  returnRequestController.rejectReturn
);

router.post(
  "/me/returns/:returnId/receive",
  requireApprovedVendor,
  validate(restockReturnSchema),
  returnRequestController.receiveReturn
);

router.post(
  "/me/returns/:returnId/refund",
  requireApprovedVendor,
  validate(returnActionNotesSchema),
  returnRequestController.refundReturn
);

/*
 * Vendor Finance & Settlements
 */
router.get(
  "/me/finance",
  requireApprovedVendor,
  vendorSettlementController.getVendorFinanceSummary
);

router.get(
  "/me/settlements",
  requireApprovedVendor,
  vendorSettlementController.getMyVendorSettlements
);

router.get(
  "/me/settlements/:settlementId",
  requireApprovedVendor,
  vendorSettlementController.getMyVendorSettlementById
);

router.get(
  "/me",
  requireRoles(ROLES.VENDOR),
  vendorController.getMyProfile
);

router.post(
  "/me",
  requireRoles(ROLES.VENDOR),
  validate(createVendorSchema),
  vendorController.createMyProfile
);

router.patch(
  "/me",
  requireRoles(ROLES.VENDOR),
  validate(updateVendorSchema),
  vendorController.updateMyProfile
);

router.post(
  "/me/resubmit",
  requireRoles(ROLES.VENDOR),
  vendorController.resubmitApplication
);

/*
 * Admin/vendor management & review workflow
 */

router.get(
  "/",
  requirePermissions(PERMISSIONS.VENDORS_READ),
  validate(listVendorsQuerySchema, "query"),
  vendorController.listVendors
);

router.get(
  "/:id",
  resolveVendorIdParam("id", { strict: false }),
  requirePermissions(PERMISSIONS.VENDORS_READ),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  vendorController.getVendor
);

router.patch(
  "/:id/status",
  resolveVendorIdParam("id", { strict: false }),
  requirePermissions(PERMISSIONS.VENDORS_MANAGE),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  validate(updateVendorStatusSchema),
  vendorController.updateVendorStatus
);

router.post(
  "/:id/approve",
  resolveVendorIdParam("id", { strict: true }),
  requirePermissions(PERMISSIONS.VENDORS_MANAGE),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  vendorController.approveVendor
);

router.post(
  "/:id/reject",
  resolveVendorIdParam("id", { strict: true }),
  requirePermissions(PERMISSIONS.VENDORS_MANAGE),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  validate(rejectVendorSchema),
  vendorController.rejectVendor
);

router.post(
  "/:id/request-changes",
  resolveVendorIdParam("id", { strict: true }),
  requirePermissions(PERMISSIONS.VENDORS_MANAGE),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  validate(requestChangesSchema),
  vendorController.requestChanges
);

module.exports = router;