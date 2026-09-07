const mongoose = require("mongoose");

const cmsPageRepository = require("../repositories/cms-page.repository");
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

const normalizeSlug = (slug) =>
  slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const getPageById = async (pageId) => {
  validateObjectId(pageId, "page ID");

  const page = await cmsPageRepository.findById(pageId);

  if (!page) {
    throw new AppError(
      "CMS page not found",
      404,
      "CMS_PAGE_NOT_FOUND"
    );
  }

  return page;
};

const createPage = async ({
  title,
  slug,
  content,
  seo = {},
  userId,
}) => {
  validateObjectId(userId, "user ID");

  const normalizedSlug = normalizeSlug(slug);

  const existingPage =
    await cmsPageRepository.findBySlug(normalizedSlug);

  if (existingPage) {
    throw new AppError(
      "A CMS page with this slug already exists",
      409,
      "CMS_PAGE_SLUG_EXISTS"
    );
  }

  return cmsPageRepository.create({
    title,
    slug: normalizedSlug,
    content,
    seo,
    createdBy: userId,
    status: "draft",
  });
};

const listPages = async (filter = {}) => {
  return cmsPageRepository.findMany(filter);
};

const getPublishedPageBySlug = async (slug) => {
  const normalizedSlug = normalizeSlug(slug);

  const page = await cmsPageRepository.findBySlug(
    normalizedSlug
  );

  if (!page || page.status !== "published") {
    throw new AppError(
      "Published CMS page not found",
      404,
      "CMS_PAGE_NOT_FOUND"
    );
  }

  return page;
};

const updatePage = async (pageId, data) => {
  const page = await getPageById(pageId);

  const update = {};

  if (data.title !== undefined) {
    update.title = data.title;
  }

  if (data.content !== undefined) {
    update.content = data.content;
  }

  if (data.slug !== undefined) {
    const normalizedSlug = normalizeSlug(data.slug);

    const existingPage =
      await cmsPageRepository.findBySlug(normalizedSlug);

    if (
      existingPage &&
      existingPage._id.toString() !== page._id.toString()
    ) {
      throw new AppError(
        "A CMS page with this slug already exists",
        409,
        "CMS_PAGE_SLUG_EXISTS"
      );
    }

    update.slug = normalizedSlug;
  }

  if (data.seo !== undefined) {
    update.seo = data.seo;
  }

  return cmsPageRepository.updateById(
    pageId,
    update
  );
};

const publishPage = async (pageId, userId) => {
  validateObjectId(userId, "user ID");

  await getPageById(pageId);

  return cmsPageRepository.updateById(pageId, {
    status: "published",
    publishedBy: userId,
    publishedAt: new Date(),
    archivedAt: null,
  });
};

const archivePage = async (pageId) => {
  await getPageById(pageId);

  return cmsPageRepository.updateById(pageId, {
    status: "archived",
    archivedAt: new Date(),
  });
};

const unpublishPage = async (pageId) => {
  await getPageById(pageId);

  return cmsPageRepository.updateById(pageId, {
    status: "draft",
    publishedBy: null,
    publishedAt: null,
    archivedAt: null,
  });
};

const deletePage = async (pageId) => {
  await getPageById(pageId);

  await cmsPageRepository.deleteById(pageId);

  return {
    id: pageId,
  };
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