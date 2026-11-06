const mongoose = require("mongoose");
const crypto = require("crypto");
const specialEventPageRepository = require("../repositories/special-event-page.repository");
const Product = require("../models/Product");
const Category = require("../models/Category");
const AppError = require("../errors/AppError");

const validateObjectId = (value, fieldName) => {
  if (!mongoose.isValidObjectId(value)) {
    throw new AppError(`Invalid ${fieldName}`, 400, `INVALID_${fieldName.toUpperCase().replace(/\s+/g, "_")}`);
  }
};

const normalizeSlug = (slug) =>
  slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const createEventPage = async ({
  name,
  slug,
  description = null,
  badge = "Special Event",
  status = "draft",
  startsAt = null,
  endsAt = null,
  timezone = "Asia/Kolkata",
  bannerUrl = null,
  mobileBannerUrl = null,
  theme = {},
  sections = [],
  seo = {},
  userId,
}) => {
  validateObjectId(userId, "user ID");

  const normalizedSlug = normalizeSlug(slug);
  const existing = await specialEventPageRepository.findBySlug(normalizedSlug);
  if (existing) {
    throw new AppError("An event page with this slug already exists", 409, "EVENT_PAGE_SLUG_EXISTS");
  }

  const previewToken = crypto.randomBytes(24).toString("hex");

  // Format and order sections with guaranteed unique IDs
  const formattedSections = (sections || []).map((sec, idx) => ({
    ...sec,
    id: sec.id || `sec_${Date.now()}_${idx}`,
    displayOrder: typeof sec.displayOrder === "number" ? sec.displayOrder : idx,
    isActive: sec.isActive !== false,
    config: sec.config || {},
  }));

  const created = await specialEventPageRepository.create({
    name,
    slug: normalizedSlug,
    description,
    badge,
    status,
    startsAt: startsAt ? new Date(startsAt) : null,
    endsAt: endsAt ? new Date(endsAt) : null,
    timezone,
    bannerUrl,
    mobileBannerUrl,
    theme: {
      primaryColor: theme?.primaryColor || "#004D38",
      accentColor: theme?.accentColor || "#E6A800",
      backgroundGradient: theme?.backgroundGradient || null,
      isDark: Boolean(theme?.isDark),
    },
    sections: formattedSections,
    seo,
    previewToken,
    createdBy: userId,
    publishedAt: status === "published" ? new Date() : null,
    publishedBy: status === "published" ? userId : null,
  });

  return created;
};

const listEventPages = async (query = {}) => {
  const { status, search, page = 1, limit = 20 } = query;
  const filter = {};

  if (status && status !== "all") {
    filter.status = status;
  }

  if (search && search.trim()) {
    const term = search.trim();
    filter.$or = [
      { name: { $regex: term, $options: "i" } },
      { slug: { $regex: term, $options: "i" } },
    ];
  }

  return specialEventPageRepository.findMany(filter, { page, limit });
};

const getEventPageById = async (id) => {
  validateObjectId(id, "event page ID");
  const page = await specialEventPageRepository.findById(id);
  if (!page) {
    throw new AppError("Event page not found", 404, "EVENT_PAGE_NOT_FOUND");
  }
  return page;
};

const updateEventPage = async (id, data, userId) => {
  validateObjectId(id, "event page ID");
  if (userId) validateObjectId(userId, "user ID");

  const existing = await getEventPageById(id);

  const update = {
    updatedBy: userId || existing.updatedBy,
  };

  if (data.name !== undefined) update.name = data.name;

  if (data.slug !== undefined) {
    const normalizedSlug = normalizeSlug(data.slug);
    if (normalizedSlug !== existing.slug) {
      const slugDuplicate = await specialEventPageRepository.findBySlug(normalizedSlug);
      if (slugDuplicate && slugDuplicate._id.toString() !== id.toString()) {
        throw new AppError("An event page with this slug already exists", 409, "EVENT_PAGE_SLUG_EXISTS");
      }
      update.slug = normalizedSlug;
    }
  }

  if (data.description !== undefined) update.description = data.description;
  if (data.badge !== undefined) update.badge = data.badge;
  if (data.status !== undefined) {
    update.status = data.status;
    if (data.status === "published" && !existing.publishedAt) {
      update.publishedAt = new Date();
      update.publishedBy = userId || existing.createdBy;
    }
  }
  if (data.startsAt !== undefined) update.startsAt = data.startsAt ? new Date(data.startsAt) : null;
  if (data.endsAt !== undefined) update.endsAt = data.endsAt ? new Date(data.endsAt) : null;
  if (data.timezone !== undefined) update.timezone = data.timezone;
  if (data.bannerUrl !== undefined) update.bannerUrl = data.bannerUrl;
  if (data.mobileBannerUrl !== undefined) update.mobileBannerUrl = data.mobileBannerUrl;
  if (data.theme !== undefined) {
    update.theme = {
      ...existing.theme?.toObject?.(),
      ...data.theme,
    };
  }
  if (data.seo !== undefined) {
    update.seo = {
      ...existing.seo?.toObject?.(),
      ...data.seo,
    };
  }

  if (Array.isArray(data.sections)) {
    update.sections = data.sections.map((sec, idx) => ({
      ...sec,
      id: sec.id || `sec_${Date.now()}_${idx}`,
      displayOrder: typeof sec.displayOrder === "number" ? sec.displayOrder : idx,
      isActive: sec.isActive !== false,
      config: sec.config || {},
    }));
  }

  const updated = await specialEventPageRepository.updateById(id, update);
  return updated;
};

