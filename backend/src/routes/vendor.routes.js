const express = require("express");

const vendorController = require("../controllers/vendor.controller");
const authenticate = require("../middlewares/authentication.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  requirePermissions,
  requireRoles,
} = require("../middlewares/authorization.middleware");

const {
  createVendorSchema,
} = require("../validators/vendor/create-vendor.validator");

const {
  updateVendorSchema,
} = require("../validators/vendor/update-vendor.validator");

const {
  updateVendorStatusSchema,
} = require("../validators/vendor/update-vendor-status.validator");

const {
  PERMISSIONS,
} = require("../constants/permissions.constants");

const { ROLES } = require("../constants/auth.constants");

const router = express.Router();

router.use(authenticate);

/*
 * Vendor self-service
 */

router.get(
  "/me",
  requireRoles(ROLES.VENDOR),
  vendorController.getMyProfile
);

router.post(
  "/me",
  requireRoles(ROLES.VENDOR),
  validate(createVendorSchema),
  vendorController.createMyProfile
);

router.patch(
  "/me",
  requireRoles(ROLES.VENDOR),
  validate(updateVendorSchema),
  vendorController.updateMyProfile
);

/*
 * Admin/vendor management
 */

router.get(
  "/",
  requirePermissions(PERMISSIONS.VENDORS_READ),
  vendorController.listVendors
);

router.get(
  "/:id",
  requirePermissions(PERMISSIONS.VENDORS_READ),
  vendorController.getVendor
);

router.patch(
  "/:id/status",
  requirePermissions(PERMISSIONS.VENDORS_MANAGE),
  validate(updateVendorStatusSchema),
  vendorController.updateVendorStatus
);

module.exports = router;