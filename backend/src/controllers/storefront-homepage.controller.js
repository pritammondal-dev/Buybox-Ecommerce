const storefrontHomepageService = require("../services/storefront-homepage.service");
const { sendSuccess } = require("../utils/apiResponse");

const getHomepageById = async (req, res, next) => {
  try {
    const homepage =
      await storefrontHomepageService.getHomepageById(
        req.params.homepageId
      );

    return sendSuccess(res, {
      message:
        "Storefront homepage fetched successfully",
      data: homepage,
    });
  } catch (error) {
    next(error);
  }
};

const getHomepageByKey = async (req, res, next) => {
  try {
    const homepage =
      await storefrontHomepageService.getHomepageByKey(
        req.params.key
      );

    return sendSuccess(res, {
      message:
        "Storefront homepage fetched successfully",
      data: homepage,
    });
  } catch (error) {
    next(error);
  }
};

const getActiveHomepage = async (req, res, next) => {
  try {
    const homepage =
      await storefrontHomepageService.getActiveHomepage(
        req.params.key
      );

    return sendSuccess(res, {
      message:
        "Active storefront homepage fetched successfully",
      data: homepage,
    });
  } catch (error) {
    next(error);
  }
};

const listHomepages = async (req, res, next) => {
  try {
    const homepages =
      await storefrontHomepageService.listHomepages(
        req.query
      );

    return sendSuccess(res, {
      message:
        "Storefront homepages fetched successfully",
      data: homepages,
    });
  } catch (error) {
    next(error);
  }
};

const createHomepage = async (req, res, next) => {
  try {
    const homepage =
      await storefrontHomepageService.createHomepage(
        req.body,
        req.user.id
      );

    return sendSuccess(res, {
      statusCode: 201,
      message:
        "Storefront homepage created successfully",
      data: homepage,
    });
  } catch (error) {
    next(error);
  }
};

const updateHomepage = async (req, res, next) => {
  try {
    const homepage =
      await storefrontHomepageService.updateHomepage(
        req.params.homepageId,
        req.body,
        req.user.id
      );

    return sendSuccess(res, {
      message:
        "Storefront homepage updated successfully",
      data: homepage,
    });
  } catch (error) {
    next(error);
  }
};

const deleteHomepage = async (req, res, next) => {
  try {
    const result =
      await storefrontHomepageService.deleteHomepage(
        req.params.homepageId
      );

    return sendSuccess(res, {
      message:
        "Storefront homepage deleted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHomepageById,
  getHomepageByKey,
  getActiveHomepage,
  listHomepages,
  createHomepage,
  updateHomepage,
  deleteHomepage,
};