const storefrontSettingsService = require("../services/storefront-settings.service");
const { sendSuccess } = require("../utils/apiResponse");

const getActiveSettings = async (req, res, next) => {
  try {
    const settings =
      await storefrontSettingsService.getActiveSettings();

    return sendSuccess(res, {
      message: "Storefront settings fetched successfully",
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

const getSettingsById = async (req, res, next) => {
  try {
    const settings =
      await storefrontSettingsService.getSettingsById(
        req.params.settingsId
      );

    return sendSuccess(res, {
      message: "Storefront settings fetched successfully",
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

const createSettings = async (req, res, next) => {
  try {
    const settings =
      await storefrontSettingsService.createSettings(
        req.body,
        req.user.id
      );

    return sendSuccess(res, {
      statusCode: 201,
      message: "Storefront settings created successfully",
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const settings =
      await storefrontSettingsService.updateSettings(
        req.params.settingsId,
        req.body,
        req.user.id
      );

    return sendSuccess(res, {
      message: "Storefront settings updated successfully",
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActiveSettings,
  getSettingsById,
  createSettings,
  updateSettings,
};