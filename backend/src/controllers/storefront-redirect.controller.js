const storefrontRedirectService = require("../services/storefront-redirect.service");
const { sendSuccess } = require("../utils/apiResponse");

const getRedirectById = async (req, res, next) => {
  try {
    const redirect =
      await storefrontRedirectService.getRedirectById(
        req.params.redirectId
      );

    return sendSuccess(res, {
      message: "Storefront redirect fetched successfully",
      data: redirect,
    });
  } catch (error) {
    next(error);
  }
};

const getActiveRedirect = async (req, res, next) => {
  try {
    const redirect =
      await storefrontRedirectService.getActiveRedirect(
        req.query.sourcePath
      );

    if (!redirect) {
      return res.status(404).end();
    }

    return res.redirect(
      redirect.statusCode,
      redirect.destinationPath
    );
  } catch (error) {
    next(error);
  }
};

const listRedirects = async (req, res, next) => {
  try {
    const redirects =
      await storefrontRedirectService.listRedirects(
        req.query
      );

    return sendSuccess(res, {
      message: "Storefront redirects fetched successfully",
      data: redirects,
    });
  } catch (error) {
    next(error);
  }
};

const createRedirect = async (req, res, next) => {
  try {
    const redirect =
      await storefrontRedirectService.createRedirect(
        req.body,
        req.user.id
      );

    return sendSuccess(res, {
      statusCode: 201,
      message: "Storefront redirect created successfully",
      data: redirect,
    });
  } catch (error) {
    next(error);
  }
};

const updateRedirect = async (req, res, next) => {
  try {
    const redirect =
      await storefrontRedirectService.updateRedirect(
        req.params.redirectId,
        req.body,
        req.user.id
      );

    return sendSuccess(res, {
      message: "Storefront redirect updated successfully",
      data: redirect,
    });
  } catch (error) {
    next(error);
  }
};

const deleteRedirect = async (req, res, next) => {
  try {
    const result =
      await storefrontRedirectService.deleteRedirect(
        req.params.redirectId
      );

    return sendSuccess(res, {
      message: "Storefront redirect deleted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRedirectById,
  getActiveRedirect,
  listRedirects,
  createRedirect,
  updateRedirect,
  deleteRedirect,
};

