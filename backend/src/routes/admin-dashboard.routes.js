const express = require("express");
const adminDashboardController = require("../controllers/admin-dashboard.controller");
const authenticate = require("../middlewares/authentication.middleware");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  requirePermissions(PERMISSIONS.DASHBOARD_VIEW),
  adminDashboardController.getStats
);

router.get(
  "/stats",
  requirePermissions(PERMISSIONS.DASHBOARD_VIEW),
  adminDashboardController.getStats
);

module.exports = router;
