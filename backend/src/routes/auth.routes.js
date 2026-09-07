const express = require("express");

const authController = require("../controllers/auth.controller");
const validate = require("../middlewares/validate.middleware");

const { registerSchema } = require("../validators/auth/register.validator");
const { loginSchema } = require("../validators/auth/login.validator");
const {
  refreshSchema,
} = require("../validators/auth/refresh.validator");
const authenticate = require("../middlewares/authentication.middleware");
const {
  passwordResetRequestSchema,
} = require("../validators/auth/password-reset-request.validator");
const {
  passwordResetSchema,
} = require("../validators/auth/password-reset.validator");

const router = express.Router();

router.post(
  "/register",
  validate(registerSchema),
  authController.register
);

router.post(
  "/login",
  validate(loginSchema),
  authController.login
);

router.post(
  "/refresh",
  validate(refreshSchema),
  authController.refresh
);

router.post(
  "/logout",
  validate(refreshSchema),
  authController.logout
);

router.get(
  "/verify-email",
  authController.verifyEmail
);


router.post(
  "/forgot-password",
  validate(passwordResetRequestSchema),
  authController.requestPasswordReset
);

router.post(
  "/reset-password",
  validate(passwordResetSchema),
  authController.resetPassword
);

router.post(
  "/logout-all",
  authenticate,
  authController.logoutAll
);

module.exports = router;