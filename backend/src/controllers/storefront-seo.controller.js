const storefrontSeoService = require("../services/storefront-seo.service");
const { sendSuccess } = require("../utils/apiResponse");

const getActiveSeo = async (req, res, next) => {
  try {
    const seo = await storefrontSeoService.getActiveSeo();

    return sendSuccess(res, {
      message: "Storefront SEO settings fetched successfully",
      data: seo,
    });
  } catch (error) {
    next(error);
  }
};

const getSeoById = async (req, res, next) => {
  try {
    const seo = await storefrontSeoService.getSeoById(
      req.params.seoId
    );

    return sendSuccess(res, {
      message: "Storefront SEO settings fetched successfully",
      data: seo,
    });
  } catch (error) {
    next(error);
  }
};

const createSeo = async (req, res, next) => {
  try {
    const seo = await storefrontSeoService.createSeo(
      req.body,
      req.user.id
    );

    return sendSuccess(res, {
      statusCode: 201,
      message: "Storefront SEO settings created successfully",
      data: seo,
    });
  } catch (error) {
    next(error);
  }
};

const updateSeo = async (req, res, next) => {
  try {
    const seo = await storefrontSeoService.updateSeo(
      req.params.seoId,
      req.body,
      req.user.id
    );

    return sendSuccess(res, {
      message: "Storefront SEO settings updated successfully",
      data: seo,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActiveSeo,
  getSeoById,
  createSeo,
  updateSeo,
};
