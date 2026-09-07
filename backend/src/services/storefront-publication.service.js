const crypto = require("crypto");
const mongoose = require("mongoose");

const storefrontPublicationRepository = require("../repositories/storefront-publication.repository");
const AppError = require("../errors/AppError");

const RESOURCE_TYPES = [
  "page",
  "banner",
  "menu",
  "settings",
  "seo",
  "redirect",
  "content_block",
  "homepage",
  "section",
  "announcement_bar",
  "media",
];

const validateObjectId = (value, fieldName) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(
      `Invalid ${fieldName}`,
      400,
      `INVALID_${fieldName.toUpperCase()}`
    );
  }
};

const validateResourceType = (resourceType) => {
  if (!RESOURCE_TYPES.includes(resourceType)) {
    throw new AppError(
      "Invalid storefront resource type",
      400,
      "INVALID_RESOURCE_TYPE"
    );
  }
};

const generatePreviewToken = () =>
  crypto.randomBytes(24).toString("hex");

const getPublicationById = async (publicationId) => {
  validateObjectId(publicationId, "publication ID");

  const publication =
    await storefrontPublicationRepository.findById(
      publicationId
    );

  if (!publication) {
    throw new AppError(
      "Storefront publication not found",
      404,
      "STOREFRONT_PUBLICATION_NOT_FOUND"
    );
  }

  return publication;
};

const getPublicationByResource = async (
  resourceType,
  resourceId
) => {
  validateResourceType(resourceType);
  validateObjectId(resourceId, "resource ID");

  const publication =
    await storefrontPublicationRepository.findByResource(
      resourceType,
      resourceId
    );

  if (!publication) {
    throw new AppError(
      "Storefront publication not found",
      404,
      "STOREFRONT_PUBLICATION_NOT_FOUND"
    );
  }

  return publication;
};

const getPreviewByToken = async (previewToken) => {
  const publication =
    await storefrontPublicationRepository.findByPreviewToken(
      previewToken
    );

  if (!publication) {
    throw new AppError(
      "Invalid or expired preview token",
      404,
      "INVALID_PREVIEW_TOKEN"
    );
  }

  return publication;
};

const listPublications = async (filter = {}) => {
  return storefrontPublicationRepository.findMany(
    filter
  );
};

const createPublication = async (
  data,
  userId
) => {
  validateObjectId(userId, "user ID");
  validateResourceType(data.resourceType);
  validateObjectId(data.resourceId, "resource ID");

  const existing =
    await storefrontPublicationRepository.findByResource(
      data.resourceType,
      data.resourceId
    );

  if (existing) {
    throw new AppError(
      "A publication record already exists for this resource",
      409,
      "STOREFRONT_PUBLICATION_EXISTS"
    );
  }

  const publicationData = {
    ...data,
    createdBy: userId,
    updatedBy: userId,
  };

  if (data.status === "published") {
    publicationData.publishedAt = new Date();
    publicationData.publishedBy = userId;
  }

  return storefrontPublicationRepository.create(
    publicationData
  );
};

const publishResource = async (
  resourceType,
  resourceId,
  userId
) => {
  validateObjectId(userId, "user ID");

  const publication =
    await getPublicationByResource(
      resourceType,
      resourceId
    );

  return storefrontPublicationRepository.updateById(
    publication._id,
    {
      status: "published",
      publishedAt: new Date(),
      publishedBy: userId,
      updatedBy: userId,
    }
  );
};

const unpublishResource = async (
  resourceType,
  resourceId,
  userId
) => {
  validateObjectId(userId, "user ID");

  const publication =
    await getPublicationByResource(
      resourceType,
      resourceId
    );

  return storefrontPublicationRepository.updateById(
    publication._id,
    {
      status: "draft",
      publishedAt: null,
      publishedBy: null,
      updatedBy: userId,
    }
  );
};

const generatePreview = async (
  resourceType,
  resourceId,
  userId
) => {
  validateObjectId(userId, "user ID");

  const publication =
    await getPublicationByResource(
      resourceType,
      resourceId
    );

  const previewToken = generatePreviewToken();

  return storefrontPublicationRepository.updateById(
    publication._id,
    {
      previewToken,
      updatedBy: userId,
    }
  );
};

module.exports = {
  RESOURCE_TYPES,
  getPublicationById,
  getPublicationByResource,
  getPreviewByToken,
  listPublications,
  createPublication,
  publishResource,
  unpublishResource,
  generatePreview,
};