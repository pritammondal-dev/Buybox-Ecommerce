const cmsPageService = require("../services/cms-page.service");
const { sendSuccess } = require("../utils/apiResponse");

const createPage = async (req, res, next) => {
  try {
    const page = await cmsPageService.createPage({
      ...req.body,
      userId: req.user.id,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: "CMS page created successfully",
      data: page,
    });
  } catch (error) {
    next(error);
  }
};

const listPages = async (req, res, next) => {
  try {
    const pages = await cmsPageService.listPages(req.query);

    return sendSuccess(res, {
      message: "CMS pages fetched successfully",
      data: pages,
    });
  } catch (error) {
    next(error);
  }
};

const getPageById = async (req, res, next) => {
  try {
    const page = await cmsPageService.getPageById(
      req.params.pageId
    );

    return sendSuccess(res, {
      message: "CMS page fetched successfully",
      data: page,
    });
  } catch (error) {
    next(error);
  }
};

const getPublishedPageBySlug = async (req, res, next) => {
  try {
    const page =
      await cmsPageService.getPublishedPageBySlug(
        req.params.slug
      );

    return sendSuccess(res, {
      message: "CMS page fetched successfully",
      data: page,
    });
  } catch (error) {
    next(error);
  }
};

const updatePage = async (req, res, next) => {
  try {
    const page = await cmsPageService.updatePage(
      req.params.pageId,
      req.body
    );

    return sendSuccess(res, {
      message: "CMS page updated successfully",
      data: page,
    });
  } catch (error) {
    next(error);
  }
};

const publishPage = async (req, res, next) => {
  try {
    const page = await cmsPageService.publishPage(
      req.params.pageId,
      req.user.id
    );

    return sendSuccess(res, {
      message: "CMS page published successfully",
      data: page,
    });
  } catch (error) {
    next(error);
  }
};

const archivePage = async (req, res, next) => {
  try {
    const page = await cmsPageService.archivePage(
      req.params.pageId
    );

    return sendSuccess(res, {
      message: "CMS page archived successfully",
      data: page,
    });
  } catch (error) {
    next(error);
  }
};

const unpublishPage = async (req, res, next) => {
  try {
    const page = await cmsPageService.unpublishPage(
      req.params.pageId
    );

    return sendSuccess(res, {
      message: "CMS page unpublished successfully",
      data: page,
    });
  } catch (error) {
    next(error);
  }
};

const deletePage = async (req, res, next) => {
  try {
    const result = await cmsPageService.deletePage(
      req.params.pageId
    );

    return sendSuccess(res, {
      message: "CMS page deleted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPage,
  listPages,
  getPageById,
  getPublishedPageBySlug,
  updatePage,
  publishPage,
  archivePage,
  unpublishPage,
  deletePage,
};