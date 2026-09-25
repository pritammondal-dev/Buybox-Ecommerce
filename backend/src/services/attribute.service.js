const mongoose = require("mongoose");
const Attribute = require("../models/Attribute");
const Category = require("../models/Category");
const AppError = require("../errors/AppError");
const { recordAuditLog } = require("./governance.service");

/**
 * List attributes with flexible filtering
 */
const listAttributes = async ({
  categoryId = null,
  isVariantAttribute,
  type,
  search,
  page = 1,
  limit = 50,
} = {}) => {
  const query = {
    deletedAt: null,
  };

  if (categoryId) {
    if (mongoose.isValidObjectId(categoryId)) {
      query.$or = [
        { categoryIds: new mongoose.Types.ObjectId(categoryId) },
        { categoryIds: { $size: 0 } }, // Global attributes
      ];
    }
  }

  if (isVariantAttribute !== undefined) {
    query.isVariantAttribute = isVariantAttribute === true || isVariantAttribute === "true";
  }

  if (type) {
    query.type = type;
  }

  if (search && search.trim()) {
    const s = search.trim();
    query.$or = [
      { name: { $regex: s, $options: "i" } },
      { slug: { $regex: s, $options: "i" } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
  const skip = (pageNum - 1) * limitNum;

  const [attributes, total] = await Promise.all([
    Attribute.find(query)
      .populate("categoryIds", "name slug")
      .sort({ sortOrder: 1, name: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Attribute.countDocuments(query),
  ]);

  return {
    items: attributes,
    attributes,
    total,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  };
};

/**
 * Get single attribute by ID
 */
const getAttributeById = async (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid attribute identifier", 400, "INVALID_ID");
  }

  const attribute = await Attribute.findOne({ _id: id, deletedAt: null })
    .populate("categoryIds", "name slug")
    .lean();

  if (!attribute) {
    throw new AppError("Attribute not found", 404, "ATTRIBUTE_NOT_FOUND");
  }

  return attribute;
};

/**
 * Get single attribute by Slug
 */
const getAttributeBySlug = async (slug) => {
  const attribute = await Attribute.findOne({
    slug: String(slug).toLowerCase().trim(),
    deletedAt: null,
  })
    .populate("categoryIds", "name slug")
    .lean();

  if (!attribute) {
    throw new AppError("Attribute not found", 404, "ATTRIBUTE_NOT_FOUND");
  }

  return attribute;
};

/**
 * Get all active attributes for a given category (including parent categories if nested)
 */
const getCategoryAttributes = async (categoryId) => {
  if (!mongoose.isValidObjectId(categoryId)) {
    throw new AppError("Invalid category identifier", 400, "INVALID_CATEGORY_ID");
  }

  // Find category and traverse parents to inherit attributes
  const categoryIds = [new mongoose.Types.ObjectId(categoryId)];
  let current = await Category.findById(categoryId).lean();

  while (current && current.parentId) {
    categoryIds.push(new mongoose.Types.ObjectId(current.parentId));
    current = await Category.findById(current.parentId).lean();
  }

  const attributes = await Attribute.find({
    deletedAt: null,
    isActive: true,
    $or: [
      { categoryIds: { $in: categoryIds } },
      { categoryIds: { $size: 0 } }, // Marketplace-wide global attributes
    ],
  })
    .sort({ sortOrder: 1, name: 1 })
    .lean();

  return attributes;
};

/**
 * Create a new platform attribute (Admin only)
 */
const createAttribute = async (data, actor, req = null) => {
  const slug = String(data.slug || data.name || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    throw new AppError("A valid attribute name or slug is required", 400, "INVALID_SLUG");
  }

  const existing = await Attribute.findOne({ slug, deletedAt: null });
  if (existing) {
    throw new AppError(`Attribute with slug '${slug}' already exists`, 409, "ATTRIBUTE_ALREADY_EXISTS");
  }

  const cleanCategoryIds = Array.isArray(data.categoryIds)
    ? data.categoryIds.filter((cid) => mongoose.isValidObjectId(cid))
    : [];

  const attribute = await Attribute.create({
    name: data.name.trim(),
    slug,
    type: data.type || "select",
    categoryIds: cleanCategoryIds,
    isRequired: Boolean(data.isRequired),
    attributeGroup: data.attributeGroup ? data.attributeGroup.trim() : "General",
    values: Array.isArray(data.values) ? data.values : [],
    isVariantAttribute: Boolean(data.isVariantAttribute),
    isFilterable: data.isFilterable !== false,
    isActive: data.isActive !== false,
    sortOrder: Number(data.sortOrder) || 0,
  });

  if (actor) {
    await recordAuditLog({
      actorId: actor._id || actor.id,
      targetId: attribute._id,
      action: "ATTRIBUTE_CREATED",
      entityType: "attribute",
      afterState: {
        name: attribute.name,
        slug: attribute.slug,
        type: attribute.type,
        isVariantAttribute: attribute.isVariantAttribute,
      },
      req,
    });
  }

  return attribute;
};

/**
 * Update an existing platform attribute (Admin only)
 */
const updateAttribute = async (id, data, actor, req = null) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid attribute identifier", 400, "INVALID_ID");
  }

  const attribute = await Attribute.findOne({ _id: id, deletedAt: null });
  if (!attribute) {
    throw new AppError("Attribute not found", 404, "ATTRIBUTE_NOT_FOUND");
  }

  const beforeState = attribute.toObject();

  if (data.name) attribute.name = data.name.trim();
  if (data.type) attribute.type = data.type;
  if (data.attributeGroup !== undefined) attribute.attributeGroup = data.attributeGroup.trim();
  if (data.isRequired !== undefined) attribute.isRequired = Boolean(data.isRequired);
  if (data.isVariantAttribute !== undefined) attribute.isVariantAttribute = Boolean(data.isVariantAttribute);
  if (data.isFilterable !== undefined) attribute.isFilterable = Boolean(data.isFilterable);
  if (data.isActive !== undefined) attribute.isActive = Boolean(data.isActive);
  if (data.sortOrder !== undefined) attribute.sortOrder = Number(data.sortOrder) || 0;

  if (Array.isArray(data.categoryIds)) {
    attribute.categoryIds = data.categoryIds.filter((cid) => mongoose.isValidObjectId(cid));
  }

  if (Array.isArray(data.values)) {
    attribute.values = data.values;
  }

  await attribute.save();

  if (actor) {
    await recordAuditLog({
      actorId: actor._id || actor.id,
      targetId: attribute._id,
      action: "ATTRIBUTE_UPDATED",
      entityType: "attribute",
      beforeState,
      afterState: attribute.toObject(),
      req,
    });
  }

  return attribute;
};

/**
 * Delete an attribute (soft delete - Admin only)
 */
const deleteAttribute = async (id, actor, req = null) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError("Invalid attribute identifier", 400, "INVALID_ID");
  }

  const attribute = await Attribute.findOne({ _id: id, deletedAt: null });
  if (!attribute) {
    throw new AppError("Attribute not found", 404, "ATTRIBUTE_NOT_FOUND");
  }

  attribute.deletedAt = new Date();
  attribute.isActive = false;
  await attribute.save();

  if (actor) {
    await recordAuditLog({
      actorId: actor._id || actor.id,
      targetId: attribute._id,
      action: "ATTRIBUTE_DELETED",
      entityType: "attribute",
      beforeState: { id: attribute._id, name: attribute.name, slug: attribute.slug },
      req,
    });
  }

  return { success: true, message: "Attribute deleted successfully" };
};

module.exports = {
  listAttributes,
  getAttributeById,
  getAttributeBySlug,
  getCategoryAttributes,
  createAttribute,
  updateAttribute,
  deleteAttribute,
};
