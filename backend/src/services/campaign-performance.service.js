const mongoose = require("mongoose");

const campaignPerformanceRepository = require("../repositories/campaign-performance.repository");
const campaignRepository = require("../repositories/campaign.repository");
const AppError = require("../errors/AppError");

const validateObjectId = (value, fieldName) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(
      `Invalid ${fieldName}`,
      400,
      `INVALID_${fieldName.toUpperCase()}`
    );
  }
};

const normalizeDate = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AppError(
      "Invalid performance date",
      400,
      "INVALID_PERFORMANCE_DATE"
    );
  }

  date.setUTCHours(0, 0, 0, 0);

  return date;
};

const getCampaignPerformanceById = async (performanceId) => {
  validateObjectId(performanceId, "performance ID");

  const performance =
    await campaignPerformanceRepository.findById(performanceId);

  if (!performance) {
    throw new AppError(
      "Campaign performance record not found",
      404,
      "CAMPAIGN_PERFORMANCE_NOT_FOUND"
    );
  }

  return performance;
};

const getCampaignPerformance = async (campaignId, date) => {
  validateObjectId(campaignId, "campaign ID");

  const campaign = await campaignRepository.findById(campaignId);

  if (!campaign) {
    throw new AppError(
      "Campaign not found",
      404,
      "CAMPAIGN_NOT_FOUND"
    );
  }

  return campaignPerformanceRepository.findMany({
    campaignId,
    ...(date ? { date: normalizeDate(date) } : {}),
  });
};

const recordDailyPerformance = async ({
  campaignId,
  couponId = null,
  date = new Date(),
  currency = "INR",
  impressions = 0,
  redemptions = 0,
  orders = 0,
  unitsSold = 0,
  grossRevenue = "0.00",
  discountAmount = "0.00",
  netRevenue = "0.00",
  metadata = {},
}) => {
  validateObjectId(campaignId, "campaign ID");

  if (couponId !== null) {
    validateObjectId(couponId, "coupon ID");
  }

  const campaign = await campaignRepository.findById(campaignId);

  if (!campaign) {
    throw new AppError(
      "Campaign not found",
      404,
      "CAMPAIGN_NOT_FOUND"
    );
  }

  const normalizedDate = normalizeDate(date);

  const existing =
    await campaignPerformanceRepository.findByCampaignAndDate(
      campaignId,
      normalizedDate
    );

  if (existing) {
    return existing;
  }

  try {
    return await campaignPerformanceRepository.create({
      campaignId,
      couponId,
      date: normalizedDate,
      currency: currency.toUpperCase(),
      impressions,
      redemptions,
      orders,
      unitsSold,
      grossRevenue,
      discountAmount,
      netRevenue,
      metadata,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return campaignPerformanceRepository.findByCampaignAndDate(
        campaignId,
        normalizedDate
      );
    }

    throw error;
  }
};

const incrementDailyPerformance = async ({
  performanceId,
  impressions = 0,
  redemptions = 0,
  orders = 0,
  unitsSold = 0,
}) => {
  validateObjectId(performanceId, "performance ID");

  const performance =
    await campaignPerformanceRepository.incrementMetrics(
      performanceId,
      {
        impressions,
        redemptions,
        orders,
        unitsSold,
      }
    );

  if (!performance) {
    throw new AppError(
      "Campaign performance record not found",
      404,
      "CAMPAIGN_PERFORMANCE_NOT_FOUND"
    );
  }

  return performance;
};

module.exports = {
  getCampaignPerformanceById,
  getCampaignPerformance,
  recordDailyPerformance,
  incrementDailyPerformance,
};