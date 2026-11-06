const express = require("express");
const adminCustomerController = require("../controllers/admin-customer.controller");
const authenticate = require("../middlewares/authentication.middleware");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");
const validateObjectId = require("../middlewares/validate-object-id.middleware");
const validate = require("../middlewares/validate.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");
const {
  suspendAccountSchema,
  reactivateAccountSchema,
  updateCustomerStatusSchema,
  resetPasswordSchema,
  deleteAccountSchema,
  updateCustomerAdminSchema,
} = require("../validators/admin/account-management.validator");

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

router.post(
  "/:id/gift-card",
  requirePermissions(PERMISSIONS.CUSTOMERS_EDIT),
  validateObjectId("id"),
  adminCustomerController.issueGiftCard
);

router.patch(
  "/:id",
  requirePermissions(PERMISSIONS.CUSTOMERS_EDIT),
  validateObjectId("id"),
  validate(updateCustomerAdminSchema),
  adminCustomerController.updateCustomer
);

router.patch(
  "/:id/status",
  requirePermissions(PERMISSIONS.CUSTOMERS_SUSPEND),
  validateObjectId("id"),
  validate(updateCustomerStatusSchema),
  adminCustomerController.updateCustomerStatus
);

router.post(
  "/:id/suspend",
  requirePermissions(PERMISSIONS.CUSTOMERS_SUSPEND),
  validateObjectId("id"),
  validate(suspendAccountSchema),
  adminCustomerController.suspendCustomer
);

router.post(
  "/:id/reactivate",
  requirePermissions(PERMISSIONS.CUSTOMERS_SUSPEND),
  validateObjectId("id"),
  validate(reactivateAccountSchema),
  adminCustomerController.reactivateCustomer
);

router.post(
  "/:id/reset-password",
  requirePermissions(PERMISSIONS.CUSTOMERS_RESET_PASSWORD),
  validateObjectId("id"),
  validate(resetPasswordSchema),
  adminCustomerController.resetCustomerPassword
);

router.delete(
  "/:id",
  requirePermissions(PERMISSIONS.CUSTOMERS_DELETE),
  validateObjectId("id"),
  validate(deleteAccountSchema),
  adminCustomerController.deleteCustomer
);

module.exports = router;
