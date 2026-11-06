const express = require("express");

const storefrontBannerController = require("../controllers/storefront-banner.controller");

const authenticate = require("../middlewares/authentication.middleware");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");
const validate = require("../middlewares/validate.middleware");

const {
  createStorefrontBannerSchema,
  updateStorefrontBannerSchema,
  storefrontBannerIdParamsSchema,
  storefrontBannerListQuerySchema,
} = require("../validators/cms/storefront-banner.validator");

const { PERMISSIONS } = require("../constants/permissions.constants");

const router = express.Router();

// Public
router.get(
  "/active",
  storefrontBannerController.listActiveBanners
);

// Admin / Manager
router.use(authenticate);

router.get(
  "/",
  requirePermissions(PERMISSIONS.CMS_VIEW),
  validate(storefrontBannerListQuerySchema, "query"),
  storefrontBannerController.listBanners
);

router.get(
  "/:bannerId",
  requirePermissions(PERMISSIONS.CMS_VIEW),
  validate(storefrontBannerIdParamsSchema, "params"),
  storefrontBannerController.getBannerById
);

router.post(
  "/",
  requirePermissions(PERMISSIONS.CMS_CREATE),
  validate(createStorefrontBannerSchema),
  storefrontBannerController.createBanner
);

router.patch(
  "/:bannerId",
  requirePermissions(PERMISSIONS.CMS_EDIT),
  validate(storefrontBannerIdParamsSchema, "params"),
  validate(updateStorefrontBannerSchema),
  storefrontBannerController.updateBanner
);

router.delete(
  "/:bannerId",
  requirePermissions(PERMISSIONS.CMS_DELETE),
  validate(storefrontBannerIdParamsSchema, "params"),
  storefrontBannerController.deleteBanner
);

module.exports = router;