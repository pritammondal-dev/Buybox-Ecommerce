const express = require("express");

const router = express.Router();

const storefrontSettingsController = require("../controllers/storefront-settings.controller");

const authenticate = require("../middlewares/authentication.middleware");

const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");

const {
  PERMISSIONS,
} = require("../constants/permissions.constants");

const validate = require("../middlewares/validate.middleware");

const {
  createStorefrontSettingsSchema,
  updateStorefrontSettingsSchema,
  storefrontSettingsIdParamsSchema,
} = require("../validators/cms/storefront-settings.validator");

// Public
router.get(
  "/",
  storefrontSettingsController.getActiveSettings
);

// Admin
router.get(
  "/:settingsId",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_READ),
  validate(storefrontSettingsIdParamsSchema, "params"),
  storefrontSettingsController.getSettingsById
);

router.post(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(createStorefrontSettingsSchema, "body"),
  storefrontSettingsController.createSettings
);

router.patch(
  "/:settingsId",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(storefrontSettingsIdParamsSchema, "params"),
  validate(updateStorefrontSettingsSchema, "body"),
  storefrontSettingsController.updateSettings
);

module.exports = router;

