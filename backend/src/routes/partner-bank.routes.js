const express = require("express");
const router = express.Router();
const partnerBankController = require("../controllers/partner-bank.controller");
const validate = require("../middlewares/validate.middleware");
const { listPartnerBanksQuerySchema } = require("../validators/admin/partner-bank.validator");

// Public / Vendor directory lookup (search active & eligible banks)
router.get(
  "/",
  validate(listPartnerBanksQuerySchema, "query"),
  partnerBankController.listPartnerBanks
);

router.get("/:id", partnerBankController.getPartnerBankById);

module.exports = router;

