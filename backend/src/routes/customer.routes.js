const express = require("express");

const customerController = require("../controllers/customer.controller");
const authenticate = require("../middlewares/authentication.middleware");
const validate = require("../middlewares/validate.middleware");

const {
  updateCustomerSchema,
} = require("../validators/customer/update-customer.validator");

const router = express.Router();

router.use(authenticate);

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

module.exports = router;