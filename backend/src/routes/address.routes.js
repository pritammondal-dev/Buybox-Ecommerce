const express = require("express");

const addressController = require("../controllers/address.controller");
const authenticate = require("../middlewares/authentication.middleware");
const validate = require("../middlewares/validate.middleware");

const {
  createAddressSchema,
} = require("../validators/address/create-address.validator");

const {
  updateAddressSchema,
} = require("../validators/address/update-address.validator");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  addressController.getAddresses
);

router.get(
  "/:id",
  addressController.getAddress
);

router.post(
  "/",
  validate(createAddressSchema),
  addressController.createAddress
);

router.patch(
  "/:id",
  validate(updateAddressSchema),
  addressController.updateAddress
);

router.delete(
  "/:id",
  addressController.deleteAddress
);

module.exports = router;