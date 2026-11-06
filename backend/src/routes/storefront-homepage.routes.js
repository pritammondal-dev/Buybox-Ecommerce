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
  requirePermissions(PERMISSIONS.CMS_VIEW),
  storefrontHomepageController.listHomepages
);

router.get(
  "/key/:key",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_VIEW),
  validate(
    storefrontHomepageKeyParamsSchema,
    "params"
  ),
  storefrontHomepageController.getHomepageByKey
);

router.get(
  "/:homepageId",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_VIEW),
  validate(
    storefrontHomepageIdParamsSchema,
    "params"
  ),
  storefrontHomepageController.getHomepageById
);

router.post(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_CREATE),
  validate(
    createStorefrontHomepageSchema,
    "body"
  ),
  storefrontHomepageController.createHomepage
);

router.patch(
  "/:homepageId",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_EDIT),
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
  requirePermissions(PERMISSIONS.CMS_DELETE),
  validate(
    storefrontHomepageIdParamsSchema,
    "params"
  ),
  storefrontHomepageController.deleteHomepage
);

module.exports = router;