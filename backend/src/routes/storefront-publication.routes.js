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
  requirePermissions(PERMISSIONS.CMS_VIEW),
  storefrontPublicationController.listPublications
);

router.get(
  "/:publicationId",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_VIEW),
  validate(
    storefrontPublicationIdParamsSchema,
    "params"
  ),
  storefrontPublicationController.getPublicationById
);

router.get(
  "/resource/:resourceType/:resourceId",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_VIEW),
  validate(
    storefrontPublicationResourceParamsSchema,
    "params"
  ),
  storefrontPublicationController.getPublicationByResource
);

router.post(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_PUBLISH),
  validate(
    createStorefrontPublicationSchema,
    "body"
  ),
  storefrontPublicationController.createPublication
);

router.post(
  "/resource/:resourceType/:resourceId/publish",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_PUBLISH),
  validate(
    storefrontPublicationResourceParamsSchema,
    "params"
  ),
  storefrontPublicationController.publishResource
);

router.post(
  "/resource/:resourceType/:resourceId/unpublish",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_PUBLISH),
  validate(
    storefrontPublicationResourceParamsSchema,
    "params"
  ),
  storefrontPublicationController.unpublishResource
);

router.post(
  "/resource/:resourceType/:resourceId/preview",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_PUBLISH),
  validate(
    storefrontPublicationResourceParamsSchema,
    "params"
  ),
  storefrontPublicationController.generatePreview
);

module.exports = router;