const express = require("express");
const financialReconciliationController = require("../controllers/financial-reconciliation.controller");
const authenticate = require("../middlewares/authentication.middleware");
const { requirePermissions } = require("../middlewares/authorization.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");

const router = express.Router();

router.use(authenticate);

router.get(
  "/summary",
  requirePermissions(PERMISSIONS.FINANCE_READ),
  financialReconciliationController.getReconciliationSummary
);

router.post(
  "/adjust",
  requirePermissions(PERMISSIONS.FINANCE_MANAGE),
  financialReconciliationController.postCorrectionAdjustment
);

module.exports = router;

