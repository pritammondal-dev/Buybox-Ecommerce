const storefrontPublicationService = require("../services/storefront-publication.service");
const { sendSuccess } = require("../utils/apiResponse");

const getPublicationById = async (req, res, next) => {
  try {
    const publication =
      await storefrontPublicationService.getPublicationById(
        req.params.publicationId
      );

    return sendSuccess(res, {
      message:
        "Storefront publication fetched successfully",
      data: publication,
    });
  } catch (error) {
    next(error);
  }
};

const getPublicationByResource = async (
  req,
  res,
  next
) => {
  try {
    const publication =
      await storefrontPublicationService.getPublicationByResource(
        req.params.resourceType,
        req.params.resourceId
      );

    return sendSuccess(res, {
      message:
        "Storefront publication fetched successfully",
      data: publication,
    });
  } catch (error) {
    next(error);
  }
};

const getPreviewByToken = async (req, res, next) => {
  try {
    const publication =
      await storefrontPublicationService.getPreviewByToken(
        req.params.previewToken
      );

    return sendSuccess(res, {
      message:
        "Storefront preview fetched successfully",
      data: publication,
    });
  } catch (error) {
    next(error);
  }
};

const listPublications = async (req, res, next) => {
  try {
    const publications =
      await storefrontPublicationService.listPublications(
        req.query
      );

    return sendSuccess(res, {
      message:
        "Storefront publications fetched successfully",
      data: publications,
    });
  } catch (error) {
    next(error);
  }
};

const createPublication = async (
  req,
  res,
  next
) => {
  try {
    const publication =
      await storefrontPublicationService.createPublication(
        req.body,
        req.user.id
      );

    return sendSuccess(res, {
      statusCode: 201,
      message:
        "Storefront publication created successfully",
      data: publication,
    });
  } catch (error) {
    next(error);
  }
};

const publishResource = async (
  req,
  res,
  next
) => {
  try {
    const publication =
      await storefrontPublicationService.publishResource(
        req.params.resourceType,
        req.params.resourceId,
        req.user.id
      );

    return sendSuccess(res, {
      message:
        "Storefront resource published successfully",
      data: publication,
    });
  } catch (error) {
    next(error);
  }
};

const unpublishResource = async (
  req,
  res,
  next
) => {
  try {
    const publication =
      await storefrontPublicationService.unpublishResource(
        req.params.resourceType,
        req.params.resourceId,
        req.user.id
      );

    return sendSuccess(res, {
      message:
        "Storefront resource unpublished successfully",
      data: publication,
    });
  } catch (error) {
    next(error);
  }
};

const generatePreview = async (
  req,
  res,
  next
) => {
  try {
    const publication =
      await storefrontPublicationService.generatePreview(
        req.params.resourceType,
        req.params.resourceId,
        req.user.id
      );

    return sendSuccess(res, {
      message:
        "Storefront preview generated successfully",
      data: {
        publicationId: publication._id,
        resourceType: publication.resourceType,
        resourceId: publication.resourceId,
        previewToken: publication.previewToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicationById,
  getPublicationByResource,
  getPreviewByToken,
  listPublications,
  createPublication,
  publishResource,
  unpublishResource,
  generatePreview,
};