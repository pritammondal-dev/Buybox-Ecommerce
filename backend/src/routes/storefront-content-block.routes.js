const express = require("express");

const router = express.Router();

const storefrontContentBlockController = require("../controllers/storefront-content-block.controller");

const authenticate = require("../middlewares/authentication.middleware");

const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");

const {
  PERMISSIONS,
} = require("../constants/permissions.constants");

const validate = require("../middlewares/validate.middleware");

const {
  createStorefrontContentBlockSchema,
  updateStorefrontContentBlockSchema,
  storefrontContentBlockIdParamsSchema,
  storefrontContentBlockKeyParamsSchema,
} = require("../validators/cms/storefront-content-block.validator");

// Public

router.get(
  "/active",
  storefrontContentBlockController.getActiveBlocks
);

router.get(
  "/key/:key",
  validate(
    storefrontContentBlockKeyParamsSchema,
    "params"
  ),
  storefrontContentBlockController.getBlockByKey
);

// Admin

router.get(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_READ),
  storefrontContentBlockController.listBlocks
);

router.get(
  "/:blockId",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_READ),
  validate(
    storefrontContentBlockIdParamsSchema,
    "params"
  ),
  storefrontContentBlockController.getBlockById
);

router.post(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(
    createStorefrontContentBlockSchema,
    "body"
  ),
  storefrontContentBlockController.createBlock
);

router.patch(
  "/:blockId",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(
    storefrontContentBlockIdParamsSchema,
    "params"
  ),
  validate(
    updateStorefrontContentBlockSchema,
    "body"
  ),
  storefrontContentBlockController.updateBlock
);

router.delete(
  "/:blockId",
  authenticate,
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(
    storefrontContentBlockIdParamsSchema,
    "params"
  ),
  storefrontContentBlockController.deleteBlock
);

module.exports = router;