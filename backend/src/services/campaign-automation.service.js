const mongoose = require("mongoose");

const campaignRepository = require("../repositories/campaign.repository");
const couponRepository = require("../repositories/coupon.repository");
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

const activateLinkedCoupons = async (campaign, options = {}) => {
  if (!campaign.couponIds || campaign.couponIds.length === 0) {
    return [];
  }

  const activatedCoupons = [];

  for (const couponId of campaign.couponIds) {
    const coupon = await couponRepository.findById(couponId, options);

    if (!coupon) {
      continue;
    }

    if (coupon.status === "active" && coupon.isActive) {
      activatedCoupons.push(coupon);
      continue;
    }

    const updatedCoupon = await couponRepository.updateById(
      couponId,
      {
        status: "active",
        isActive: true,
      },
      options
    );

    if (updatedCoupon) {
      activatedCoupons.push(updatedCoupon);
    }
  }

  return activatedCoupons;
};

const deactivateLinkedCoupons = async (campaign, options = {}) => {
  if (!campaign.couponIds || campaign.couponIds.length === 0) {
    return [];
  }

  const deactivatedCoupons = [];

  for (const couponId of campaign.couponIds) {
    const coupon = await couponRepository.findById(couponId, options);

    if (!coupon) {
      continue;
    }

    if (!coupon.isActive) {
      deactivatedCoupons.push(coupon);
      continue;
    }

    const updatedCoupon = await couponRepository.updateById(
      couponId,
      {
        status: "inactive",
        isActive: false,
      },
      options
    );

    if (updatedCoupon) {
      deactivatedCoupons.push(updatedCoupon);
    }
  }

  return deactivatedCoupons;
};

const activateCampaignWithCoupons = async (campaignId) => {
  validateObjectId(campaignId, "campaign ID");

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const campaign = await campaignRepository.findById(campaignId, {
        session,
      });

      if (!campaign) {
        throw new AppError(
          "Campaign not found",
          404,
          "CAMPAIGN_NOT_FOUND"
        );
      }

      if (
        campaign.status === "cancelled" ||
        campaign.status === "completed"
      ) {
        throw new AppError(
          "Campaign cannot be activated from its current state",
          409,
          "INVALID_CAMPAIGN_STATE"
        );
      }

      const updatedCampaign = await campaignRepository.updateById(
        campaignId,
        {
          status: "active",
          isActive: true,
        },
        { session }
      );

      const coupons = await activateLinkedCoupons(
        updatedCampaign,
        { session }
      );

      result = {
        campaign: updatedCampaign,
        coupons,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
};

const expireCampaign = async (campaignId) => {
  validateObjectId(campaignId, "campaign ID");

  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      const campaign = await campaignRepository.findById(campaignId, {
        session,
      });

      if (!campaign) {
        throw new AppError(
          "Campaign not found",
          404,
          "CAMPAIGN_NOT_FOUND"
        );
      }

      const updatedCampaign = await campaignRepository.updateById(
        campaignId,
        {
          status: "completed",
          isActive: false,
        },
        { session }
      );

      const coupons = await deactivateLinkedCoupons(
        campaign,
        { session }
      );

      result = {
        campaign: updatedCampaign,
        coupons,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  activateCampaignWithCoupons,
  expireCampaign,
  activateLinkedCoupons,
  deactivateLinkedCoupons,
};