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
  "archived",
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

  const isActive =
    data.isActive !== undefined
      ? Boolean(data.isActive)
      : data.status === "active";

  return campaignRepository.create({
    ...data,
    slug: data.slug.toLowerCase().trim(),
    isActive,
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

const getCampaigns = async (query = {}) => {
  const Campaign = require("../models/Campaign");

  // Build query filter
  const queryFilter = {};

  // 1. Text Search across name, slug, description
  if (query.search && typeof query.search === "string" && query.search.trim()) {
    const searchRegex = new RegExp(query.search.trim(), "i");
    queryFilter.$or = [
      { name: searchRegex },
      { slug: searchRegex },
      { description: searchRegex },
    ];
  }

  // 2. Status filter
  if (query.status && query.status !== "all") {
    queryFilter.status = query.status;
  }

  // 3. Scope filter
  if (query.scope && query.scope !== "all") {
    queryFilter.scope = query.scope;
  }

  // 4. Type filter
  if (query.type && query.type !== "all") {
    queryFilter.type = query.type;
  }

  // 5. Date filters
  if (query.startDate) {
    const start = new Date(query.startDate);
    if (!isNaN(start.getTime())) {
      queryFilter.startsAt = { $gte: start };
    }
  }
  if (query.endDate) {
    const end = new Date(query.endDate);
    if (!isNaN(end.getTime())) {
      queryFilter.endsAt = { ...queryFilter.endsAt, $lte: end };
    }
  }

  // Aggregate live statistics
  const allCampaigns = await Campaign.find({}).lean();
  const stats = {
    total: allCampaigns.length,
    active: allCampaigns.filter((c) => c.status === "active").length,
    scheduled: allCampaigns.filter((c) => c.status === "scheduled").length,
    draft: allCampaigns.filter((c) => c.status === "draft").length,
    paused: allCampaigns.filter((c) => c.status === "paused").length,
    completed: allCampaigns.filter((c) => c.status === "completed").length,
    archived: allCampaigns.filter((c) => c.status === "archived").length,
  };

  // If pagination requested
  if (query.paginate === "true" || query.page || query.limit) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const total = await Campaign.countDocuments(queryFilter);
    const campaigns = await Campaign.find(queryFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("couponIds", "code discountAmount discountType minOrderAmount")
      .populate("discountIds", "name discountType value");

    return {
      campaigns,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
      stats,
    };
  }

  // Unpaginated backward compatibility
  const campaigns = await Campaign.find(queryFilter)
    .sort({ createdAt: -1 })
    .populate("couponIds", "code discountAmount discountType minOrderAmount")
    .populate("discountIds", "name discountType value");

  campaigns.stats = stats;
  campaigns.pagination = {
    total: campaigns.length,
    page: 1,
    limit: campaigns.length,
    totalPages: 1,
  };

  return campaigns;
};

const duplicateCampaign = async (campaignId) => {
  validateObjectId(campaignId, "campaign ID");
  const original = await getCampaignById(campaignId);

  let copySlug = `${original.slug}-copy`;
  let counter = 1;
  while (await campaignRepository.findBySlug(copySlug)) {
    counter++;
    copySlug = `${original.slug}-copy-${counter}`;
  }

  const now = new Date();
  const nextWeek = new Date(Date.now() + 7 * 86400000);

  const duplicateData = {
    name: `${original.name} (Copy)`,
    slug: copySlug,
    description: original.description || null,
    type: original.type || "general",
    timezone: original.timezone || "Asia/Kolkata",
    bannerUrl: original.bannerUrl || null,
    mobileBannerUrl: original.mobileBannerUrl || null,
    destinationUrl: original.destinationUrl || null,
    scope: original.scope || "all",
    productIds: original.productIds || [],
    categoryIds: original.categoryIds || [],
    vendorIds: original.vendorIds || [],
    couponIds: original.couponIds || [],
    discountIds: original.discountIds || [],
    metadata: original.metadata || {},
    status: "draft",
    isActive: false,
    startsAt: now,
    endsAt: nextWeek,
  };

  return campaignRepository.create(duplicateData);
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

  if (data.status !== undefined && data.isActive === undefined) {
    data.isActive = data.status === "active";
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

  if (
    campaign.status === "cancelled" ||
    campaign.status === "completed" ||
    campaign.status === "archived"
  ) {
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

const archiveCampaign = async (campaignId) => {
  return transitionCampaignStatus(campaignId, "archived");
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
    draft: ["scheduled", "active", "cancelled", "archived"],
    scheduled: ["active", "paused", "cancelled", "archived"],
    active: ["paused", "completed", "cancelled", "archived"],
    paused: ["active", "cancelled", "archived"],
    completed: ["archived"],
    cancelled: ["archived"],
    archived: [],
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
  duplicateCampaign,
  getCampaignById,
  getCampaigns,
  updateCampaign,
  activateCampaign,
  deactivateCampaign,
  archiveCampaign,
  transitionCampaignStatus,
};