const campaignService = require("../services/campaign.service");
const campaignAutomationService = require("../services/campaign-automation.service");
const apiResponse = require("../utils/apiResponse");

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

module.exports = {
  createCampaign,
  getCampaignById,
  getCampaigns,
  updateCampaign,
  activateCampaign,
  deactivateCampaign,
  transitionCampaignStatus,
};