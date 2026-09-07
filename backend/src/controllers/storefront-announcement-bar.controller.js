const storefrontAnnouncementBarService = require("../services/storefront-announcement-bar.service");
const { sendSuccess } = require("../utils/apiResponse");

const getAnnouncementBarById = async (req, res, next) => {
  try {
    const bar =
      await storefrontAnnouncementBarService.getAnnouncementBarById(
        req.params.barId
      );

    return sendSuccess(res, {
      message:
        "Storefront announcement bar fetched successfully",
      data: bar,
    });
  } catch (error) {
    next(error);
  }
};

const getActiveAnnouncementBars = async (
  req,
  res,
  next
) => {
  try {
    const bars =
      await storefrontAnnouncementBarService.getActiveAnnouncementBars();

    return sendSuccess(res, {
      message:
        "Active storefront announcement bars fetched successfully",
      data: bars,
    });
  } catch (error) {
    next(error);
  }
};

const listAnnouncementBars = async (req, res, next) => {
  try {
    const bars =
      await storefrontAnnouncementBarService.listAnnouncementBars(
        req.query
      );

    return sendSuccess(res, {
      message:
        "Storefront announcement bars fetched successfully",
      data: bars,
    });
  } catch (error) {
    next(error);
  }
};

const createAnnouncementBar = async (
  req,
  res,
  next
) => {
  try {
    const bar =
      await storefrontAnnouncementBarService.createAnnouncementBar(
        req.body,
        req.user.id
      );

    return sendSuccess(res, {
      statusCode: 201,
      message:
        "Storefront announcement bar created successfully",
      data: bar,
    });
  } catch (error) {
    next(error);
  }
};

const updateAnnouncementBar = async (
  req,
  res,
  next
) => {
  try {
    const bar =
      await storefrontAnnouncementBarService.updateAnnouncementBar(
        req.params.barId,
        req.body,
        req.user.id
      );

    return sendSuccess(res, {
      message:
        "Storefront announcement bar updated successfully",
      data: bar,
    });
  } catch (error) {
    next(error);
  }
};

const deleteAnnouncementBar = async (
  req,
  res,
  next
) => {
  try {
    const result =
      await storefrontAnnouncementBarService.deleteAnnouncementBar(
        req.params.barId
      );

    return sendSuccess(res, {
      message:
        "Storefront announcement bar deleted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAnnouncementBarById,
  getActiveAnnouncementBars,
  listAnnouncementBars,
  createAnnouncementBar,
  updateAnnouncementBar,
  deleteAnnouncementBar,
};