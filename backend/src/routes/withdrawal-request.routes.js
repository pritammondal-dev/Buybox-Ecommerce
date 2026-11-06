const express = require("express");
const withdrawalRequestController = require("../controllers/withdrawal-request.controller");
const authenticate = require("../middlewares/authentication.middleware");
const { requirePermissions } = require("../middlewares/authorization.middleware");
const validate = require("../middlewares/validate.middleware");

const {
  rejectWithdrawalSchema,
  markWithdrawalPaidSchema,
  markWithdrawalFailedSchema,
  withdrawalQuerySchema,
} = require("../validators/finance/withdrawal-request.validator");

const { PERMISSIONS } = require("../constants/permissions.constants");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  requirePermissions(PERMISSIONS.FINANCE_READ),
  validate(withdrawalQuerySchema, "query"),
  withdrawalRequestController.getAdminWithdrawals
);

router.get(
  "/:id",
  requirePermissions(PERMISSIONS.FINANCE_READ),
  withdrawalRequestController.getAdminWithdrawalById
);

router.post(
  "/:id/approve",
  requirePermissions(PERMISSIONS.FINANCE_MANAGE),
  withdrawalRequestController.approveWithdrawal
);

router.post(
  "/:id/reject",
  requirePermissions(PERMISSIONS.FINANCE_MANAGE),
  validate(rejectWithdrawalSchema),
  withdrawalRequestController.rejectWithdrawal
);

router.post(
  "/:id/process",
  requirePermissions(PERMISSIONS.FINANCE_MANAGE),
  withdrawalRequestController.processWithdrawal
);

router.post(
  "/:id/mark-paid",
  requirePermissions(PERMISSIONS.FINANCE_MANAGE),
  validate(markWithdrawalPaidSchema),
  withdrawalRequestController.markWithdrawalPaid
);

router.post(
  "/:id/mark-failed",
  requirePermissions(PERMISSIONS.FINANCE_MANAGE),
  validate(markWithdrawalFailedSchema),
  withdrawalRequestController.markWithdrawalFailed
);

module.exports = router;

