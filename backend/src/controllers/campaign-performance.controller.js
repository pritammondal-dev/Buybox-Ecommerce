const campaignPerformanceService = require("../services/campaign-performance.service");
const apiResponse = require("../utils/apiResponse");

const getCampaignPerformanceById = async (req, res, next) => {
  try {
    const performance =
      await campaignPerformanceService.getCampaignPerformanceById(
        req.params.performanceId
      );

    return apiResponse.sendSuccess(res, {
      message: "Campaign performance retrieved successfully",
      data: performance,
    });
  } catch (error) {
    next(error);
  }
};

const getCampaignPerformance = async (req, res, next) => {
  try {
    const performance =
      await campaignPerformanceService.getCampaignPerformance(
        req.params.campaignId,
        req.query.date
      );

    return apiResponse.sendSuccess(res, {
      message: "Campaign performance retrieved successfully",
      data: performance,
    });
  } catch (error) {
    next(error);
  }
};

const recordDailyPerformance = async (req, res, next) => {
  try {
    const performance =
      await campaignPerformanceService.recordDailyPerformance({
        campaignId: req.params.campaignId,
        ...req.body,
      });

    return apiResponse.sendSuccess(res, {
      statusCode: 201,
      message: "Campaign performance recorded successfully",
      data: performance,
    });
  } catch (error) {
    next(error);
  }
};

const incrementDailyPerformance = async (req, res, next) => {
  try {
    const performance =
      await campaignPerformanceService.incrementDailyPerformance({
        performanceId: req.params.performanceId,
        ...req.body,
      });

    return apiResponse.sendSuccess(res, {
      message: "Campaign performance updated successfully",
      data: performance,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCampaignPerformanceById,
  getCampaignPerformance,
  recordDailyPerformance,
  incrementDailyPerformance,
};