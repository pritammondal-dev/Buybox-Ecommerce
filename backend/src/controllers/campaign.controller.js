const campaignService = require("../services/campaign.service");
const campaignAutomationService = require("../services/campaign-automation.service");
const apiResponse = require("../utils/apiResponse");
const campaignSchedulingService = require("../services/campaign-scheduling.service");

const createCampaign = async (req, res, next) => {
  try {
    let campaign;
    if (req.body.duplicateFrom) {
      campaign = await campaignService.duplicateCampaign(req.body.duplicateFrom);
    } else {
      campaign = await campaignService.createCampaign(req.body);
    }

    return apiResponse.sendSuccess(res, {
      statusCode: 201,
      message: req.body.duplicateFrom
        ? "Campaign duplicated successfully"
        : "Campaign created successfully",
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
    const result = await campaignService.getCampaigns(req.query);

    return apiResponse.sendSuccess(res, {
      message: "Campaigns retrieved successfully",
      data: result,
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
const Product = require("../models/Product");
const Category = require("../models/Category");

const getActiveCampaigns = async (req, res, next) => {
  try {
    const now = new Date();
    const rawCampaigns = await Campaign.find({
      status: "active",
      isActive: true,
      startsAt: { $lte: now },
      endsAt: { $gte: now },
    })
      .populate("productIds", "name slug price compareAtPrice images ratingAverage stockStatus")
      .populate("categoryIds", "name slug")
      .populate("couponIds", "code discountAmount discountType minOrderAmount")
      .populate("discountIds", "name discountType value")
      .sort({ startsAt: -1 })
      .lean();

    const campaigns = await Promise.all(
      rawCampaigns.map(async (camp) => {
        const validProducts = Array.isArray(camp.productIds)
          ? camp.productIds.filter((p) => p && (p._id || p.id))
          : [];

        let productCount = validProducts.length;

        if (
          camp.scope === "categories" &&
          Array.isArray(camp.categoryIds) &&
          camp.categoryIds.length > 0
        ) {
          const catIds = camp.categoryIds.map((c) => (c && c._id ? c._id : c));
          const count = await Product.countDocuments({
            categoryId: { $in: catIds },
            status: "active",
            deletedAt: null,
          });
          productCount = count;
        } else if (camp.scope === "all") {
          const count = await Product.countDocuments({
            status: "active",
            deletedAt: null,
          });
          productCount = count;
        }

        return {
          ...camp,
          productIds: validProducts,
          productCount,
        };
      })
    );

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
    const isPreview = req.query.preview === "true";

    const now = new Date();

    const campaign = await Campaign.findOne({ slug: slug.toLowerCase() })
      .populate("categoryIds", "name slug")
      .populate("couponIds", "code discountAmount discountType minOrderAmount title")
      .populate("discountIds", "name discountType value")
      .lean();

    if (!campaign) {
      return res.status(404).json({ success: false, message: "Campaign not found" });
    }

    // Public storefront visibility check:
    // A campaign is publicly visible only if it is active, published (isActive === true),
    // and currently within its scheduled active window (startsAt <= now <= endsAt).
    // Drafts, scheduled future events, expired events, paused, cancelled, or archived
    // campaigns return 404 to public visitors unless preview is authorized by staff.
    const isPubliclyActive =
      campaign.status === "active" &&
      campaign.isActive === true &&
      new Date(campaign.startsAt) <= now &&
      new Date(campaign.endsAt) >= now;

    // Administrative preview authorization:
    // Query param `preview=true` is only honored if the requester has verified staff credentials.
    const isAuthorizedStaff = Boolean(
      req.user &&
        (req.user.context === "administrator" ||
          ["superadmin", "admin", "editor"].includes(req.user.role) ||
          Boolean(req.user.employee))
    );

    if (!isPubliclyActive && (!isPreview || !isAuthorizedStaff)) {
      return res.status(404).json({
        success: false,
        message: "Campaign not found or not currently active",
      });
    }

    // Resolve products according to campaign scope
    let resolvedProducts = [];

    if (campaign.scope === "products") {
      if (Array.isArray(campaign.productIds) && campaign.productIds.length > 0) {
        const rawIds = campaign.productIds
          .map((p) => (p && p._id ? p._id : p))
          .filter(Boolean);

        resolvedProducts = await Product.find({
          _id: { $in: rawIds },
          status: "active",
          deletedAt: null,
        })
          .select("name slug price compareAtPrice images ratingAverage stockStatus description categoryId brandId")
          .populate("categoryId", "name slug")
          .lean();

        // Preserve specified campaign product ordering
        const idOrder = new Map(rawIds.map((id, index) => [id.toString(), index]));
        resolvedProducts.sort(
          (a, b) =>
            (idOrder.get(a._id.toString()) ?? 999) -
            (idOrder.get(b._id.toString()) ?? 999)
        );
      }
    } else if (campaign.scope === "categories") {
      if (Array.isArray(campaign.categoryIds) && campaign.categoryIds.length > 0) {
        const rawCatIds = campaign.categoryIds
          .map((c) => (c && c._id ? c._id : c))
          .filter(Boolean);

        resolvedProducts = await Product.find({
          categoryId: { $in: rawCatIds },
          status: "active",
          deletedAt: null,
        })
          .select("name slug price compareAtPrice images ratingAverage stockStatus description categoryId brandId")
          .populate("categoryId", "name slug")
          .sort({ createdAt: -1 })
          .lean();
      }
    } else if (campaign.scope === "vendors") {
      if (Array.isArray(campaign.vendorIds) && campaign.vendorIds.length > 0) {
        const rawVendorIds = campaign.vendorIds
          .map((v) => (v && v._id ? v._id : v))
          .filter(Boolean);

        resolvedProducts = await Product.find({
          vendorId: { $in: rawVendorIds },
          status: "active",
          deletedAt: null,
        })
          .select("name slug price compareAtPrice images ratingAverage stockStatus description categoryId brandId")
          .populate("categoryId", "name slug")
          .sort({ createdAt: -1 })
          .lean();
      }
    } else {
      // scope === "all"
      resolvedProducts = await Product.find({
        status: "active",
        deletedAt: null,
      })
        .select("name slug price compareAtPrice images ratingAverage stockStatus description categoryId brandId")
        .populate("categoryId", "name slug")
        .sort({ isFeatured: -1, createdAt: -1 })
        .limit(48)
        .lean();
    }

    // Normalize Decimal128 prices to numbers for clean JSON serialization
    resolvedProducts = resolvedProducts.map((p) => ({
      ...p,
      price: p.price ? Number(p.price.toString()) : 0,
      compareAtPrice: p.compareAtPrice ? Number(p.compareAtPrice.toString()) : null,
    }));

    campaign.productIds = resolvedProducts;
    campaign.products = resolvedProducts;

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