const express = require("express");

const orderController = require("../controllers/order.controller");
const authenticate = require("../middlewares/authentication.middleware");
const validate = require("../middlewares/validate.middleware");
const { orderIdSchema } = require("../validators/order/order-id.validator");
const {
  createOrderSchema,
} = require("../validators/order/create-order.validator");

const router = express.Router();

router.use(authenticate);

router.get("/", orderController.getMyOrders);

router.get(
  "/:id",
  validate(orderIdSchema, "params"),
  orderController.getMyOrderById
);

router.post(
  "/",
  validate(createOrderSchema),
  orderController.createOrder
);

module.exports = router;