const express = require("express");
const administratorAuthController = require("../controllers/administrator-auth.controller");
const validate = require("../middlewares/validate.middleware");
const { loginSchema } = require("../validators/auth/login.validator");
const { authenticateAdministrator } = require("../middlewares/authentication.middleware");
const AppError = require("../errors/AppError");

const router = express.Router();

// Strict security: Zero public administrator registration
router.all("/register", (req, res, next) => {
  next(
    new AppError(
      "Public administrator registration is prohibited. Staff accounts must be provisioned by a Superadmin.",
      404,
      "ENDPOINT_NOT_FOUND"
    )
  );
});

router.post(
  "/login",
  validate(loginSchema),
  administratorAuthController.login
);

router.post(
  "/refresh",
  administratorAuthController.refresh
);

router.post(
  "/logout",
  administratorAuthController.logout
);

router.get(
  "/me",
  authenticateAdministrator,
  administratorAuthController.getMe
);

module.exports = router;
