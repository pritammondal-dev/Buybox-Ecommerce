const express = require("express");
const controller = require("../controllers/admin-authentication-policy.controller");
const validate = require("../middlewares/validate.middleware");
const {
  updateAuthenticationPolicySchema,
} = require("../validators/auth/authentication-policy.validator");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");
const {
  authenticateAdministrator,
} = require("../middlewares/authentication.middleware");

const router = express.Router();

// Defense in depth: strictly enforce administrator token context
router.use(authenticateAdministrator);

// GET /api/v1/admin/authentication/login-methods
router.get(
  "/login-methods",
  requirePermissions(PERMISSIONS.AUTHENTICATION_LOGIN_METHODS_READ),
  controller.getLoginMethods
);

// PATCH /api/v1/admin/authentication/login-methods
router.patch(
  "/login-methods",
  requirePermissions(PERMISSIONS.AUTHENTICATION_LOGIN_METHODS_MANAGE),
  validate(updateAuthenticationPolicySchema),
  controller.updateLoginMethods
);

module.exports = router;
