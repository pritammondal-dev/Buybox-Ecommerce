const express = require("express");

const categoryController = require("../controllers/category.controller");
const authenticate = require("../middlewares/authentication.middleware");
const validate = require("../middlewares/validate.middleware");
const validateObjectId = require("../middlewares/validate-object-id.middleware");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");
const { requireScope } = require("../middlewares/scope.middleware");
const { SCOPE_TYPES } = require("../constants/scope.constants");

const { PERMISSIONS } = require("../constants/permissions.constants");
const {
  createCategorySchema,
} = require("../validators/catalog/category.validator");

const {
  updateCategorySchema,
} = require("../validators/catalog/update-category.validator");

const attributeController = require("../controllers/attribute.controller");

const router = express.Router();

// Public
router.get("/", categoryController.listCategories);
router.get("/:id", validateObjectId("id"), categoryController.getCategory);
router.get("/:id/attributes", validateObjectId("id"), attributeController.getCategoryAttributes);

// Admin/Manager
router.post(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCTS_CREATE),
  validate(createCategorySchema),
  requireScope({
    scopeType: SCOPE_TYPES.CATEGORY,
    resolveScopeId: (req) => req.body?.parentId || "root",
    allowGlobalPlatformActor: true,
  }),
  categoryController.createCategory
);

router.patch(
  "/:id",
  authenticate,
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.PRODUCTS_UPDATE),
  validate(updateCategorySchema),
  requireScope({
    scopeType: SCOPE_TYPES.CATEGORY,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  categoryController.updateCategory
);

router.put(
  "/:id",
  authenticate,
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.PRODUCTS_UPDATE),
  validate(updateCategorySchema),
  requireScope({
    scopeType: SCOPE_TYPES.CATEGORY,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  categoryController.updateCategory
);

router.delete(
  "/:id",
  authenticate,
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.PRODUCTS_DELETE),
  requireScope({
    scopeType: SCOPE_TYPES.CATEGORY,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  categoryController.deleteCategory
);

module.exports = router;