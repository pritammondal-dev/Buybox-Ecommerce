const express = require("express");
const paymentMethodController = require("../controllers/payment-method.controller");
const authenticate = require("../middlewares/authentication.middleware");
const { requirePermissions } = require("../middlewares/authorization.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");
const validate = require("../middlewares/validate.middleware");

const {
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
  reorderPaymentMethodsSchema,
  availablePaymentMethodsQuerySchema,
} = require("../validators/payment/payment-method.validator");

const router = express.Router();

// Public / Customer endpoint: list eligible active payment methods
router.get(
  "/available",
  validate(availablePaymentMethodsQuerySchema, "query"),
  paymentMethodController.getAvailablePaymentMethods
);

// Customer endpoints strictly require authentication (scoped to authenticated customer)
router.get("/my", authenticate, paymentMethodController.getMyPaymentMethods);
router.post("/my", authenticate, paymentMethodController.saveCustomerPaymentMethod);
router.patch("/my/:id/default", authenticate, paymentMethodController.setDefaultPaymentMethod);
router.delete("/my/:id", authenticate, paymentMethodController.deleteCustomerPaymentMethod);

// Admin endpoints strictly require authentication and PAYMENTS_MANAGE permission
router.use(authenticate);
router.use(requirePermissions(PERMISSIONS.PAYMENTS_MANAGE));

router.get(
  "/",
  paymentMethodController.listAllPaymentMethods
);

router.post(
  "/",
  validate(createPaymentMethodSchema),
  paymentMethodController.createPaymentMethod
);

router.post(
  "/reorder",
  validate(reorderPaymentMethodsSchema),
  paymentMethodController.reorderPaymentMethods
);

router.get(
  "/:id",
  paymentMethodController.getPaymentMethodById
);

router.patch(
  "/:id",
  validate(updatePaymentMethodSchema),
  paymentMethodController.updatePaymentMethod
);

router.patch(
  "/:id/toggle",
  paymentMethodController.togglePaymentMethod
);

router.delete(
  "/:id",
  paymentMethodController.deletePaymentMethod
);

module.exports = router;
