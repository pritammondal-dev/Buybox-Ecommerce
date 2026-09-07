const mongoose = require("mongoose");

const storefrontSettingsRepository = require("../repositories/storefront-settings.repository");
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

const getActiveSettings = async () => {
  const settings =
    await storefrontSettingsRepository.findActive();

  if (!settings) {
    throw new AppError(
      "Active storefront settings not found",
      404,
      "STOREFRONT_SETTINGS_NOT_FOUND"
    );
  }

  return settings;
};

const getSettingsById = async (settingsId) => {
  validateObjectId(settingsId, "settings ID");

  const settings =
    await storefrontSettingsRepository.findById(
      settingsId
    );

  if (!settings) {
    throw new AppError(
      "Storefront settings not found",
      404,
      "STOREFRONT_SETTINGS_NOT_FOUND"
    );
  }

  return settings;
};

const createSettings = async (data, userId) => {
  validateObjectId(userId, "user ID");

  const existing =
    await storefrontSettingsRepository.findActive();

  if (existing) {
    throw new AppError(
      "Active storefront settings already exist",
      409,
      "STOREFRONT_SETTINGS_ALREADY_EXISTS"
    );
  }

  return storefrontSettingsRepository.create({
    ...data,
    updatedBy: userId,
    isActive: true,
  });
};

const updateSettings = async (
  settingsId,
  data,
  userId
) => {
  validateObjectId(userId, "user ID");

  await getSettingsById(settingsId);

  return storefrontSettingsRepository.updateById(
    settingsId,
    {
      ...data,
      updatedBy: userId,
    }
  );
};

module.exports = {
  getActiveSettings,
  getSettingsById,
  createSettings,
  updateSettings,
};