const duplicateEventPage = async (id, userId) => {
  validateObjectId(id, "event page ID");
  validateObjectId(userId, "user ID");

  const original = await getEventPageById(id);
  const suffix = Date.now().toString().slice(-4);
  const newSlug = `${original.slug}-copy-${suffix}`;

  const duplicatedData = {
    name: `${original.name} (Copy)`,
    slug: newSlug,
    description: original.description,
    badge: original.badge,
    status: "draft",
    startsAt: original.startsAt,
    endsAt: original.endsAt,
    timezone: original.timezone,
    bannerUrl: original.bannerUrl,
    mobileBannerUrl: original.mobileBannerUrl,
    theme: original.theme ? original.theme.toObject() : {},
    sections: original.sections ? original.sections.map((s) => s.toObject()) : [],
    seo: original.seo ? original.seo.toObject() : {},
    userId,
  };

  return createEventPage(duplicatedData);
};

const publishEventPage = async (id, userId) => {
  validateObjectId(id, "event page ID");
  validateObjectId(userId, "user ID");

  const page = await getEventPageById(id);

  // Validate publishing readiness: must have at least one active section
  const activeSections = (page.sections || []).filter((s) => s.isActive !== false);
  if (activeSections.length === 0) {
    throw new AppError(
      "Cannot publish event page without at least one active section",
      400,
      "EVENT_PAGE_EMPTY_SECTIONS"
    );
  }

  return specialEventPageRepository.updateById(id, {
    status: "published",
    publishedAt: new Date(),
    publishedBy: userId,
    updatedBy: userId,
  });
};

const unpublishEventPage = async (id, userId) => {
  validateObjectId(id, "event page ID");
  if (userId) validateObjectId(userId, "user ID");

  return specialEventPageRepository.updateById(id, {
    status: "draft",
    updatedBy: userId,
  });
};

const archiveEventPage = async (id, userId) => {
  validateObjectId(id, "event page ID");
  if (userId) validateObjectId(userId, "user ID");

  return specialEventPageRepository.updateById(id, {
    status: "archived",
    archivedAt: new Date(),
    updatedBy: userId,
  });
};

const deleteEventPage = async (id) => {
  validateObjectId(id, "event page ID");
  const page = await getEventPageById(id);

  if (page.status === "published") {
    throw new AppError(
      "Cannot delete a published event page. Please unpublish or archive it first.",
      400,
      "CANNOT_DELETE_PUBLISHED_EVENT"
    );
  }

  return specialEventPageRepository.deleteById(id);
};

const normalizeProductNumbers = (prod) => {
  if (!prod) return prod;
  const p = { ...prod };
  if (p.price !== undefined && p.price !== null) {
    p.price = typeof p.price === "object" && p.price.$numberDecimal
      ? parseFloat(p.price.$numberDecimal)
      : parseFloat(p.price.toString());
  }
  if (p.compareAtPrice !== undefined && p.compareAtPrice !== null) {
    p.compareAtPrice = typeof p.compareAtPrice === "object" && p.compareAtPrice.$numberDecimal
      ? parseFloat(p.compareAtPrice.$numberDecimal)
      : parseFloat(p.compareAtPrice.toString());
  }
  return p;
};

/**
 * Hydrates catalog data (products and categories) into event page sections
 */
