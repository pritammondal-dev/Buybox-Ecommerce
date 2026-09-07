const storefrontBannerService = require("../services/storefront-banner.service");
const { sendSuccess } = require("../utils/apiResponse");

const createBanner = async (req, res, next) => {
  try {
    const banner = await storefrontBannerService.createBanner({
      ...req.body,
      userId: req.user.id,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: "Storefront banner created successfully",
      data: banner,
    });
  } catch (error) {
    next(error);
  }
};

const listBanners = async (req, res, next) => {
  try {
    const banners =
      await storefrontBannerService.listBanners(req.query);

    return sendSuccess(res, {
      message: "Storefront banners fetched successfully",
      data: banners,
    });
  } catch (error) {
    next(error);
  }
};

const listActiveBanners = async (req, res, next) => {
  try {
    const banners =
      await storefrontBannerService.listActiveBanners();

    return sendSuccess(res, {
      message: "Active storefront banners fetched successfully",
      data: banners,
    });
  } catch (error) {
    next(error);
  }
};

const getBannerById = async (req, res, next) => {
  try {
    const banner =
      await storefrontBannerService.getBannerById(
        req.params.bannerId
      );

    return sendSuccess(res, {
      message: "Storefront banner fetched successfully",
      data: banner,
    });
  } catch (error) {
    next(error);
  }
};

const updateBanner = async (req, res, next) => {
  try {
    const banner =
      await storefrontBannerService.updateBanner(
        req.params.bannerId,
        req.body
      );

    return sendSuccess(res, {
      message: "Storefront banner updated successfully",
      data: banner,
    });
  } catch (error) {
    next(error);
  }
};

const deleteBanner = async (req, res, next) => {
  try {
    const result =
      await storefrontBannerService.deleteBanner(
        req.params.bannerId
      );

    return sendSuccess(res, {
      message: "Storefront banner deleted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBanner,
  listBanners,
  listActiveBanners,
  getBannerById,
  updateBanner,
  deleteBanner,
};