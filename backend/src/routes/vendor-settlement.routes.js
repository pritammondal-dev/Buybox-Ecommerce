const express = require("express");

const vendorSettlementController = require("../controllers/vendor-settlement.controller");
const authenticate = require("../middlewares/authentication.middleware");
const { requirePermissions } = require("../middlewares/authorization.middleware");
const validate = require("../middlewares/validate.middleware");

const {
  createVendorSettlementSchema,
} = require("../validators/finance/vendor-settlement.validator");

const { PERMISSIONS } = require("../constants/permissions.constants");

const router = express.Router();

router.use(authenticate);

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
