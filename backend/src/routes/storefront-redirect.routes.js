const express = require("express");

const router = express.Router();

const storefrontRedirectController = require("../controllers/storefront-redirect.controller");
const authenticate = require("../middlewares/authentication.middleware");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");
const {
  PERMISSIONS,
} = require("../constants/permissions.constants");
const validate = require("../middlewares/validate.middleware");
const {
  createStorefrontRedirectSchema,
  updateStorefrontRedirectSchema,
  storefrontRedirectIdParamsSchema,
} = require("../validators/cms/storefront-redirect.validator");

// Public redirect resolution
router.get(
  "/resolve",
  storefrontRedirectController.getActiveRedirect
);

// Admin
router.get(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_READ),
  storefrontRedirectController.listRedirects
);

router.get(
  "/:redirectId",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_READ),
  validate(
    storefrontRedirectIdParamsSchema,
    "params"
  ),
  storefrontRedirectController.getRedirectById
);

router.post(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(
    createStorefrontRedirectSchema,
    "body"
  ),
  storefrontRedirectController.createRedirect
);

router.patch(
  "/:redirectId",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(
    storefrontRedirectIdParamsSchema,
    "params"
  ),
  validate(
    updateStorefrontRedirectSchema,
    "body"
  ),
  storefrontRedirectController.updateRedirect
);

router.delete(
  "/:redirectId",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(
    storefrontRedirectIdParamsSchema,
    "params"
  ),
  storefrontRedirectController.deleteRedirect
);

module.exports = router;
