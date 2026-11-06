const specialEventPageService = require("../services/special-event-page.service");
const { sendSuccess } = require("../utils/apiResponse");

const createPage = async (req, res, next) => {
  try {
    const page = await specialEventPageService.createEventPage({
      ...req.body,
      userId: req.user.id,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: "Special event page created successfully",
      data: page,
    });
  } catch (error) {
    next(error);
  }
};

const listPages = async (req, res, next) => {
  try {
    const result = await specialEventPageService.listEventPages(req.query);

    return sendSuccess(res, {
      message: "Special event pages fetched successfully",
      data: result.items,
      meta: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

const getPageById = async (req, res, next) => {
  try {
    const page = await specialEventPageService.getEventPageById(req.params.id);

    return sendSuccess(res, {
      message: "Special event page fetched successfully",
      data: page,
    });
  } catch (error) {
    next(error);
  }
};

const updatePage = async (req, res, next) => {
  try {
    const page = await specialEventPageService.updateEventPage(
      req.params.id,
      req.body,
      req.user.id
    );

    return sendSuccess(res, {
      message: "Special event page updated successfully",
      data: page,
    });
  } catch (error) {
    next(error);
  }
};

const duplicatePage = async (req, res, next) => {
  try {
    const page = await specialEventPageService.duplicateEventPage(
      req.params.id,
      req.user.id
    );

    return sendSuccess(res, {
      statusCode: 201,
      message: "Special event page duplicated successfully",
      data: page,
    });
  } catch (error) {
    next(error);
  }
};

const publishPage = async (req, res, next) => {
  try {
    const page = await specialEventPageService.publishEventPage(
      req.params.id,
      req.user.id
    );

    return sendSuccess(res, {
      message: "Special event page published successfully",
      data: page,
    });
  } catch (error) {
    next(error);
  }
};

const unpublishPage = async (req, res, next) => {
  try {
    const page = await specialEventPageService.unpublishEventPage(
      req.params.id,
      req.user.id
    );

    return sendSuccess(res, {
      message: "Special event page unpublished successfully",
      data: page,
    });
  } catch (error) {
    next(error);
  }
};

const archivePage = async (req, res, next) => {
  try {
    const page = await specialEventPageService.archiveEventPage(
      req.params.id,
      req.user.id
    );

    return sendSuccess(res, {
      message: "Special event page archived successfully",
      data: page,
    });
  } catch (error) {
    next(error);
  }
};

const deletePage = async (req, res, next) => {
  try {
    await specialEventPageService.deleteEventPage(req.params.id);

    return sendSuccess(res, {
      message: "Special event page deleted successfully",
      data: { id: req.params.id },
    });
  } catch (error) {
    next(error);
  }
};

const getPublicPageBySlug = async (req, res, next) => {
  try {
    const roleNormalized = req.user?.role
      ? String(req.user.role).toLowerCase().replace(/[-_]/g, "")
      : "";
    const rolesNormalized = Array.isArray(req.user?.roles)
      ? req.user.roles.map((r) => String(r).toLowerCase().replace(/[-_]/g, ""))
      : [];
    const isAdmin = Boolean(
      req.user &&
      (roleNormalized === "superadmin" ||
        roleNormalized === "admin" ||
        roleNormalized === "editor" ||
        rolesNormalized.includes("superadmin") ||
        rolesNormalized.includes("admin") ||
        req.user.permissions?.includes?.("settings:read") ||
        req.user.permissions?.includes?.("cms.view"))
    );

    const page = await specialEventPageService.getPublicEventPageBySlug(
      req.params.slug,
      {
        preview: req.query.preview === "true",
        token: req.query.token,
        isAdmin,
      }
    );

    return sendSuccess(res, {
      message: "Special event page fetched successfully",
      data: page,
    });
  } catch (error) {
    next(error);
  }
};

const getActiveEvents = async (req, res, next) => {
  try {
    const events = await specialEventPageService.getActivePublishedEvents();

    return sendSuccess(res, {
      message: "Active special event pages fetched successfully",
      data: events,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPage,
  listPages,
  getPageById,
  updatePage,
  duplicatePage,
  publishPage,
  unpublishPage,
  archivePage,
  deletePage,
  getPublicPageBySlug,
  getActiveEvents,
};
