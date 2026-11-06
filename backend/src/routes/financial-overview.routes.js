const express = require("express");
const financialOverviewController = require("../controllers/financial-overview.controller");
const authenticate = require("../middlewares/authentication.middleware");
const { requirePermissions } = require("../middlewares/authorization.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");

const router = express.Router();

router.use(authenticate);

router.get("/", requirePermissions(PERMISSIONS.FINANCE_READ), financialOverviewController.getOverview);
router.get("/exceptions", requirePermissions(PERMISSIONS.FINANCE_READ), financialOverviewController.getExceptions);
router.post("/exceptions/classify", requirePermissions(PERMISSIONS.FINANCE_MANAGE), financialOverviewController.classifyException);

module.exports = router;

