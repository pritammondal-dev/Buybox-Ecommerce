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

// Public

router.get(
  "/active",
  storefrontMediaController.getActiveMedia
);

// Admin

router.get(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_READ),
  storefrontMediaController.listMedia
);

router.get(
  "/:mediaId",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_READ),
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
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  upload.single("file"),
  storefrontMediaController.uploadMedia
);

router.post(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(
    createStorefrontMediaSchema,
    "body"
  ),
  storefrontMediaController.createMedia
);

router.patch(
  "/:mediaId",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
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
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(
    storefrontMediaIdParamsSchema,
    "params"
  ),
  storefrontMediaController.deleteMedia
);

module.exports = router;