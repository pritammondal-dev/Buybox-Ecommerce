const express = require("express");

const campaignController = require("../controllers/campaign.controller");
const authenticate = require("../middlewares/authentication.middleware");
const {
  requirePermissions,
} = require("../middlewares/authorization.middleware");
const { PERMISSIONS } = require("../constants/permissions.constants");

const {
  createCampaignSchema,
  updateCampaignSchema,
  transitionCampaignSchema,
} = require("../validators/marketing/campaign.validator");

const validate = require("../middlewares/validate.middleware");

const router = express.Router();

router.use(authenticate);

router.get(
  "/",
  requirePermissions(PERMISSIONS.CAMPAIGNS_READ),
  campaignController.getCampaigns
);

router.get(
  "/:campaignId",
  requirePermissions(PERMISSIONS.CAMPAIGNS_READ),
  campaignController.getCampaignById
);

router.post(
  "/",
  requirePermissions(PERMISSIONS.CAMPAIGNS_MANAGE),
  validate(createCampaignSchema),
  campaignController.createCampaign
);

router.patch(
  "/:campaignId",
  requirePermissions(PERMISSIONS.CAMPAIGNS_MANAGE),
  validate(updateCampaignSchema),
  campaignController.updateCampaign
);

router.patch(
  "/:campaignId/schedule",
  requirePermissions(PERMISSIONS.CAMPAIGNS_MANAGE),
  campaignController.scheduleCampaign
);

router.patch(
  "/:campaignId/activate",
  requirePermissions(PERMISSIONS.CAMPAIGNS_MANAGE),
  campaignController.activateCampaign
);

router.patch(
  "/:campaignId/deactivate",
  requirePermissions(PERMISSIONS.CAMPAIGNS_MANAGE),
  campaignController.deactivateCampaign
);

router.patch(
  "/:campaignId/status",
  requirePermissions(PERMISSIONS.CAMPAIGNS_MANAGE),
  validate(transitionCampaignSchema),
  campaignController.transitionCampaignStatus
);

module.exports = router;

