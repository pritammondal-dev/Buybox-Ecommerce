const express = require("express");
const specialEventPageController = require("../controllers/special-event-page.controller");
const authenticate = require("../middlewares/authentication.middleware");
const { authenticateOptional } = authenticate;
const { requirePermissions } = require("../middlewares/authorization.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  createSpecialEventPageSchema,
  updateSpecialEventPageSchema,
  specialEventPageIdParamsSchema,
  specialEventPageSlugParamsSchema,
  specialEventPageListQuerySchema,
} = require("../validators/cms/special-event-page.validator");
const { PERMISSIONS } = require("../constants/permissions.constants");

const router = express.Router();

// ==========================================
// Public Storefront Endpoints
// ==========================================

router.get("/public/active", specialEventPageController.getActiveEvents);

router.get(
  "/public/:slug",
  authenticateOptional,
  validate(specialEventPageSlugParamsSchema, "params"),
  specialEventPageController.getPublicPageBySlug
);

// ==========================================
// Authenticated Admin / CMS Management
// ==========================================

router.use(authenticate);

router.get(
  "/",
  requirePermissions(PERMISSIONS.CMS_EVENTS_VIEW),
  validate(specialEventPageListQuerySchema, "query"),
  specialEventPageController.listPages
);

router.get(
  "/:id",
  requirePermissions(PERMISSIONS.CMS_EVENTS_VIEW),
  validate(specialEventPageIdParamsSchema, "params"),
  specialEventPageController.getPageById
);

router.post(
  "/",
  requirePermissions(PERMISSIONS.CMS_EVENTS_MANAGE),
  validate(createSpecialEventPageSchema, "body"),
  specialEventPageController.createPage
);

router.patch(
  "/:id",
  requirePermissions(PERMISSIONS.CMS_EVENTS_MANAGE),
  validate(specialEventPageIdParamsSchema, "params"),
  validate(updateSpecialEventPageSchema, "body"),
  specialEventPageController.updatePage
);

router.post(
  "/:id/duplicate",
  requirePermissions(PERMISSIONS.CMS_EVENTS_MANAGE),
  validate(specialEventPageIdParamsSchema, "params"),
  specialEventPageController.duplicatePage
);

router.patch(
  "/:id/publish",
  requirePermissions(PERMISSIONS.CMS_EVENTS_MANAGE),
  validate(specialEventPageIdParamsSchema, "params"),
  specialEventPageController.publishPage
);

router.patch(
  "/:id/unpublish",
  requirePermissions(PERMISSIONS.CMS_EVENTS_MANAGE),
  validate(specialEventPageIdParamsSchema, "params"),
  specialEventPageController.unpublishPage
);

router.patch(
  "/:id/archive",
  requirePermissions(PERMISSIONS.CMS_EVENTS_MANAGE),
  validate(specialEventPageIdParamsSchema, "params"),
  specialEventPageController.archivePage
);

router.delete(
  "/:id",
  requirePermissions(PERMISSIONS.CMS_EVENTS_MANAGE),
  validate(specialEventPageIdParamsSchema, "params"),
  specialEventPageController.deletePage
);

module.exports = router;
