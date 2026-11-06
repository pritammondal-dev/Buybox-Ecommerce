const express = require("express");

const orderController = require("../controllers/order.controller");
const orderFulfillmentController = require("../controllers/order-fulfillment.controller");
const fulfillmentOpsController = require("../controllers/fulfillment-operations.controller");
const orderRecoveryController = require("../controllers/order-recovery.controller");
const {
  authenticate,
  authenticateVendor,
  authenticateGuestOrCustomer,
} = require("../middlewares/authentication.middleware");
const { requireApprovedVendor } = require("../middlewares/vendor.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  requirePermissions,
  requireRoles,
} = require("../middlewares/authorization.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");
const { ROLES } = require("../constants/auth.constants");
const { orderIdSchema } = require("../validators/order/order-id.validator");
const {
  vendorOrderIdSchema,
} = require("../validators/order/vendor-order-id.validator");
const {
  createOrderSchema,
  checkoutQuoteSchema,
} = require("../validators/order/create-order.validator");
const {
  updateAdminOrderStatusSchema,
} = require("../validators/order/admin-order.validator");
const {
  adminOverrideFulfillmentSchema,
} = require("../validators/order/vendor-order.validator");
const {
  checkoutLimiter,
} = require("../middlewares/rate-limiter.middleware");
const storefrontSettingsService = require("../services/storefront-settings.service");
const AppError = require("../errors/AppError");

const router = express.Router();

const enforceGuestCheckoutPolicy = async (req, res, next) => {
  if (req.isGuest) {
    const guestCheckoutEnabled = await storefrontSettingsService.isFeatureEnabled("guestCheckout");
    if (!guestCheckoutEnabled) {
      return next(
        new AppError(
          "Guest checkout is disabled. Please sign in to complete checkout.",
          403,
          "GUEST_CHECKOUT_DISABLED"
        )
      );
    }
  }
  next();
};

// Dedicated Vendor Authenticator for merchant order & fulfillment routes
router.use("/vendor", authenticateVendor);

// Orders and items exports (must precede /:id) - Staff only
router.get(
  "/export",
  authenticate,
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER),
  requirePermissions(PERMISSIONS.ORDERS_READ),
  fulfillmentOpsController.exportOrders
);

router.get(
  "/export/items",
  authenticate,
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER),
  requirePermissions(PERMISSIONS.ORDERS_READ),
  fulfillmentOpsController.exportOrderItems
);

router.get(
  "/vendor/export",
  requirePermissions(PERMISSIONS.ORDERS_READ_OWN),
  fulfillmentOpsController.exportOrders
);

router.get(
  "/vendor/export/items",
  requirePermissions(PERMISSIONS.ORDERS_READ_OWN),
  fulfillmentOpsController.exportOrderItems
);

// Authoritative checkout quote (must precede /:id)
router.post(
  "/quote",
  authenticateGuestOrCustomer,
  enforceGuestCheckoutPolicy,
  checkoutLimiter,
  validate(checkoutQuoteSchema),
  orderController.getCheckoutQuote
);

// Admin order management (must precede /:id)
router.get(
  "/admin",
  authenticate,
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPPORT),
  requirePermissions(PERMISSIONS.ORDERS_READ),
  orderController.getAdminOrders
);

router.get(
  "/admin/:id",
  authenticate,
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.SUPPORT),
  requirePermissions(PERMISSIONS.ORDERS_READ),
  orderController.getAdminOrderById
);

router.post(
  "/admin/:id/cancel",
  authenticate,
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER),
  requirePermissions(PERMISSIONS.ORDERS_MANAGE),
  validate(orderIdSchema, "params"),
  orderController.cancelAdminOrder
);

router.patch(
  "/admin/:id/status",
  authenticate,
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER),
  requirePermissions(PERMISSIONS.ORDERS_MANAGE),
  validate(orderIdSchema, "params"),
  validate(updateAdminOrderStatusSchema),
  orderController.updateAdminOrderStatus
);

router.patch(
  "/admin/:id/override-fulfillment",
  authenticate,
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  requirePermissions(PERMISSIONS.ORDERS_MANAGE),
  validate(orderIdSchema, "params"),
  validate(adminOverrideFulfillmentSchema),
  orderFulfillmentController.adminOverrideFulfillment
);

router.post(
  "/admin/:id/recover-cancellation",
  authenticate,
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  requirePermissions(PERMISSIONS.ORDERS_MANAGE),
  validate(orderIdSchema, "params"),
  orderRecoveryController.recoverOrderCancellation
);

router.post(
  "/admin/refunds/:id/reconcile",
  authenticate,
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  requirePermissions(PERMISSIONS.ORDERS_MANAGE),
  orderRecoveryController.reconcileRefund
);

router.post(
  "/admin/notifications/reconcile-outbox",
  authenticate,
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  requirePermissions(PERMISSIONS.ORDERS_MANAGE),
  orderRecoveryController.reconcileOutbox
);

// Vendor-scoped orders (must precede /:id)
router.get(
  "/vendor/my",
  requirePermissions(PERMISSIONS.ORDERS_READ_OWN),
  orderController.getMyVendorOrders
);

router.get(
  "/vendor/my/:orderId",
  requirePermissions(PERMISSIONS.ORDERS_READ_OWN),
  validate(vendorOrderIdSchema, "params"),
  orderController.getMyVendorOrderById
);

// Link guest order to authenticated customer account
router.post(
  "/link-guest",
  authenticate,
  orderController.linkGuestOrder
);

// Packing slip for order
router.get(
  "/:id/packing-slip",
  authenticate,
  requirePermissions(PERMISSIONS.ORDERS_READ),
  fulfillmentOpsController.getOrderPackingSlip
);

router.get("/", authenticate, orderController.getMyOrders);

router.get(
  "/:id/activity",
  authenticateGuestOrCustomer,
  validate(orderIdSchema, "params"),
  orderController.getOrderActivity
);

router.get(
  "/:id",
  authenticateGuestOrCustomer,
  validate(orderIdSchema, "params"),
  orderController.getMyOrderById
);

router.post(
  "/:id/cancel",
  authenticateGuestOrCustomer,
  validate(orderIdSchema, "params"),
  orderController.cancelOrder
);

router.post(
  "/",
  authenticateGuestOrCustomer,
  enforceGuestCheckoutPolicy,
  checkoutLimiter,
  validate(createOrderSchema),
  orderController.createOrder
);

module.exports = router;
