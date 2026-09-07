const express = require("express");

const router = express.Router();

const storefrontPublicationController = require("../controllers/storefront-publication.controller");

const authenticate = require("../middlewares/authentication.middleware");

const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");

const {
  PERMISSIONS,
} = require("../constants/permissions.constants");

const validate = require("../middlewares/validate.middleware");

const {
  createStorefrontPublicationSchema,
  storefrontPublicationIdParamsSchema,
  storefrontPublicationResourceParamsSchema,
  storefrontPreviewTokenParamsSchema,
} = require("../validators/cms/storefront-publication.validator");

// Public preview

router.get(
  "/preview/:previewToken",
  validate(
    storefrontPreviewTokenParamsSchema,
    "params"
  ),
  storefrontPublicationController.getPreviewByToken
);

// Admin

router.get(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_READ),
  storefrontPublicationController.listPublications
);

router.get(
  "/:publicationId",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_READ),
  validate(
    storefrontPublicationIdParamsSchema,
    "params"
  ),
  storefrontPublicationController.getPublicationById
);

router.get(
  "/resource/:resourceType/:resourceId",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_READ),
  validate(
    storefrontPublicationResourceParamsSchema,
    "params"
  ),
  storefrontPublicationController.getPublicationByResource
);

router.post(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(
    createStorefrontPublicationSchema,
    "body"
  ),
  storefrontPublicationController.createPublication
);

router.post(
  "/resource/:resourceType/:resourceId/publish",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(
    storefrontPublicationResourceParamsSchema,
    "params"
  ),
  storefrontPublicationController.publishResource
);

router.post(
  "/resource/:resourceType/:resourceId/unpublish",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(
    storefrontPublicationResourceParamsSchema,
    "params"
  ),
  storefrontPublicationController.unpublishResource
);

router.post(
  "/resource/:resourceType/:resourceId/preview",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(
    storefrontPublicationResourceParamsSchema,
    "params"
  ),
  storefrontPublicationController.generatePreview
);

module.exports = router;