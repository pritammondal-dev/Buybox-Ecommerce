const express = require("express");

const cmsPageController = require("../controllers/cms-page.controller");

const authenticate = require("../middlewares/authentication.middleware");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");
const validate = require("../middlewares/validate.middleware");

const {
  createCmsPageSchema,
  updateCmsPageSchema,
  cmsPageIdParamsSchema,
  cmsPageSlugParamsSchema,
  cmsPageListQuerySchema,
} = require("../validators/cms/cms-page.validator");

const { PERMISSIONS } = require("../constants/permissions.constants");

const router = express.Router();

// Public
router.get(
  "/published/:slug",
  validate(cmsPageSlugParamsSchema, "params"),
  cmsPageController.getPublishedPageBySlug
);

// Admin / Manager
router.use(authenticate);

router.get(
  "/",
  requirePermissions(PERMISSIONS.SETTINGS_READ),
  validate(cmsPageListQuerySchema, "query"),
  cmsPageController.listPages
);

router.get(
  "/:pageId",
  requirePermissions(PERMISSIONS.SETTINGS_READ),
  validate(cmsPageIdParamsSchema, "params"),
  cmsPageController.getPageById
);

router.post(
  "/",
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(createCmsPageSchema),
  cmsPageController.createPage
);

router.patch(
  "/:pageId",
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(cmsPageIdParamsSchema, "params"),
  validate(updateCmsPageSchema),
  cmsPageController.updatePage
);

router.patch(
  "/:pageId/publish",
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(cmsPageIdParamsSchema, "params"),
  cmsPageController.publishPage
);

router.patch(
  "/:pageId/unpublish",
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(cmsPageIdParamsSchema, "params"),
  cmsPageController.unpublishPage
);

router.patch(
  "/:pageId/archive",
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(cmsPageIdParamsSchema, "params"),
  cmsPageController.archivePage
);

router.delete(
  "/:pageId",
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(cmsPageIdParamsSchema, "params"),
  cmsPageController.deletePage
);

module.exports = router;