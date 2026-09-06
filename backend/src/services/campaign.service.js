const mongoose = require("mongoose");

const campaignRepository = require("../repositories/campaign.repository");
const AppError = require("../errors/AppError");

const CAMPAIGN_STATUSES = Object.freeze([
  "draft",
  "scheduled",
  "active",
  "paused",
  "completed",
  "cancelled",
]);

const validateObjectId = (value, fieldName) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(
      `Invalid ${fieldName}`,
      400,
      `INVALID_${fieldName.toUpperCase()}`
    );
  }
};

const createCampaign = async (data) => {
  const existing = await campaignRepository.findBySlug(data.slug);

  if (existing) {
    throw new AppError(
      "Campaign slug already exists",
      409,
      "CAMPAIGN_SLUG_EXISTS"
    );
  }

  return campaignRepository.create({
    ...data,
    slug: data.slug.toLowerCase().trim(),
  });
};

const getCampaignById = async (campaignId) => {
  validateObjectId(campaignId, "campaign ID");

  const campaign = await campaignRepository.findById(campaignId);

  if (!campaign) {
    throw new AppError(
      "Campaign not found",
      404,
      "CAMPAIGN_NOT_FOUND"
    );
  }

  return campaign;
};

const getCampaigns = async (filter = {}) => {
  return campaignRepository.findMany(filter);
};

const updateCampaign = async (campaignId, data) => {
  validateObjectId(campaignId, "campaign ID");

  const campaign = await getCampaignById(campaignId);

  if (data.slug && data.slug !== campaign.slug) {
    const existing = await campaignRepository.findBySlug(
      data.slug.toLowerCase().trim()
    );

    if (existing && existing._id.toString() !== campaignId.toString()) {
      throw new AppError(
        "Campaign slug already exists",
        409,
        "CAMPAIGN_SLUG_EXISTS"
      );
    }

    data.slug = data.slug.toLowerCase().trim();
  }

  const updated = await campaignRepository.updateById(campaignId, data);

  if (!updated) {
    throw new AppError(
      "Campaign not found",
      404,
      "CAMPAIGN_NOT_FOUND"
    );
  }

  return updated;
};

const activateCampaign = async (campaignId) => {
  validateObjectId(campaignId, "campaign ID");

  const campaign = await getCampaignById(campaignId);

  if (campaign.status === "cancelled" || campaign.status === "completed") {
    throw new AppError(
      "Campaign cannot be activated from its current state",
      409,
      "INVALID_CAMPAIGN_STATE"
    );
  }

  return campaignRepository.updateById(campaignId, {
    status: "active",
    isActive: true,
  });
};

const deactivateCampaign = async (campaignId) => {
  validateObjectId(campaignId, "campaign ID");

  await getCampaignById(campaignId);

  return campaignRepository.updateById(campaignId, {
    status: "paused",
    isActive: false,
  });
};

const transitionCampaignStatus = async (campaignId, status) => {
  validateObjectId(campaignId, "campaign ID");

  if (!CAMPAIGN_STATUSES.includes(status)) {
    throw new AppError(
      "Invalid campaign status",
      400,
      "INVALID_CAMPAIGN_STATUS"
    );
  }

  const campaign = await getCampaignById(campaignId);

  if (campaign.status === status) {
    return campaign;
  }

  const allowedTransitions = {
    draft: ["scheduled", "active", "cancelled"],
    scheduled: ["active", "cancelled"],
    active: ["paused", "completed", "cancelled"],
    paused: ["active", "cancelled"],
    completed: [],
    cancelled: [],
  };

  if (!allowedTransitions[campaign.status].includes(status)) {
    throw new AppError(
      `Cannot transition campaign from ${campaign.status} to ${status}`,
      409,
      "INVALID_CAMPAIGN_TRANSITION"
    );
  }

  return campaignRepository.updateById(campaignId, {
    status,
    isActive: status === "active",
  });
};

module.exports = {
  createCampaign,
  getCampaignById,
  getCampaigns,
  updateCampaign,
  activateCampaign,
  deactivateCampaign,
  transitionCampaignStatus,
};