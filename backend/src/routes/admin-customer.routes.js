const express = require("express");
const adminCustomerController = require("../controllers/admin-customer.controller");
const authenticate = require("../middlewares/authentication.middleware");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");
const validateObjectId = require("../middlewares/validate-object-id.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  requirePermissions(PERMISSIONS.CUSTOMERS_VIEW),
  adminCustomerController.listCustomers
);

router.get(
  "/:id",
  requirePermissions(PERMISSIONS.CUSTOMERS_VIEW),
  validateObjectId("id"),
  adminCustomerController.getCustomer
);

router.patch(
  "/:id/status",
  requirePermissions(PERMISSIONS.CUSTOMERS_SUSPEND),
  validateObjectId("id"),
  adminCustomerController.updateCustomerStatus
);

module.exports = router;
