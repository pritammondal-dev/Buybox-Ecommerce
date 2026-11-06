const express = require("express");
const authenticate = require("../middlewares/authentication.middleware");
const { requirePermissions } = require("../middlewares/authorization.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");
const validate = require("../middlewares/validate.middleware");
const adminDiscountController = require("../controllers/admin-discount.controller");
const {
  createDiscountSchema,
  updateDiscountSchema,
  previewDiscountSchema,
  assignProductsSchema,
  transitionStatusSchema,
} = require("../validators/marketing/discount.validator");

const router = express.Router();

router.use(authenticate);

// Preview promotional pricing calculation without saving
router.post(
  "/preview",
  requirePermissions(PERMISSIONS.DISCOUNTS_READ),
  validate(previewDiscountSchema),
  adminDiscountController.previewDiscount
);

// Manual trigger for promotion lifecycle reconciliation
router.post(
  "/reconcile",
  requirePermissions(PERMISSIONS.DISCOUNTS_MANAGE),
  adminDiscountController.reconcileDiscounts
);

// List promotions with search, filters, pagination
router.get(
  "/",
  requirePermissions(PERMISSIONS.DISCOUNTS_READ),
  adminDiscountController.getDiscounts
);

// Retrieve promotion details
router.get(
  "/:id",
  requirePermissions(PERMISSIONS.DISCOUNTS_READ),
  adminDiscountController.getDiscountById
);

// Create new promotion
router.post(
  "/",
  requirePermissions(PERMISSIONS.DISCOUNTS_MANAGE),
  validate(createDiscountSchema),
  adminDiscountController.createDiscount
);

// Update promotion
router.patch(
  "/:id",
  requirePermissions(PERMISSIONS.DISCOUNTS_MANAGE),
  validate(updateDiscountSchema),
  adminDiscountController.updateDiscount
);

// Lifecycle actions
router.post(
  "/:id/activate",
  requirePermissions(PERMISSIONS.DISCOUNTS_MANAGE),
  validate(transitionStatusSchema),
  adminDiscountController.activateDiscount
);

router.post(
  "/:id/pause",
  requirePermissions(PERMISSIONS.DISCOUNTS_MANAGE),
  validate(transitionStatusSchema),
  adminDiscountController.pauseDiscount
);

router.post(
  "/:id/resume",
  requirePermissions(PERMISSIONS.DISCOUNTS_MANAGE),
  validate(transitionStatusSchema),
  adminDiscountController.resumeDiscount
);

router.post(
  "/:id/cancel",
  requirePermissions(PERMISSIONS.DISCOUNTS_MANAGE),
  validate(transitionStatusSchema),
  adminDiscountController.cancelDiscount
);

// Bulk target assignment
router.post(
  "/:id/assign-products",
  requirePermissions(PERMISSIONS.DISCOUNTS_MANAGE),
  validate(assignProductsSchema),
  adminDiscountController.assignProducts
);

// Soft delete promotion
router.delete(
  "/:id",
  requirePermissions(PERMISSIONS.DISCOUNTS_MANAGE),
  adminDiscountController.deleteDiscount
);

module.exports = router;
