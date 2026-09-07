const mongoose = require("mongoose");

const storefrontHomepageRepository = require("../repositories/storefront-homepage.repository");
const storefrontContentBlockRepository = require("../repositories/storefront-content-block.repository");
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

const validateBlocks = async (blocks) => {
  if (!Array.isArray(blocks)) {
    return;
  }

  const seenOrders = new Set();

  for (const block of blocks) {
    validateObjectId(block.blockId, "content block ID");

    if (seenOrders.has(block.displayOrder)) {
      throw new AppError(
        "Duplicate block displayOrder is not allowed",
        400,
        "DUPLICATE_HOMEPAGE_BLOCK_ORDER"
      );
    }

    seenOrders.add(block.displayOrder);

    const contentBlock =
      await storefrontContentBlockRepository.findById(
        block.blockId
      );

    if (!contentBlock) {
      throw new AppError(
        `Content block ${block.blockId} not found`,
        404,
        "HOMEPAGE_CONTENT_BLOCK_NOT_FOUND"
      );
    }
  }
};

const getHomepageById = async (homepageId) => {
  validateObjectId(homepageId, "homepage ID");

  const homepage =
    await storefrontHomepageRepository.findById(
      homepageId
    );

  if (!homepage) {
    throw new AppError(
      "Storefront homepage not found",
      404,
      "STOREFRONT_HOMEPAGE_NOT_FOUND"
    );
  }

  return homepage;
};

const getHomepageByKey = async (key) => {
  const homepage =
    await storefrontHomepageRepository.findByKey(key);

  if (!homepage) {
    throw new AppError(
      "Storefront homepage not found",
      404,
      "STOREFRONT_HOMEPAGE_NOT_FOUND"
    );
  }

  return homepage;
};

const getActiveHomepage = async (key) => {
  const homepage =
    await storefrontHomepageRepository.findActiveByKey(key);

  if (!homepage) {
    throw new AppError(
      "Active storefront homepage not found",
      404,
      "ACTIVE_STOREFRONT_HOMEPAGE_NOT_FOUND"
    );
  }

  return homepage;
};

const listHomepages = async (filter = {}) => {
  return storefrontHomepageRepository.findMany(filter);
};

const createHomepage = async (data, userId) => {
  validateObjectId(userId, "user ID");

  const existing =
    await storefrontHomepageRepository.findByKey(
      data.key
    );

  if (existing) {
    throw new AppError(
      "A storefront homepage with this key already exists",
      409,
      "STOREFRONT_HOMEPAGE_EXISTS"
    );
  }

  await validateBlocks(data.blocks || []);

  return storefrontHomepageRepository.create({
    ...data,
    createdBy: userId,
    updatedBy: userId,
  });
};

const updateHomepage = async (
  homepageId,
  data,
  userId
) => {
  validateObjectId(userId, "user ID");

  const homepage = await getHomepageById(homepageId);

  if (data.key && data.key !== homepage.key) {
    const existing =
      await storefrontHomepageRepository.findByKey(
        data.key
      );

    if (
      existing &&
      existing._id.toString() !== homepage._id.toString()
    ) {
      throw new AppError(
        "A storefront homepage with this key already exists",
        409,
        "STOREFRONT_HOMEPAGE_EXISTS"
      );
    }
  }

  if (data.blocks !== undefined) {
    await validateBlocks(data.blocks);
  }

  return storefrontHomepageRepository.updateById(
    homepageId,
    {
      ...data,
      updatedBy: userId,
    }
  );
};

const deleteHomepage = async (homepageId) => {
  await getHomepageById(homepageId);

  await storefrontHomepageRepository.deleteById(
    homepageId
  );

  return {
    id: homepageId,
  };
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