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
  reorderStorefrontSectionsSchema,
  storefrontSectionIdParamsSchema,
  storefrontSectionKeyParamsSchema,
  storefrontSectionProductsQuerySchema,
} = require("../validators/cms/storefront-section.validator");

// Public

router.get(
  "/active",
  storefrontSectionController.getActiveSections
);

router.get(
  "/active/:key/products",
  validate(
    storefrontSectionKeyParamsSchema,
    "params"
  ),
  validate(
    storefrontSectionProductsQuerySchema,
    "query"
  ),
  storefrontSectionController.getSectionProducts
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
  requirePermissions(PERMISSIONS.CMS_VIEW),
  storefrontSectionController.listSections
);

router.post(
  "/initialize-defaults",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_CREATE),
  storefrontSectionController.initializeDefaults
);

router.patch(
  "/reorder",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_EDIT),
  validate(
    reorderStorefrontSectionsSchema,
    "body"
  ),
  storefrontSectionController.reorderSections
);

router.get(
  "/key/:key",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_VIEW),
  validate(
    storefrontSectionKeyParamsSchema,
    "params"
  ),
  storefrontSectionController.getSectionByKey
);

router.get(
  "/:sectionId",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_VIEW),
  validate(
    storefrontSectionIdParamsSchema,
    "params"
  ),
  storefrontSectionController.getSectionById
);

router.get(
  "/:sectionId/products",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_VIEW),
  validate(
    storefrontSectionIdParamsSchema,
    "params"
  ),
  validate(
    storefrontSectionProductsQuerySchema,
    "query"
  ),
  storefrontSectionController.getSectionProducts
);

router.post(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_CREATE),
  validate(
    createStorefrontSectionSchema,
    "body"
  ),
  storefrontSectionController.createSection
);

router.patch(
  "/:sectionId",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_EDIT),
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
  requirePermissions(PERMISSIONS.CMS_DELETE),
  validate(
    storefrontSectionIdParamsSchema,
    "params"
  ),
  storefrontSectionController.deleteSection
);

module.exports = router;