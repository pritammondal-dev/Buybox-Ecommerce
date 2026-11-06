const express = require("express");

const brandController = require("../controllers/brand.controller");
const authenticate = require("../middlewares/authentication.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");

const { PERMISSIONS } = require("../constants/permissions.constants");
const {
  createBrandSchema,
} = require("../validators/catalog/brand.validator");

const {
  updateBrandSchema,
} = require("../validators/catalog/update-brand.validator");

const router = express.Router();

// Public
router.get("/", brandController.listBrands);
router.get("/:id", brandController.getBrand);

// Admin/Manager
router.post(
  "/",
  authenticate,
  requirePermissions(PERMISSIONS.BRANDS_CREATE),
  validate(createBrandSchema),
  brandController.createBrand
);

router.patch(
  "/:id",
  authenticate,
  requirePermissions(PERMISSIONS.BRANDS_EDIT),
  validate(updateBrandSchema),
  brandController.updateBrand
);

router.delete(
  "/:id",
  authenticate,
  requirePermissions(PERMISSIONS.BRANDS_DELETE),
  brandController.deleteBrand
);

module.exports = router;