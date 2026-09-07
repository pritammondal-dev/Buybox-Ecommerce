const storefrontMediaService = require("../services/storefront-media.service");
const { sendSuccess } = require("../utils/apiResponse");

const getMediaById = async (req, res, next) => {
  try {
    const media =
      await storefrontMediaService.getMediaById(
        req.params.mediaId
      );

    return sendSuccess(res, {
      message:
        "Storefront media fetched successfully",
      data: media,
    });
  } catch (error) {
    next(error);
  }
};

const getActiveMedia = async (req, res, next) => {
  try {
    const media =
      await storefrontMediaService.getActiveMedia();

    return sendSuccess(res, {
      message:
        "Active storefront media fetched successfully",
      data: media,
    });
  } catch (error) {
    next(error);
  }
};

const listMedia = async (req, res, next) => {
  try {
    const media =
      await storefrontMediaService.listMedia(
        req.query
      );

    return sendSuccess(res, {
      message:
        "Storefront media fetched successfully",
      data: media,
    });
  } catch (error) {
    next(error);
  }
};

const createMedia = async (req, res, next) => {
  try {
    const media =
      await storefrontMediaService.createMedia(
        req.body,
        req.user.id
      );

    return sendSuccess(res, {
      statusCode: 201,
      message:
        "Storefront media created successfully",
      data: media,
    });
  } catch (error) {
    next(error);
  }
};

const updateMedia = async (req, res, next) => {
  try {
    const media =
      await storefrontMediaService.updateMedia(
        req.params.mediaId,
        req.body,
        req.user.id
      );

    return sendSuccess(res, {
      message:
        "Storefront media updated successfully",
      data: media,
    });
  } catch (error) {
    next(error);
  }
};

const deleteMedia = async (req, res, next) => {
  try {
    const result =
      await storefrontMediaService.deleteMedia(
        req.params.mediaId
      );

    return sendSuccess(res, {
      message:
        "Storefront media deleted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMediaById,
  getActiveMedia,
  listMedia,
  createMedia,
  updateMedia,
  deleteMedia,
};