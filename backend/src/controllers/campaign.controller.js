const campaignService = require("../services/campaign.service");
const campaignAutomationService = require("../services/campaign-automation.service");
const apiResponse = require("../utils/apiResponse");
const campaignSchedulingService = require("../services/campaign-scheduling.service");

const createCampaign = async (req, res, next) => {
  try {
    const campaign = await campaignService.createCampaign(req.body);

    return apiResponse.sendSuccess(res, {
      statusCode: 201,
      message: "Campaign created successfully",
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
};

const getCampaignById = async (req, res, next) => {
  try {
    const campaign = await campaignService.getCampaignById(
      req.params.campaignId
    );

    return apiResponse.sendSuccess(res, {
      message: "Campaign retrieved successfully",
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
};

const getCampaigns = async (req, res, next) => {
  try {
    const campaigns = await campaignService.getCampaigns(req.query);

    return apiResponse.sendSuccess(res, {
      message: "Campaigns retrieved successfully",
      data: campaigns,
    });
  } catch (error) {
    next(error);
  }
};

const updateCampaign = async (req, res, next) => {
  try {
    const campaign = await campaignService.updateCampaign(
      req.params.campaignId,
      req.body
    );

    return apiResponse.sendSuccess(res, {
      message: "Campaign updated successfully",
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
};

const activateCampaign = async (req, res, next) => {
  try {
    const result =
      await campaignAutomationService.activateCampaignWithCoupons(
        req.params.campaignId
      );

    return apiResponse.sendSuccess(res, {
      message: "Campaign activated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const deactivateCampaign = async (req, res, next) => {
  try {
    const campaign = await campaignService.deactivateCampaign(
      req.params.campaignId
    );

    return apiResponse.sendSuccess(res, {
      message: "Campaign deactivated successfully",
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
};

const transitionCampaignStatus = async (req, res, next) => {
  try {
    const campaign = await campaignService.transitionCampaignStatus(
      req.params.campaignId,
      req.body.status
    );

    return apiResponse.sendSuccess(res, {
      message: "Campaign status updated successfully",
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
};

const scheduleCampaign = async (req, res, next) => {
  try {
    const result = await campaignSchedulingService.scheduleCampaign(
      req.params.campaignId
    );

    return apiResponse.sendSuccess(res, {
      message: "Campaign scheduled successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const Campaign = require("../models/Campaign");

const getActiveCampaigns = async (req, res, next) => {
  try {
    const now = new Date();
    const campaigns = await Campaign.find({
      status: "active",
      isActive: true,
      startsAt: { $lte: now },
      endsAt: { $gte: now },
    })
      .populate("productIds", "name slug price compareAtPrice images ratingAverage stockStatus")
      .populate("couponIds", "code discountAmount discountType minOrderAmount")
      .sort({ startsAt: -1 })
      .lean();

    return apiResponse.sendSuccess(res, {
      message: "Active campaigns retrieved successfully",
      data: campaigns,
    });
  } catch (error) {
    next(error);
  }
};

const getCampaignBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const campaign = await Campaign.findOne({ slug: slug.toLowerCase() })
      .populate("productIds", "name slug price compareAtPrice images ratingAverage stockStatus description")
      .populate("categoryIds", "name slug")
      .populate("couponIds", "code discountAmount discountType minOrderAmount title")
      .lean();

    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    return apiResponse.sendSuccess(res, {
      message: "Campaign retrieved successfully",
      data: campaign,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCampaign,
  getCampaignById,
  getCampaigns,
  updateCampaign,
  activateCampaign,
  deactivateCampaign,
  transitionCampaignStatus,
  scheduleCampaign,
  getActiveCampaigns,
  getCampaignBySlug,
};