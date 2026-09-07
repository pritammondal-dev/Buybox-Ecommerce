const mongoose = require("mongoose");

const storefrontMediaRepository = require("../repositories/storefront-media.repository");
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

const getMediaById = async (mediaId) => {
  validateObjectId(mediaId, "media ID");

  const media =
    await storefrontMediaRepository.findById(mediaId);

  if (!media) {
    throw new AppError(
      "Storefront media not found",
      404,
      "STOREFRONT_MEDIA_NOT_FOUND"
    );
  }

  return media;
};

const getActiveMedia = async () => {
  return storefrontMediaRepository.findActive();
};

const listMedia = async (filter = {}) => {
  return storefrontMediaRepository.findMany(filter);
};

const createMedia = async (data, userId) => {
  validateObjectId(userId, "user ID");

  return storefrontMediaRepository.create({
    ...data,
    createdBy: userId,
    updatedBy: userId,
  });
};

const updateMedia = async (
  mediaId,
  data,
  userId
) => {
  validateObjectId(userId, "user ID");

  await getMediaById(mediaId);

  return storefrontMediaRepository.updateById(
    mediaId,
    {
      ...data,
      updatedBy: userId,
    }
  );
};

const deleteMedia = async (mediaId) => {
  await getMediaById(mediaId);

  await storefrontMediaRepository.deleteById(
    mediaId
  );

  return {
    id: mediaId,
  };
};

module.exports = {
  getMediaById,
  getActiveMedia,
  listMedia,
  createMedia,
  updateMedia,
  deleteMedia,
};