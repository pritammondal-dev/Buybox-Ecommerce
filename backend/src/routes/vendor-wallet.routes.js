const express = require("express");
const vendorWalletController = require("../controllers/vendor-wallet.controller");
const authenticate = require("../middlewares/authentication.middleware");
const { requirePermissions } = require("../middlewares/authorization.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  requirePermissions(PERMISSIONS.FINANCE_READ),
  vendorWalletController.listAdminWallets
);

router.get(
  "/:vendorId/drilldown",
  requirePermissions(PERMISSIONS.FINANCE_READ),
  vendorWalletController.getAdminVendorDrilldown
);

router.get(
  "/:vendorId",
  requirePermissions(PERMISSIONS.FINANCE_READ),
  vendorWalletController.getAdminVendorWallet
);

router.get(
  "/:vendorId/reconciliation",
  requirePermissions(PERMISSIONS.FINANCE_READ),
  vendorWalletController.getAdminVendorReconciliation
);

router.post(
  "/:vendorId/reconcile",
  requirePermissions(PERMISSIONS.FINANCE_MANAGE),
  vendorWalletController.syncAdminVendorWallet
);

module.exports = router;

