const express = require("express");

const router = express.Router();

const storefrontMediaController = require("../controllers/storefront-media.controller");

const authenticate = require("../middlewares/authentication.middleware");

const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");

const {
  PERMISSIONS,
} = require("../constants/permissions.constants");

const validate = require("../middlewares/validate.middleware");

const {
  createStorefrontMediaSchema,
  updateStorefrontMediaSchema,
  storefrontMediaIdParamsSchema,
} = require("../validators/cms/storefront-media.validator");
const { uploadLimiter } = require("../middlewares/rate-limiter.middleware");

// Public

router.get(
  "/active",
  storefrontMediaController.getActiveMedia
);

// Admin

router.get(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_VIEW),
  storefrontMediaController.listMedia
);

router.get(
  "/:mediaId",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_VIEW),
  validate(
    storefrontMediaIdParamsSchema,
    "params"
  ),
  storefrontMediaController.getMediaById
);

const multer = require("multer");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

router.post(
  "/upload",
  uploadLimiter,
  authenticate,
  requirePermissions(PERMISSIONS.CMS_CREATE),
  upload.single("file"),
  storefrontMediaController.uploadMedia
);

router.post(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_CREATE),
  validate(
    createStorefrontMediaSchema,
    "body"
  ),
  storefrontMediaController.createMedia
);

router.patch(
  "/:mediaId",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_EDIT),
  validate(
    storefrontMediaIdParamsSchema,
    "params"
  ),
  validate(
    updateStorefrontMediaSchema,
    "body"
  ),
  storefrontMediaController.updateMedia
);

router.delete(
  "/:mediaId",
  authenticate,
  requirePermissions(PERMISSIONS.CMS_DELETE),
  validate(
    storefrontMediaIdParamsSchema,
    "params"
  ),
  storefrontMediaController.deleteMedia
);

module.exports = router;