const hydratePageCatalogData = async (pageObj) => {
  if (!pageObj || !Array.isArray(pageObj.sections)) return pageObj;

  const sectionsWithData = await Promise.all(
    pageObj.sections.map(async (sec) => {
      const section = sec.toObject ? sec.toObject() : { ...sec };

      try {
        if (section.type === "product_collection" || section.type === "deals_collection") {
          const productIds = Array.isArray(section.config?.productIds)
            ? section.config.productIds.filter((id) => mongoose.isValidObjectId(id))
            : [];

          if (productIds.length > 0) {
            const products = await Product.find({
              _id: { $in: productIds },
              isDeleted: { $ne: true },
              status: "active",
              isPublished: { $ne: false },
            })
              .select(
                "name slug price compareAtPrice images thumbnail stock status isPublished averageRating totalReviews brandId categoryId"
              )
              .lean();

            // Maintain order of selected product IDs
            const productMap = new Map(products.map((p) => [p._id.toString(), normalizeProductNumbers(p)]));
            section.resolvedProducts = productIds
              .map((id) => productMap.get(id.toString()))
              .filter(Boolean);
          } else {
            section.resolvedProducts = [];
          }
        } else if (section.type === "category_products") {
          const categoryId = section.config?.categoryId;
          const limit = Math.min(Math.max(1, Number(section.config?.limit) || 8), 50);

          if (categoryId && mongoose.isValidObjectId(categoryId)) {
            const products = await Product.find({
              categoryId,
              isDeleted: { $ne: true },
              status: "active",
              isPublished: { $ne: false },
            })
              .sort({ createdAt: -1 })
              .limit(limit)
              .select(
                "name slug price compareAtPrice images thumbnail stock status isPublished averageRating totalReviews brandId categoryId"
              )
              .lean();

            section.resolvedProducts = products.map(normalizeProductNumbers);
          } else {
            section.resolvedProducts = [];
          }
        } else if (section.type === "category_grid") {
          const categoryIds = Array.isArray(section.config?.categoryIds)
            ? section.config.categoryIds.filter((id) => mongoose.isValidObjectId(id))
            : [];

          if (categoryIds.length > 0) {
            const categories = await Category.find({
              _id: { $in: categoryIds },
              isActive: { $ne: false },
            })
              .select("name slug image description")
              .lean();

            const catMap = new Map(categories.map((c) => [c._id.toString(), c]));
            section.resolvedCategories = categoryIds
              .map((id) => catMap.get(id.toString()))
              .filter(Boolean);
          } else {
            section.resolvedCategories = [];
          }
        }
      } catch (err) {
        // Safe graceful degradation: section renders without crashing entire page
        section.resolutionError = err.message;
      }

      return section;
    })
  );

  return {
    ...pageObj,
    sections: sectionsWithData,
  };
};

/**
 * Public storefront retriever with preview token enforcement and scheduling checks
 */
const getPublicEventPageBySlug = async (slug, { preview = false, token = null, isAdmin = false } = {}) => {
  const normalizedSlug = normalizeSlug(slug);
  const page = await specialEventPageRepository.findBySlug(normalizedSlug);

  if (!page) {
    throw new AppError("Special event page not found", 404, "EVENT_PAGE_NOT_FOUND");
  }

  const isAuthorizedPreview =
    isAdmin || (token && typeof token === "string" && token === page.previewToken);

  // If page is in draft, scheduled, or archived: only authorized preview is permitted
  if (page.status !== "published") {
    if (!isAuthorizedPreview) {
      throw new AppError("This event page is not currently published", 404, "EVENT_PAGE_NOT_AVAILABLE");
    }
  } else {
    // If published, check scheduling start and end dates
    const now = new Date();
    if (page.startsAt && now < page.startsAt) {
      if (!isAuthorizedPreview) {
        throw new AppError("This event has not yet started", 404, "EVENT_PAGE_NOT_STARTED");
      }
    }
    if (page.endsAt && now > page.endsAt) {
      if (!isAuthorizedPreview) {
        throw new AppError("This event has concluded", 404, "EVENT_PAGE_EXPIRED");
      }
    }
  }

  const rawObj = page.toObject ? page.toObject() : { ...page };
  // Scrub cryptographic preview token from storefront API response for security
  delete rawObj.previewToken;
  return hydratePageCatalogData(rawObj);
};

const getActivePublishedEvents = async () => {
  const now = new Date();
  const filter = {
    status: "published",
    $and: [
      { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
    ],
  };

  const { items } = await specialEventPageRepository.findMany(filter, {
    page: 1,
    limit: 10,
    sort: { startsAt: -1, createdAt: -1 },
  });

  return items;
};

module.exports = {
  createEventPage,
  listEventPages,
  getEventPageById,
  updateEventPage,
  duplicateEventPage,
  publishEventPage,
  unpublishEventPage,
  archiveEventPage,
  deleteEventPage,
  getPublicEventPageBySlug,
  getActivePublishedEvents,
  hydratePageCatalogData,
};
