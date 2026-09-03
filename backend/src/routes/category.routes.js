const express = require("express");

const categoryController = require("../controllers/category.controller");
const authenticate = require("../middlewares/authentication.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");

const { PERMISSIONS } = require("../constants/permissions.constants");
const {
  createCategorySchema,
} = require("../validators/catalog/category.validator");

const {
  updateCategorySchema,
} = require("../validators/catalog/update-category.validator");

const router = express.Router();

// Public
router.get("/", categoryController.listCategories);
router.get("/:id", categoryController.getCategory);

// Admin/Manager
router.post(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCTS_CREATE),
  validate(createCategorySchema),
  categoryController.createCategory
);

router.patch(
  "/:id",
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCTS_UPDATE),
  validate(updateCategorySchema),
  categoryController.updateCategory
);

router.delete(
  "/:id",
  authenticate,
  requirePermissions(PERMISSIONS.PRODUCTS_DELETE),
  categoryController.deleteCategory
);



module.exports = router;