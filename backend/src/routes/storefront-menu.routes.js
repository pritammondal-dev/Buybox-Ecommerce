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
  requirePermissions(PERMISSIONS.CMS_VIEW),
  validate(storefrontMenuListQuerySchema, "query"),
  storefrontMenuController.listMenus
);

router.get(
  "/:menuId",
  requirePermissions(PERMISSIONS.CMS_VIEW),
  validate(storefrontMenuIdParamsSchema, "params"),
  storefrontMenuController.getMenuById
);

router.post(
  "/",
  requirePermissions(PERMISSIONS.CMS_CREATE),
  validate(createStorefrontMenuSchema),
  storefrontMenuController.createMenu
);

router.patch(
  "/:menuId",
  requirePermissions(PERMISSIONS.CMS_EDIT),
  validate(storefrontMenuIdParamsSchema, "params"),
  validate(updateStorefrontMenuSchema),
  storefrontMenuController.updateMenu
);

router.delete(
  "/:menuId",
  requirePermissions(PERMISSIONS.CMS_DELETE),
  validate(storefrontMenuIdParamsSchema, "params"),
  storefrontMenuController.deleteMenu
);

module.exports = router;