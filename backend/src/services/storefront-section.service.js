const mongoose = require("mongoose");

const storefrontSectionRepository = require("../repositories/storefront-section.repository");
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

const validateProductIds = (productIds = []) => {
  for (const productId of productIds) {
    validateObjectId(productId, "product ID");
  }
};

const validateSectionReferences = (data) => {
  if (data.collectionId) {
    validateObjectId(
      data.collectionId,
      "collection ID"
    );
  }

  if (data.categoryId) {
    validateObjectId(
      data.categoryId,
      "category ID"
    );
  }

  validateProductIds(data.productIds || []);
};

const getSectionById = async (sectionId) => {
  validateObjectId(sectionId, "section ID");

  const section =
    await storefrontSectionRepository.findById(
      sectionId
    );

  if (!section) {
    throw new AppError(
      "Storefront section not found",
      404,
      "STOREFRONT_SECTION_NOT_FOUND"
    );
  }

  return section;
};

const getSectionByKey = async (key) => {
  const section =
    await storefrontSectionRepository.findByKey(key);

  if (!section) {
    throw new AppError(
      "Storefront section not found",
      404,
      "STOREFRONT_SECTION_NOT_FOUND"
    );
  }

  return section;
};

const getActiveSection = async (key) => {
  const section =
    await storefrontSectionRepository.findActiveByKey(
      key
    );

  if (!section) {
    throw new AppError(
      "Active storefront section not found",
      404,
      "ACTIVE_STOREFRONT_SECTION_NOT_FOUND"
    );
  }

  return section;
};

const getActiveSections = async () => {
  return storefrontSectionRepository.findActive();
};

const listSections = async (filter = {}) => {
  return storefrontSectionRepository.findMany(filter);
};

const createSection = async (data, userId) => {
  validateObjectId(userId, "user ID");
  validateSectionReferences(data);

  const existing =
    await storefrontSectionRepository.findByKey(
      data.key
    );

  if (existing) {
    throw new AppError(
      "A storefront section with this key already exists",
      409,
      "STOREFRONT_SECTION_EXISTS"
    );
  }

  if (
    data.type === "collection" &&
    !data.collectionId
  ) {
    throw new AppError(
      "collectionId is required for collection sections",
      400,
      "COLLECTION_ID_REQUIRED"
    );
  }

  if (
    data.type === "category" &&
    !data.categoryId
  ) {
    throw new AppError(
      "categoryId is required for category sections",
      400,
      "CATEGORY_ID_REQUIRED"
    );
  }

  if (
    ["products", "featured_products", "new_arrivals", "best_sellers"].includes(
      data.type
    ) &&
    !data.productIds?.length
  ) {
    throw new AppError(
      "productIds are required for product sections",
      400,
      "PRODUCT_IDS_REQUIRED"
    );
  }

  return storefrontSectionRepository.create({
    ...data,
    createdBy: userId,
    updatedBy: userId,
  });
};

const updateSection = async (
  sectionId,
  data,
  userId
) => {
  validateObjectId(userId, "user ID");

  const section = await getSectionById(sectionId);

  validateSectionReferences(data);

  if (data.key && data.key !== section.key) {
    const existing =
      await storefrontSectionRepository.findByKey(
        data.key
      );

    if (
      existing &&
      existing._id.toString() !== section._id.toString()
    ) {
      throw new AppError(
        "A storefront section with this key already exists",
        409,
        "STOREFRONT_SECTION_EXISTS"
      );
    }
  }

  const type =
    data.type !== undefined
      ? data.type
      : section.type;

  const collectionId =
    data.collectionId !== undefined
      ? data.collectionId
      : section.collectionId;

  const categoryId =
    data.categoryId !== undefined
      ? data.categoryId
      : section.categoryId;

  const productIds =
    data.productIds !== undefined
      ? data.productIds
      : section.productIds;

  if (
    type === "collection" &&
    !collectionId
  ) {
    throw new AppError(
      "collectionId is required for collection sections",
      400,
      "COLLECTION_ID_REQUIRED"
    );
  }

  if (
    type === "category" &&
    !categoryId
  ) {
    throw new AppError(
      "categoryId is required for category sections",
      400,
      "CATEGORY_ID_REQUIRED"
    );
  }

  if (
    ["products", "featured_products", "new_arrivals", "best_sellers"].includes(
      type
    ) &&
    (!productIds || productIds.length === 0)
  ) {
    throw new AppError(
      "productIds are required for product sections",
      400,
      "PRODUCT_IDS_REQUIRED"
    );
  }

  return storefrontSectionRepository.updateById(
    sectionId,
    {
      ...data,
      updatedBy: userId,
    }
  );
};

const deleteSection = async (sectionId) => {
  await getSectionById(sectionId);

  await storefrontSectionRepository.deleteById(
    sectionId
  );

  return {
    id: sectionId,
  };
};

module.exports = {
  getSectionById,
  getSectionByKey,
  getActiveSection,
  getActiveSections,
  listSections,
  createSection,
  updateSection,
  deleteSection,
};