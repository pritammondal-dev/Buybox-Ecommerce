const express = require("express");
const vendorAuthController = require("../controllers/vendor-auth.controller");
const validate = require("../middlewares/validate.middleware");
const { loginSchema } = require("../validators/auth/login.validator");

const router = express.Router();

router.post(
  "/login",
  validate(loginSchema),
  vendorAuthController.login
);

router.post(
  "/refresh",
  vendorAuthController.refresh
);

router.post(
  "/logout",
  vendorAuthController.logout
);

module.exports = router;
