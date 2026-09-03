const express = require("express");

const authController = require("../controllers/auth.controller");
const validate = require("../middlewares/validate.middleware");

const { registerSchema } = require("../validators/auth/register.validator");
const { loginSchema } = require("../validators/auth/login.validator");
const {
  refreshSchema,
} = require("../validators/auth/refresh.validator");
const authenticate = require("../middlewares/authentication.middleware");

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

router.post(
  "/logout-all",
  authenticate,
  authController.logoutAll
);

module.exports = router;