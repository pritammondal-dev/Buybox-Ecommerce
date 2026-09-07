const storefrontSectionService = require("../services/storefront-section.service");
const { sendSuccess } = require("../utils/apiResponse");

const getSectionById = async (req, res, next) => {
  try {
    const section =
      await storefrontSectionService.getSectionById(
        req.params.sectionId
      );

    return sendSuccess(res, {
      message:
        "Storefront section fetched successfully",
      data: section,
    });
  } catch (error) {
    next(error);
  }
};

const getSectionByKey = async (req, res, next) => {
  try {
    const section =
      await storefrontSectionService.getSectionByKey(
        req.params.key
      );

    return sendSuccess(res, {
      message:
        "Storefront section fetched successfully",
      data: section,
    });
  } catch (error) {
    next(error);
  }
};

const getActiveSection = async (req, res, next) => {
  try {
    const section =
      await storefrontSectionService.getActiveSection(
        req.params.key
      );

    return sendSuccess(res, {
      message:
        "Active storefront section fetched successfully",
      data: section,
    });
  } catch (error) {
    next(error);
  }
};

const getActiveSections = async (req, res, next) => {
  try {
    const sections =
      await storefrontSectionService.getActiveSections();

    return sendSuccess(res, {
      message:
        "Active storefront sections fetched successfully",
      data: sections,
    });
  } catch (error) {
    next(error);
  }
};

const listSections = async (req, res, next) => {
  try {
    const sections =
      await storefrontSectionService.listSections(
        req.query
      );

    return sendSuccess(res, {
      message:
        "Storefront sections fetched successfully",
      data: sections,
    });
  } catch (error) {
    next(error);
  }
};

const createSection = async (req, res, next) => {
  try {
    const section =
      await storefrontSectionService.createSection(
        req.body,
        req.user.id
      );

    return sendSuccess(res, {
      statusCode: 201,
      message:
        "Storefront section created successfully",
      data: section,
    });
  } catch (error) {
    next(error);
  }
};

const updateSection = async (req, res, next) => {
  try {
    const section =
      await storefrontSectionService.updateSection(
        req.params.sectionId,
        req.body,
        req.user.id
      );

    return sendSuccess(res, {
      message:
        "Storefront section updated successfully",
      data: section,
    });
  } catch (error) {
    next(error);
  }
};

const deleteSection = async (req, res, next) => {
  try {
    const result =
      await storefrontSectionService.deleteSection(
        req.params.sectionId
      );

    return sendSuccess(res, {
      message:
        "Storefront section deleted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
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