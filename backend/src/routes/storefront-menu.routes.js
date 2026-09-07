const express = require("express");

const storefrontMenuController = require("../controllers/storefront-menu.controller");

const authenticate = require("../middlewares/authentication.middleware");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");
const validate = require("../middlewares/validate.middleware");

const {
  createStorefrontMenuSchema,
  updateStorefrontMenuSchema,
  storefrontMenuIdParamsSchema,
  storefrontMenuKeyParamsSchema,
  storefrontMenuListQuerySchema,
} = require("../validators/cms/storefront-menu.validator");

const { PERMISSIONS } = require("../constants/permissions.constants");

const router = express.Router();

// Public
router.get(
  "/active/:key",
  validate(storefrontMenuKeyParamsSchema, "params"),
  storefrontMenuController.getActiveMenuByKey
);

// Admin / Manager
router.use(authenticate);

router.get(
  "/",
  requirePermissions(PERMISSIONS.SETTINGS_READ),
  validate(storefrontMenuListQuerySchema, "query"),
  storefrontMenuController.listMenus
);

router.get(
  "/:menuId",
  requirePermissions(PERMISSIONS.SETTINGS_READ),
  validate(storefrontMenuIdParamsSchema, "params"),
  storefrontMenuController.getMenuById
);

router.post(
  "/",
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(createStorefrontMenuSchema),
  storefrontMenuController.createMenu
);

router.patch(
  "/:menuId",
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(storefrontMenuIdParamsSchema, "params"),
  validate(updateStorefrontMenuSchema),
  storefrontMenuController.updateMenu
);

router.delete(
  "/:menuId",
  requirePermissions(PERMISSIONS.SETTINGS_MANAGE),
  validate(storefrontMenuIdParamsSchema, "params"),
  storefrontMenuController.deleteMenu
);

module.exports = router;