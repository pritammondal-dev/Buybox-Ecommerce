const express = require("express");

const customerController = require("../controllers/customer.controller");
const { authenticateCustomer } = require("../middlewares/authentication.middleware");
const validate = require("../middlewares/validate.middleware");

const {
  updateCustomerSchema,
} = require("../validators/customer/update-customer.validator");
const {
  deleteCustomerAccountSchema,
} = require("../validators/customer/delete-account.validator");

const router = express.Router();

router.use(authenticateCustomer);

router.get(
  "/me",
  customerController.getMyProfile
);

router.post(
  "/me",
  validate(updateCustomerSchema),
  customerController.createMyProfile
);

router.patch(
  "/me",
  validate(updateCustomerSchema),
  customerController.updateMyProfile
);

router.delete(
  "/account",
  validate(deleteCustomerAccountSchema),
  customerController.deleteMyAccount
);

router.delete(
  "/me",
  validate(deleteCustomerAccountSchema),
  customerController.deleteMyAccount
);

module.exports = router;