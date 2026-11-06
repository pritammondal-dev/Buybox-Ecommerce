const express = require("express");

const router = express.Router();

const storefrontSettingsController = require("../controllers/storefront-settings.controller");
const authenticate = require("../middlewares/authentication.middleware");
const {
  requirePermissions,
  requireRoles,
} = require("../middlewares/authorization.middleware");
const {
  PERMISSIONS,
} = require("../constants/permissions.constants");
const { ROLES } = require("../constants/auth.constants");
const validate = require("../middlewares/validate.middleware");
const {
  updateStorefrontSettingsSchema,
  updateFeatureFlagsSchema,
} = require("../validators/cms/storefront-settings.validator");

// Public/Read active platform settings
router.get(
  "/",
  storefrontSettingsController.getActiveSettings
);

// Protected Admin / Superadmin Management Endpoints
router.use(authenticate);

// Update active platform settings directly
router.put(
  "/",
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(updateStorefrontSettingsSchema, "body"),
  storefrontSettingsController.updateActiveSettings
);

router.patch(
  "/",
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(updateStorefrontSettingsSchema, "body"),
  storefrontSettingsController.updateActiveSettings
);

// Update feature flags directly - Superadmin only
router.patch(
  "/feature-flags",
  requireRoles(ROLES.SUPER_ADMIN),
  validate(updateFeatureFlagsSchema, "body"),
  storefrontSettingsController.updateFeatureFlags
);

module.exports = router;
