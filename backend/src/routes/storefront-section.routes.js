const express = require("express");

const router = express.Router();

const storefrontSectionController = require("../controllers/storefront-section.controller");

const authenticate = require("../middlewares/authentication.middleware");

const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");

const {
  PERMISSIONS,
} = require("../constants/permissions.constants");

const validate = require("../middlewares/validate.middleware");

const {
  createStorefrontSectionSchema,
  updateStorefrontSectionSchema,
  storefrontSectionIdParamsSchema,
  storefrontSectionKeyParamsSchema,
} = require("../validators/cms/storefront-section.validator");

// Public

router.get(
  "/active",
  storefrontSectionController.getActiveSections
);

router.get(
  "/active/:key",
  validate(
    storefrontSectionKeyParamsSchema,
    "params"
  ),
  storefrontSectionController.getActiveSection
);

// Admin

router.get(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_READ),
  storefrontSectionController.listSections
);

router.get(
  "/key/:key",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_READ),
  validate(
    storefrontSectionKeyParamsSchema,
    "params"
  ),
  storefrontSectionController.getSectionByKey
);

router.get(
  "/:sectionId",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_READ),
  validate(
    storefrontSectionIdParamsSchema,
    "params"
  ),
  storefrontSectionController.getSectionById
);

router.post(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(
    createStorefrontSectionSchema,
    "body"
  ),
  storefrontSectionController.createSection
);

router.patch(
  "/:sectionId",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(
    storefrontSectionIdParamsSchema,
    "params"
  ),
  validate(
    updateStorefrontSectionSchema,
    "body"
  ),
  storefrontSectionController.updateSection
);

router.delete(
  "/:sectionId",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(
    storefrontSectionIdParamsSchema,
    "params"
  ),
  storefrontSectionController.deleteSection
);

module.exports = router;