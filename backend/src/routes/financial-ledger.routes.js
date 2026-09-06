const express = require("express");

const financialLedgerController = require("../controllers/financial-ledger.controller");
const authenticate = require("../middlewares/authentication.middleware");
const { requirePermissions } = require("../middlewares/authorization.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");

const router = express.Router();

router.use(authenticate);
router.use(requirePermissions(PERMISSIONS.FINANCE_READ));

router.get("/entry/:entryId", financialLedgerController.getLedgerEntryById);
router.get("/journal/:journalId", financialLedgerController.getEntriesByJournalId);
router.get("/order/:orderId", financialLedgerController.getEntriesByOrderId);
router.get("/vendor/:vendorId", financialLedgerController.getEntriesByVendorId);

module.exports = router;
