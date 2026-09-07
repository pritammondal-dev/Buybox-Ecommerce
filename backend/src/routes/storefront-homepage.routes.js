const express = require("express");

const router = express.Router();

const storefrontHomepageController = require("../controllers/storefront-homepage.controller");

const authenticate = require("../middlewares/authentication.middleware");

const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");

const {
  PERMISSIONS,
} = require("../constants/permissions.constants");

const validate = require("../middlewares/validate.middleware");

const {
  createStorefrontHomepageSchema,
  updateStorefrontHomepageSchema,
  storefrontHomepageIdParamsSchema,
  storefrontHomepageKeyParamsSchema,
} = require("../validators/cms/storefront-homepage.validator");

// Public

router.get(
  "/active/:key",
  validate(
    storefrontHomepageKeyParamsSchema,
    "params"
  ),
  storefrontHomepageController.getActiveHomepage
);

// Admin

router.get(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_READ),
  storefrontHomepageController.listHomepages
);

router.get(
  "/key/:key",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_READ),
  validate(
    storefrontHomepageKeyParamsSchema,
    "params"
  ),
  storefrontHomepageController.getHomepageByKey
);

router.get(
  "/:homepageId",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_READ),
  validate(
    storefrontHomepageIdParamsSchema,
    "params"
  ),
  storefrontHomepageController.getHomepageById
);

router.post(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(
    createStorefrontHomepageSchema,
    "body"
  ),
  storefrontHomepageController.createHomepage
);

router.patch(
  "/:homepageId",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(
    storefrontHomepageIdParamsSchema,
    "params"
  ),
  validate(
    updateStorefrontHomepageSchema,
    "body"
  ),
  storefrontHomepageController.updateHomepage
);

router.delete(
  "/:homepageId",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(
    storefrontHomepageIdParamsSchema,
    "params"
  ),
  storefrontHomepageController.deleteHomepage
);

module.exports = router;