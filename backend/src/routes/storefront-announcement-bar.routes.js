const express = require("express");

const router = express.Router();

const storefrontAnnouncementBarController = require("../controllers/storefront-announcement-bar.controller");

const authenticate = require("../middlewares/authentication.middleware");

const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");

const {
  PERMISSIONS,
} = require("../constants/permissions.constants");

const validate = require("../middlewares/validate.middleware");

const {
  createStorefrontAnnouncementBarSchema,
  updateStorefrontAnnouncementBarSchema,
  storefrontAnnouncementBarIdParamsSchema,
} = require("../validators/cms/storefront-announcement-bar.validator");

// Public

router.get(
  "/active",
  storefrontAnnouncementBarController.getActiveAnnouncementBars
);

// Admin

router.get(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_VIEW),
  storefrontAnnouncementBarController.listAnnouncementBars
);

router.get(
  "/:barId",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_VIEW),
  validate(
    storefrontAnnouncementBarIdParamsSchema,
    "params"
  ),
  storefrontAnnouncementBarController.getAnnouncementBarById
);

router.post(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_CREATE),
  validate(
    createStorefrontAnnouncementBarSchema,
    "body"
  ),
  storefrontAnnouncementBarController.createAnnouncementBar
);

router.patch(
  "/:barId",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_EDIT),
  validate(
    storefrontAnnouncementBarIdParamsSchema,
    "params"
  ),
  validate(
    updateStorefrontAnnouncementBarSchema,
    "body"
  ),
  storefrontAnnouncementBarController.updateAnnouncementBar
);

router.delete(
  "/:barId",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_DELETE),
  validate(
    storefrontAnnouncementBarIdParamsSchema,
    "params"
  ),
  storefrontAnnouncementBarController.deleteAnnouncementBar
);

module.exports = router;