const mongoose = require("mongoose");

const storefrontBannerRepository = require("../repositories/storefront-banner.repository");
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

  return storefrontBannerRepository.create({
    title,
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
  return storefrontBannerRepository.findMany(filter);
};

const listActiveBanners = async () => {
  const now = new Date();

  return storefrontBannerRepository.findMany({
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
  });
};

const updateBanner = async (bannerId, data) => {
  await getBannerById(bannerId);

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

  return storefrontBannerRepository.updateById(
    bannerId,
    update
  );
};

const deleteBanner = async (bannerId) => {
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