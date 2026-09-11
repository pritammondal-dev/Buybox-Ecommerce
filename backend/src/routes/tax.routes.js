const express = require("express");
const taxController = require("../controllers/tax.controller");
const authenticate = require("../middlewares/authentication.middleware");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");
const validate = require("../middlewares/validate.middleware");
const validateObjectId = require("../middlewares/validate-object-id.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");
const {
  createTaxRuleSchema,
  updateTaxRuleSchema,
  taxPreviewSchema,
} = require("../validators/tax/tax.validator");

const router = express.Router();

router.use(authenticate);

// Non-authoritative preview quote
router.post("/preview", validate(taxPreviewSchema), taxController.previewTax);

// Admin Tax Rule CRUD
router.get(
  "/rules",
  requirePermissions(PERMISSIONS.TAX_READ),
  taxController.getRules
);

router.get(
  "/rules/:id",
  requirePermissions(PERMISSIONS.TAX_READ),
  validateObjectId("id"),
  taxController.getRuleById
);

router.post(
  "/rules",
  requirePermissions(PERMISSIONS.TAX_MANAGE),
  validate(createTaxRuleSchema),
  taxController.createRule
);

router.put(
  "/rules/:id",
  requirePermissions(PERMISSIONS.TAX_MANAGE),
  validateObjectId("id"),
  validate(updateTaxRuleSchema),
  taxController.updateRule
);

router.delete(
  "/rules/:id",
  requirePermissions(PERMISSIONS.TAX_MANAGE),
  validateObjectId("id"),
  taxController.deleteRule
);

module.exports = router;
