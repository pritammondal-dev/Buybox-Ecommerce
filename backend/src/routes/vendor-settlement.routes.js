const express = require("express");

const vendorSettlementController = require("../controllers/vendor-settlement.controller");
const authenticate = require("../middlewares/authentication.middleware");
const {
  requirePermissions,
  requireRoles,
} = require("../middlewares/authorization.middleware");
const { ROLES } = require("../constants/auth.constants");
const validate = require("../middlewares/validate.middleware");

const {
  createVendorSettlementSchema,
} = require("../validators/finance/vendor-settlement.validator");

const { PERMISSIONS } = require("../constants/permissions.constants");

const router = express.Router();

router.use(authenticate);

// Admin settlement management (must precede generic /:settlementId)
router.get(
  "/admin",
  requirePermissions(PERMISSIONS.FINANCE_READ),
  vendorSettlementController.getAdminSettlements
);

router.get(
  "/admin/:settlementId",
  requirePermissions(PERMISSIONS.FINANCE_READ),
  vendorSettlementController.getAdminSettlementById
);

router.post(
  "/generate",
  requirePermissions(PERMISSIONS.FINANCE_MANAGE),
  vendorSettlementController.generateSettlements
);

router.post(
  "/:settlementId/pay",
  requirePermissions(PERMISSIONS.FINANCE_MANAGE),
  vendorSettlementController.markSettlementPaid
);

// Vendor-scoped settlement self-service (must precede /:settlementId)
router.get(
  "/vendor/finance-summary",
  requireRoles(ROLES.VENDOR),
  vendorSettlementController.getVendorFinanceSummary
);

router.get(
  "/vendor/my",
  requireRoles(ROLES.VENDOR),
  vendorSettlementController.getMyVendorSettlements
);

router.get(
  "/vendor/my/:settlementId",
  requireRoles(ROLES.VENDOR),
  vendorSettlementController.getMyVendorSettlementById
);

router.get(
  "/:settlementId",
  requirePermissions(PERMISSIONS.FINANCE_READ),
  vendorSettlementController.getSettlementById
);

router.get(
  "/vendor/:vendorId",
  requirePermissions(PERMISSIONS.FINANCE_READ),
  vendorSettlementController.getSettlementsByVendorId
);

router.post(
  "/",
  requirePermissions(PERMISSIONS.FINANCE_MANAGE),
  validate(createVendorSettlementSchema),
  vendorSettlementController.createSettlement
);

router.patch(
  "/:settlementId/processing",
  requirePermissions(PERMISSIONS.FINANCE_MANAGE),
  vendorSettlementController.markProcessing
);

router.patch(
  "/:settlementId/payable",
  requirePermissions(PERMISSIONS.FINANCE_MANAGE),
  vendorSettlementController.markPayable
);

module.exports = router;
