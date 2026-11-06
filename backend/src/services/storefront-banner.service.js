const mongoose = require("mongoose");
const storefrontBannerRepository = require("../repositories/storefront-banner.repository");
const AppError = require("../errors/AppError");
const { recordAuditLog, sanitizeAuditState } = require("./governance.service");

const validateObjectId = (value, fieldName) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(
      `Invalid ${fieldName}`,
      400,
      `INVALID_${fieldName.toUpperCase()}`
    );
  }
};

const getBannerById = async (bannerId) => {
  validateObjectId(bannerId, "banner ID");

  const banner = await storefrontBannerRepository.findById(bannerId);

  if (!banner) {
    throw new AppError(
      "Storefront banner not found",
      404,
      "STOREFRONT_BANNER_NOT_FOUND"
    );
  }

  return banner;
};

const createBanner = async ({
  title,
  subtitle = null,
  ctaText = null,
  badge = null,
  campaignId = null,
  slotKey = null,
  placement = null,
  altText = null,
  imageUrl,
  mobileImageUrl = null,
  linkUrl = null,
  displayOrder = 0,
  isActive = true,
  startsAt = null,
  endsAt = null,
  userId,
}) => {
  validateObjectId(userId, "user ID");

  if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
    throw new AppError(
      "Banner start time must be before end time",
      400,
      "INVALID_BANNER_SCHEDULE"
    );
  }

  const effectiveSlotKey = slotKey || placement || null;

  const created = await storefrontBannerRepository.create({
    title,
    subtitle,
    ctaText,
    badge,
    campaignId,
    slotKey: effectiveSlotKey,
    altText,
    imageUrl,
    mobileImageUrl,
    linkUrl,
    displayOrder,
    isActive,
    startsAt,
    endsAt,
    createdBy: userId,
  });

  await recordAuditLog({
    actorId: userId,
    targetId: created._id,
    action: "CREATE_STOREFRONT_BANNER",
    entityType: "StorefrontBanner",
    beforeState: null,
    afterState: sanitizeAuditState(created),
  }).catch(() => {});

  return created;
};

const listBanners = async (filter = {}) => {
  const query = { deletedAt: null, ...filter };
  if (query.placement && !query.slotKey) {
    query.slotKey = query.placement;
    delete query.placement;
  }
  return storefrontBannerRepository.findMany(query);
};

const listActiveBanners = async (filter = {}) => {
  const now = new Date();

  const query = {
    isActive: true,
    deletedAt: null,
    $or: [
      { startsAt: null },
      { startsAt: { $lte: now } },
    ],
    $and: [
      {
        $or: [
          { endsAt: null },
          { endsAt: { $gte: now } },
        ],
      },
    ],
  };

  const slot = filter.slotKey || filter.placement;
  if (slot) {
    query.slotKey = slot;
  }

  return storefrontBannerRepository.findMany(query);
};

const updateBanner = async (bannerId, data, userId = null) => {
  const current = await getBannerById(bannerId);

  if (data.startsAt && data.endsAt) {
    if (new Date(data.startsAt) >= new Date(data.endsAt)) {
      throw new AppError(
        "Banner start time must be before end time",
        400,
        "INVALID_BANNER_SCHEDULE"
      );
    }
  }

  const update = {};

  const fields = [
    "title",
    "subtitle",
    "ctaText",
    "badge",
    "campaignId",
    "slotKey",
    "altText",
    "imageUrl",
    "mobileImageUrl",
    "linkUrl",
    "displayOrder",
    "isActive",
    "startsAt",
    "endsAt",
  ];

  for (const field of fields) {
    if (data[field] !== undefined) {
      update[field] = data[field];
    }
  }

  if (data.placement !== undefined && data.slotKey === undefined) {
    update.slotKey = data.placement;
  }

  const updated = await storefrontBannerRepository.updateById(bannerId, update);

  if (userId) {
    await recordAuditLog({
      actorId: userId,
      targetId: bannerId,
      action: "UPDATE_STOREFRONT_BANNER",
      entityType: "StorefrontBanner",
      beforeState: sanitizeAuditState(current),
      afterState: sanitizeAuditState(updated),
    }).catch(() => {});
  }

  return updated;
};

const deleteBanner = async (bannerId, userId = null) => {
  const current = await getBannerById(bannerId);

  const deleted = await storefrontBannerRepository.deleteById(bannerId);

  if (userId) {
    await recordAuditLog({
      actorId: userId,
      targetId: bannerId,
      action: "DELETE_STOREFRONT_BANNER",
      entityType: "StorefrontBanner",
      beforeState: sanitizeAuditState(current),
      afterState: sanitizeAuditState(deleted),
    }).catch(() => {});
  }

  return deleted;
};

const getInactiveSlotKeys = async () => {
  const inactive = await storefrontBannerRepository.findMany({
    isActive: false,
    deletedAt: null,
  });
  return [...new Set(inactive.map((b) => b.slotKey).filter(Boolean))];
};

module.exports = {
  getBannerById,
  createBanner,
  listBanners,
  listActiveBanners,
  getInactiveSlotKeys,
  updateBanner,
  deleteBanner,
};