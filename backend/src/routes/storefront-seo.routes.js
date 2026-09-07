const express = require("express");

const router = express.Router();

const storefrontSeoController = require("../controllers/storefront-seo.controller");

const authenticate = require("../middlewares/authentication.middleware");

const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");

const {
  PERMISSIONS,
} = require("../constants/permissions.constants");

const validate = require("../middlewares/validate.middleware");

const {
  createStorefrontSeoSchema,
  updateStorefrontSeoSchema,
  storefrontSeoIdParamsSchema,
} = require("../validators/cms/storefront-seo.validator");

// Public
router.get(
  "/",
  storefrontSeoController.getActiveSeo
);

// Admin
router.get(
  "/:seoId",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_READ),
  validate(storefrontSeoIdParamsSchema, "params"),
  storefrontSeoController.getSeoById
);

router.post(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(createStorefrontSeoSchema, "body"),
  storefrontSeoController.createSeo
);

router.patch(
  "/:seoId",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(storefrontSeoIdParamsSchema, "params"),
  validate(updateStorefrontSeoSchema, "body"),
  storefrontSeoController.updateSeo
);

module.exports = router;

