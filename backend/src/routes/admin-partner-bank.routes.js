const express = require("express");
const router = express.Router();
const partnerBankController = require("../controllers/partner-bank.controller");
const validate = require("../middlewares/validate.middleware");
const { requirePermissions } = require("../middlewares/authorization.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");
const {
  createPartnerBankSchema,
  updatePartnerBankSchema,
  togglePartnerBankStatusSchema,
  listPartnerBanksQuerySchema,
} = require("../validators/admin/partner-bank.validator");

router.get(
  "/",
  requirePermissions(PERMISSIONS.PARTNER_BANKS_VIEW),
  validate(listPartnerBanksQuerySchema, "query"),
  partnerBankController.listPartnerBanks
);

router.post(
  "/",
  requirePermissions(PERMISSIONS.PARTNER_BANKS_MANAGE),
  validate(createPartnerBankSchema),
  partnerBankController.createPartnerBank
);

router.get(
  "/:id",
  requirePermissions(PERMISSIONS.PARTNER_BANKS_VIEW),
  partnerBankController.getPartnerBankById
);

router.patch(
  "/:id",
  requirePermissions(PERMISSIONS.PARTNER_BANKS_MANAGE),
  validate(updatePartnerBankSchema),
  partnerBankController.updatePartnerBank
);

router.patch(
  "/:id/status",
  requirePermissions(PERMISSIONS.PARTNER_BANKS_MANAGE),
  validate(togglePartnerBankStatusSchema),
  partnerBankController.togglePartnerBankStatus
);

module.exports = router;

