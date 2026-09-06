const express = require("express");

const vendorPayoutController = require("../controllers/vendor-payout.controller");
const authenticate = require("../middlewares/authentication.middleware");
const { requirePermissions } = require("../middlewares/authorization.middleware");
const validate = require("../middlewares/validate.middleware");

const {
  createVendorPayoutSchema,
  updateVendorPayoutStatusSchema,
} = require("../validators/finance/vendor-payout.validator");

const { PERMISSIONS } = require("../constants/permissions.constants");

const router = express.Router();

router.use(authenticate);

router.get(
  "/:payoutId",
  requirePermissions(PERMISSIONS.FINANCE_READ),
  vendorPayoutController.getPayoutById
);

router.get(
  "/vendor/:vendorId",
  requirePermissions(PERMISSIONS.FINANCE_READ),
  vendorPayoutController.getPayoutsByVendorId
);

router.post(
  "/",
  requirePermissions(PERMISSIONS.FINANCE_MANAGE),
  validate(createVendorPayoutSchema),
  vendorPayoutController.createPayout
);

router.patch(
  "/:payoutId/status",
  requirePermissions(PERMISSIONS.FINANCE_MANAGE),
  validate(updateVendorPayoutStatusSchema),
  vendorPayoutController.transitionPayoutStatus
);

module.exports = router;
