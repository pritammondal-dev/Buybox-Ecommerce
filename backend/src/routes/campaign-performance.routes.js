const express = require("express");

const campaignPerformanceController = require("../controllers/campaign-performance.controller");
const authenticate = require("../middlewares/authentication.middleware");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");
const validate = require("../middlewares/validate.middleware");

const {
  recordDailyPerformanceSchema,
  incrementDailyPerformanceSchema,
  campaignPerformanceParamsSchema,
  performanceIdParamsSchema,
} = require("../validators/marketing/campaign-performance.validator");

const router = express.Router();

router.use(authenticate);

router.get(
  "/campaign/:campaignId",
  requirePermissions(PERMISSIONS.CAMPAIGNS_READ),
  validate(campaignPerformanceParamsSchema, "params"),
  campaignPerformanceController.getCampaignPerformance
);

router.post(
  "/campaign/:campaignId",
  requirePermissions(PERMISSIONS.CAMPAIGNS_MANAGE),
  validate(campaignPerformanceParamsSchema, "params"),
  validate(recordDailyPerformanceSchema),
  campaignPerformanceController.recordDailyPerformance
);

router.get(
  "/:performanceId",
  requirePermissions(PERMISSIONS.CAMPAIGNS_READ),
  validate(performanceIdParamsSchema, "params"),
  campaignPerformanceController.getCampaignPerformanceById
);

router.patch(
  "/:performanceId/increment",
  requirePermissions(PERMISSIONS.CAMPAIGNS_MANAGE),
  validate(performanceIdParamsSchema, "params"),
  validate(incrementDailyPerformanceSchema),
  campaignPerformanceController.incrementDailyPerformance
);

module.exports = router;