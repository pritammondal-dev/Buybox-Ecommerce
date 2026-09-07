const mongoose = require("mongoose");

const storefrontSeoRepository = require("../repositories/storefront-seo.repository");
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

const getActiveSeo = async () => {
  const seo = await storefrontSeoRepository.findActive();

  if (!seo) {
    throw new AppError(
      "Active storefront SEO settings not found",
      404,
      "STOREFRONT_SEO_NOT_FOUND"
    );
  }

  return seo;
};

const getSeoById = async (seoId) => {
  validateObjectId(seoId, "SEO ID");

  const seo = await storefrontSeoRepository.findById(seoId);

  if (!seo) {
    throw new AppError(
      "Storefront SEO settings not found",
      404,
      "STOREFRONT_SEO_NOT_FOUND"
    );
  }

  return seo;
};

const createSeo = async (data, userId) => {
  validateObjectId(userId, "user ID");

  const existing = await storefrontSeoRepository.findActive();

  if (existing) {
    throw new AppError(
      "Active storefront SEO settings already exist",
      409,
      "STOREFRONT_SEO_ALREADY_EXISTS"
    );
  }

  return storefrontSeoRepository.create({
    ...data,
    updatedBy: userId,
    isActive: true,
  });
};

const updateSeo = async (seoId, data, userId) => {
  validateObjectId(userId, "user ID");

  await getSeoById(seoId);

  return storefrontSeoRepository.updateById(
    seoId,
    {
      ...data,
      updatedBy: userId,
    }
  );
};

module.exports = {
  getActiveSeo,
  getSeoById,
  createSeo,
  updateSeo,
};

