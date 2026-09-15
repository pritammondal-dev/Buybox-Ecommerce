const express = require("express");

const vendorController = require("../controllers/vendor.controller");
const authenticate = require("../middlewares/authentication.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  requirePermissions,
  requireRoles,
} = require("../middlewares/authorization.middleware");

const validateObjectId = require("../middlewares/validate-object-id.middleware");
const { requireScope } = require("../middlewares/scope.middleware");
const { SCOPE_TYPES } = require("../constants/scope.constants");

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
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.VENDORS_READ),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  vendorController.getVendor
);

router.patch(
  "/:id/status",
  validateObjectId("id"),
  requirePermissions(PERMISSIONS.VENDORS_MANAGE),
  requireScope({
    scopeType: SCOPE_TYPES.VENDOR,
    resolveScopeId: "params.id",
    allowGlobalPlatformActor: true,
  }),
  validate(updateVendorStatusSchema),
  vendorController.updateVendorStatus
);

module.exports = router;