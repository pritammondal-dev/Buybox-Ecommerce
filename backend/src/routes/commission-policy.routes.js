const express = require("express");
const commissionPolicyController = require("../controllers/commission-policy.controller");
const authenticate = require("../middlewares/authentication.middleware");
const { requirePermissions } = require("../middlewares/authorization.middleware");
const validate = require("../middlewares/validate.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");
const {
  createCommissionPolicySchema,
  updateCommissionPolicySchema,
  toggleCommissionPolicyStatusSchema,
  resolveCommissionPolicySchema,
  previewCommissionCalculationSchema,
} = require("../validators/finance/commission-policy.validator");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  requirePermissions(PERMISSIONS.FINANCE_READ),
  commissionPolicyController.listPolicies
);

router.post(
  "/",
  requirePermissions(PERMISSIONS.FINANCE_MANAGE),
  validate(createCommissionPolicySchema),
  commissionPolicyController.createPolicy
);

router.post(
  "/resolve",
  requirePermissions(PERMISSIONS.FINANCE_READ),
  validate(resolveCommissionPolicySchema),
  commissionPolicyController.resolvePolicy
);

router.post(
  "/preview",
  requirePermissions(PERMISSIONS.FINANCE_READ),
  validate(previewCommissionCalculationSchema),
  commissionPolicyController.previewPolicyCalculation
);

router.get(
  "/:policyId",
  requirePermissions(PERMISSIONS.FINANCE_READ),
  commissionPolicyController.getPolicyById
);

router.put(
  "/:policyId",
  requirePermissions(PERMISSIONS.FINANCE_MANAGE),
  validate(updateCommissionPolicySchema),
  commissionPolicyController.updatePolicy
);

router.patch(
  "/:policyId/status",
  requirePermissions(PERMISSIONS.FINANCE_MANAGE),
  validate(toggleCommissionPolicyStatusSchema),
  commissionPolicyController.togglePolicyStatus
);

router.delete(
  "/:policyId",
  requirePermissions(PERMISSIONS.FINANCE_MANAGE),
  commissionPolicyController.deletePolicy
);

module.exports = router;

