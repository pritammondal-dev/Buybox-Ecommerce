const mongoose = require("mongoose");

const campaignRepository = require("../repositories/campaign.repository");
const campaignAutomationService = require("./campaign-automation.service");
const AppError = require("../errors/AppError");

const processCampaignSchedule = async () => {
  const now = new Date();

  const scheduledCampaigns = await campaignRepository.findMany({
    status: "scheduled",
    startsAt: { $lte: now },
    endsAt: { $gt: now },
    isActive: false,
  });

  const activeCampaigns = await campaignRepository.findMany({
    status: "active",
    endsAt: { $lte: now },
  });

  const activated = [];
  const completed = [];

  for (const campaign of scheduledCampaigns) {
    const result =
      await campaignAutomationService.activateCampaignWithCoupons(
        campaign._id
      );

    activated.push(result.campaign);
  }

  for (const campaign of activeCampaigns) {
    const result =
      await campaignAutomationService.expireCampaign(campaign._id);

    completed.push(result.campaign);
  }

  return {
    activated,
    completed,
    processedAt: now,
  };
};

const scheduleCampaign = async (campaignId) => {
  if (!mongoose.isValidObjectId(campaignId)) {
    throw new AppError(
      "Invalid campaign ID",
      400,
      "INVALID_CAMPAIGN_ID"
    );
  }

  const campaign = await campaignRepository.findById(campaignId);

  if (!campaign) {
    throw new AppError(
      "Campaign not found",
      404,
      "CAMPAIGN_NOT_FOUND"
    );
  }

  if (campaign.status !== "draft") {
    throw new AppError(
      "Only draft campaigns can be scheduled",
      409,
      "INVALID_CAMPAIGN_STATE"
    );
  }

  const now = new Date();

  if (campaign.endsAt <= campaign.startsAt) {
    throw new AppError(
      "Campaign end date must be after start date",
      400,
      "INVALID_CAMPAIGN_DATES"
    );
  }

  const status = campaign.startsAt <= now ? "active" : "scheduled";

  if (status === "active") {
    return campaignAutomationService.activateCampaignWithCoupons(
      campaignId
    );
  }

  return campaignRepository.updateById(campaignId, {
    status: "scheduled",
    isActive: false,
  });
};

module.exports = {
  processCampaignSchedule,
  scheduleCampaign,
};