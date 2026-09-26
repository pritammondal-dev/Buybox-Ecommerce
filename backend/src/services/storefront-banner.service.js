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

  const banner =
    await storefrontBannerRepository.findById(bannerId);

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
};

const listBanners = async (filter = {}) => {
  const query = { ...filter };
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

const updateBanner = async (bannerId, data, actorId = null, req = null) => {
  const before = await getBannerById(bannerId);

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

  return storefrontBannerRepository.updateById(
    bannerId,
    update
  );
};

const deleteBanner = async (bannerId, actorId = null, req = null) => {
  await getBannerById(bannerId);

  await storefrontBannerRepository.deleteById(bannerId);

  return {
    id: bannerId,
  };
};

module.exports = {
  createBanner,
  listBanners,
  listActiveBanners,
  getBannerById,
  updateBanner,
  deleteBanner,
};