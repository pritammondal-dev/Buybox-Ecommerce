const express = require("express");

const orderController = require("../controllers/order.controller");
const authenticate = require("../middlewares/authentication.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");
const { orderIdSchema } = require("../validators/order/order-id.validator");
const {
  vendorOrderIdSchema,
} = require("../validators/order/vendor-order-id.validator");
const {
  createOrderSchema,
} = require("../validators/order/create-order.validator");

const router = express.Router();

router.use(authenticate);

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

router.get("/", orderController.getMyOrders);

router.get(
  "/:id",
  validate(orderIdSchema, "params"),
  orderController.getMyOrderById
);


router.post(
  "/:id/cancel",
  validate(orderIdSchema, "params"),
  orderController.cancelOrder
);

router.post(
  "/",
  validate(createOrderSchema),
  orderController.createOrder
);

module.exports = router;

