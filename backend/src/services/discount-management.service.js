const mongoose = require("mongoose");
const productDiscountRepository = require("../repositories/product-discount.repository");
const ProductDiscount = require("../models/ProductDiscount");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const Category = require("../models/Category");
const Brand = require("../models/Brand");
const pricingEngineService = require("./pricing-engine.service");
const { recordAuditLog } = require("./governance.service");
const AppError = require("../errors/AppError");
const {
  DISCOUNT_TYPES,
  DISCOUNT_STATUSES,
  DISCOUNT_SCOPES,
  FUNDING_SOURCES,
} = require("../constants/promotion.constants");

/**
 * Determine dynamic lifecycle status based on dates and requested base status.
 *
 * @param {Date} startsAt
 * @param {Date} endsAt
 * @param {string} [baseStatus]
 * @returns {string}
 */
const resolveLifecycleStatus = (startsAt, endsAt, baseStatus = DISCOUNT_STATUSES.ACTIVE) => {
  if (baseStatus === DISCOUNT_STATUSES.DRAFT) {
    return DISCOUNT_STATUSES.DRAFT;
  }
  if (baseStatus === DISCOUNT_STATUSES.PAUSED) {
    return DISCOUNT_STATUSES.PAUSED;
  }
  if (baseStatus === DISCOUNT_STATUSES.CANCELLED) {
    return DISCOUNT_STATUSES.CANCELLED;
  }

  const now = Date.now();
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();

  if (now >= end) {
    return DISCOUNT_STATUSES.EXPIRED;
  }
  if (now < start) {
    return DISCOUNT_STATUSES.SCHEDULED;
  }
  return DISCOUNT_STATUSES.ACTIVE;
};

/**
 * Create a new product promotion.
 *
 * @param {Object} params
 * @param {Object} params.data
 * @param {Object} params.actor
 * @param {Object} [params.req]
 * @returns {Promise<Object>}
 */
const createPromotion = async ({ data, actor, req = null }) => {
  const startsAt = new Date(data.startsAt);
  const endsAt = new Date(data.endsAt);

  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new AppError("Promotion endsAt must be strictly after startsAt", 400, "INVALID_DATE_RANGE");
  }

  const status = resolveLifecycleStatus(startsAt, endsAt, data.status || DISCOUNT_STATUSES.ACTIVE);

  const payload = {
    name: data.name.trim(),
    description: data.description ? data.description.trim() : null,
    discountType: data.discountType,
    value: mongoose.Types.Decimal128.fromString(Number(data.value).toFixed(2)),
    scope: data.scope || DISCOUNT_SCOPES.ALL,
    productIds: data.productIds || [],
    variantIds: data.variantIds || [],
    categoryIds: data.categoryIds || [],
    brandIds: data.brandIds || [],
    startsAt,
    endsAt,
    status,
    priority: Number(data.priority) || 0,
    fundingSource: data.fundingSource || FUNDING_SOURCES.PLATFORM,
    allowCoupons: data.allowCoupons !== false,
    createdBy: actor?._id || actor?.id || null,
  };

  if (data.maxDiscountAmount !== null && data.maxDiscountAmount !== undefined && data.maxDiscountAmount !== "") {
    payload.maxDiscountAmount = mongoose.Types.Decimal128.fromString(
      Number(data.maxDiscountAmount).toFixed(2)
    );
  }

  if (data.minSellingPrice !== null && data.minSellingPrice !== undefined && data.minSellingPrice !== "") {
    payload.minSellingPrice = mongoose.Types.Decimal128.fromString(
      Number(data.minSellingPrice).toFixed(2)
    );
  }

  const promotion = await productDiscountRepository.create(payload);

  await recordAuditLog({
    actorId: actor?._id || actor?.id,
    targetId: promotion._id,
    action: "PROMOTION_CREATED",
    entityType: "product_discount",
    afterState: promotion.toObject ? promotion.toObject() : promotion,
    req,
  });

  return promotion;
};

/**
 * List promotions with pagination, search, and filtering.
 *
 * @param {Object} params
 * @param {number} [params.page]
 * @param {number} [params.limit]
 * @param {string} [params.search]
 * @param {string} [params.status]
 * @param {string} [params.discountType]
 * @param {string} [params.scope]
 * @param {string} [params.fundingSource]
 * @returns {Promise<Object>}
 */
const listPromotions = async ({
  page = 1,
  limit = 20,
  search = "",
  status = "",
  discountType = "",
  scope = "",
  fundingSource = "",
} = {}) => {
  const filter = { deletedAt: null };

  if (status && status !== "all") {
    filter.status = status;
  }

  if (discountType && discountType !== "all") {
    filter.discountType = discountType;
  }

  if (scope && scope !== "all") {
    filter.scope = scope;
  }

  if (fundingSource && fundingSource !== "all") {
    filter.fundingSource = fundingSource;
  }

  if (search && search.trim()) {
    const s = search.trim();
    filter.$or = [
      { name: { $regex: s, $options: "i" } },
      { description: { $regex: s, $options: "i" } },
    ];
  }

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [total, items] = await Promise.all([
    ProductDiscount.countDocuments(filter),
    ProductDiscount.find(filter)
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
  ]);

  // Compute active evaluation metadata for expired ones whose status field is stale
  const now = Date.now();
  const serialized = items.map((p) => {
    const end = new Date(p.endsAt).getTime();
    const start = new Date(p.startsAt).getTime();
    let effectiveStatus = p.status;
    if (p.status === DISCOUNT_STATUSES.ACTIVE && now >= end) {
      effectiveStatus = DISCOUNT_STATUSES.EXPIRED;
    } else if (p.status === DISCOUNT_STATUSES.ACTIVE && now < start) {
      effectiveStatus = DISCOUNT_STATUSES.SCHEDULED;
    }

    return {
      ...p,
      effectiveStatus,
      targetCount:
        p.scope === DISCOUNT_SCOPES.ALL
          ? "All Products"
          : (p.productIds?.length || 0) +
            (p.variantIds?.length || 0) +
            (p.categoryIds?.length || 0) +
            (p.brandIds?.length || 0),
    };
  });

  return {
    promotions: serialized,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
};

/**
 * Get promotion details by ID with populated target metadata.
 *
 * @param {string} id
 * @returns {Promise<Object>}
 */
const getPromotionById = async (id) => {
  const promotion = await ProductDiscount.findOne({ _id: id, deletedAt: null })
    .populate("productIds", "name sku price")
    .populate("variantIds", "name sku price productId")
    .populate("categoryIds", "name slug")
    .populate("brandIds", "name slug")
    .populate("createdBy", "firstName lastName email")
    .lean();

  if (!promotion) {
    throw new AppError("Promotion not found", 404, "PROMOTION_NOT_FOUND");
  }

  return promotion;
};

/**
 * Update an existing promotion.
 *
 * @param {Object} params
 * @param {string} params.id
 * @param {Object} params.data
 * @param {Object} params.actor
 * @param {Object} [params.req]
 * @returns {Promise<Object>}
 */
const updatePromotion = async ({ id, data, actor, req = null }) => {
  const promotion = await ProductDiscount.findOne({ _id: id, deletedAt: null });
  if (!promotion) {
    throw new AppError("Promotion not found", 404, "PROMOTION_NOT_FOUND");
  }

  if (promotion.status === DISCOUNT_STATUSES.CANCELLED) {
    throw new AppError("Cancelled promotions cannot be modified", 400, "PROMOTION_CANCELLED");
  }

  const beforeState = promotion.toObject();
  const updates = {};

  if (data.name !== undefined) updates.name = data.name.trim();
  if (data.description !== undefined) updates.description = data.description ? data.description.trim() : null;
  if (data.discountType !== undefined) updates.discountType = data.discountType;

  if (data.value !== undefined) {
    updates.value = mongoose.Types.Decimal128.fromString(Number(data.value).toFixed(2));
  }

  if (data.scope !== undefined) updates.scope = data.scope;
  if (data.productIds !== undefined) updates.productIds = data.productIds;
  if (data.variantIds !== undefined) updates.variantIds = data.variantIds;
  if (data.categoryIds !== undefined) updates.categoryIds = data.categoryIds;
  if (data.brandIds !== undefined) updates.brandIds = data.brandIds;
  if (data.priority !== undefined) updates.priority = Number(data.priority) || 0;
  if (data.fundingSource !== undefined) updates.fundingSource = data.fundingSource;
  if (data.allowCoupons !== undefined) updates.allowCoupons = Boolean(data.allowCoupons);

  const effectiveStartsAt = data.startsAt ? new Date(data.startsAt) : promotion.startsAt;
  const effectiveEndsAt = data.endsAt ? new Date(data.endsAt) : promotion.endsAt;

  if (effectiveEndsAt.getTime() <= effectiveStartsAt.getTime()) {
    throw new AppError("Promotion endsAt must be strictly after startsAt", 400, "INVALID_DATE_RANGE");
  }

  if (data.startsAt !== undefined) updates.startsAt = effectiveStartsAt;
  if (data.endsAt !== undefined) updates.endsAt = effectiveEndsAt;

  if (data.maxDiscountAmount !== undefined) {
    updates.maxDiscountAmount =
      data.maxDiscountAmount !== null && data.maxDiscountAmount !== ""
        ? mongoose.Types.Decimal128.fromString(Number(data.maxDiscountAmount).toFixed(2))
        : null;
  }

  if (data.minSellingPrice !== undefined) {
    updates.minSellingPrice =
      data.minSellingPrice !== null && data.minSellingPrice !== ""
        ? mongoose.Types.Decimal128.fromString(Number(data.minSellingPrice).toFixed(2))
        : null;
  }

  if (data.status !== undefined && data.status !== promotion.status) {
    // Validate status transition
    updates.status = resolveLifecycleStatus(effectiveStartsAt, effectiveEndsAt, data.status);
  }

  const updatedPromotion = await ProductDiscount.findByIdAndUpdate(id, updates, {
    new: true,
    runValidators: true,
  });

  await recordAuditLog({
    actorId: actor?._id || actor?.id,
    targetId: promotion._id,
    action: "PROMOTION_UPDATED",
    entityType: "product_discount",
    beforeState,
    afterState: updatedPromotion.toObject(),
    req,
  });

  return updatedPromotion;
};

/**
 * Execute a valid lifecycle status transition on a promotion.
 *
 * @param {Object} params
 * @param {string} params.id
 * @param {string} params.action - "activate" | "pause" | "resume" | "cancel"
 * @param {string} [params.reason]
 * @param {Object} params.actor
 * @param {Object} [params.req]
 * @returns {Promise<Object>}
 */
const transitionStatus = async ({ id, action, reason = null, actor, req = null }) => {
  const promotion = await ProductDiscount.findOne({ _id: id, deletedAt: null });
  if (!promotion) {
    throw new AppError("Promotion not found", 404, "PROMOTION_NOT_FOUND");
  }

  const currentStatus = promotion.status;
  const beforeState = promotion.toObject();
  const now = Date.now();
  const start = new Date(promotion.startsAt).getTime();
  const end = new Date(promotion.endsAt).getTime();

  let targetStatus;

  switch (action) {
    case "activate":
      if (![DISCOUNT_STATUSES.DRAFT, DISCOUNT_STATUSES.PAUSED, DISCOUNT_STATUSES.SCHEDULED].includes(currentStatus)) {
        throw new AppError(
          `Cannot activate promotion from current status '${currentStatus}'`,
          400,
          "INVALID_STATUS_TRANSITION"
        );
      }
      if (now >= end) {
        throw new AppError("Promotion window has already ended and cannot be activated", 400, "PROMOTION_WINDOW_EXPIRED");
      }
      targetStatus = now < start ? DISCOUNT_STATUSES.SCHEDULED : DISCOUNT_STATUSES.ACTIVE;
      break;

    case "pause":
      if (![DISCOUNT_STATUSES.ACTIVE, DISCOUNT_STATUSES.SCHEDULED].includes(currentStatus)) {
        throw new AppError(
          `Cannot pause promotion from current status '${currentStatus}'`,
          400,
          "INVALID_STATUS_TRANSITION"
        );
      }
      targetStatus = DISCOUNT_STATUSES.PAUSED;
      break;

    case "resume":
      if (currentStatus !== DISCOUNT_STATUSES.PAUSED) {
        throw new AppError("Only paused promotions can be resumed", 400, "INVALID_STATUS_TRANSITION");
      }
      if (now >= end) {
        throw new AppError("Promotion window has expired and cannot be resumed", 400, "PROMOTION_WINDOW_EXPIRED");
      }
      targetStatus = now < start ? DISCOUNT_STATUSES.SCHEDULED : DISCOUNT_STATUSES.ACTIVE;
      break;

    case "cancel":
      if (currentStatus === DISCOUNT_STATUSES.CANCELLED) {
        throw new AppError("Promotion is already cancelled", 400, "ALREADY_CANCELLED");
      }
      targetStatus = DISCOUNT_STATUSES.CANCELLED;
      break;

    default:
      throw new AppError(`Unsupported lifecycle action: ${action}`, 400, "UNSUPPORTED_ACTION");
  }

  promotion.status = targetStatus;
  await promotion.save();

  await recordAuditLog({
    actorId: actor?._id || actor?.id,
    targetId: promotion._id,
    action: `PROMOTION_${action.toUpperCase()}`,
    entityType: "product_discount",
    beforeState,
    afterState: { ...promotion.toObject(), transitionReason: reason },
    req,
  });

  return promotion;
};

/**
 * Soft delete a promotion.
 *
 * @param {Object} params
 * @param {string} params.id
 * @param {Object} params.actor
 * @param {Object} [params.req]
 * @returns {Promise<Object>}
 */
const deletePromotion = async ({ id, actor, req = null }) => {
  const promotion = await ProductDiscount.findOne({ _id: id, deletedAt: null });
  if (!promotion) {
    throw new AppError("Promotion not found", 404, "PROMOTION_NOT_FOUND");
  }

  const beforeState = promotion.toObject();
  const deleted = await productDiscountRepository.deleteById(id);

  await recordAuditLog({
    actorId: actor?._id || actor?.id,
    targetId: id,
    action: "PROMOTION_DELETED",
    entityType: "product_discount",
    beforeState,
    afterState: { deletedAt: new Date(), status: DISCOUNT_STATUSES.CANCELLED },
    req,
  });

  return deleted;
};

/**
 * Bulk assign or remove target identifiers from a promotion.
 *
 * @param {Object} params
 * @param {string} params.id
 * @param {string} params.action - "add" | "remove" | "set"
 * @param {Array<string>} [params.productIds]
 * @param {Array<string>} [params.variantIds]
 * @param {Array<string>} [params.categoryIds]
 * @param {Array<string>} [params.brandIds]
 * @param {Object} params.actor
 * @param {Object} [params.req]
 * @returns {Promise<Object>}
 */
const assignTargets = async ({
  id,
  action = "add",
  productIds = [],
  variantIds = [],
  categoryIds = [],
  brandIds = [],
  actor,
  req = null,
}) => {
  const promotion = await ProductDiscount.findOne({ _id: id, deletedAt: null });
  if (!promotion) {
    throw new AppError("Promotion not found", 404, "PROMOTION_NOT_FOUND");
  }

  const beforeState = promotion.toObject();

  const mergeIds = (existing, incoming) => {
    const set = new Set(existing.map((x) => x.toString()));
    if (action === "set") {
      return incoming.map((x) => new mongoose.Types.ObjectId(x));
    }
    if (action === "add") {
      incoming.forEach((x) => set.add(x.toString()));
      return Array.from(set).map((x) => new mongoose.Types.ObjectId(x));
    }
    if (action === "remove") {
      incoming.forEach((x) => set.delete(x.toString()));
      return Array.from(set).map((x) => new mongoose.Types.ObjectId(x));
    }
    return existing;
  };

  if (productIds.length > 0 || action === "set") {
    promotion.productIds = mergeIds(promotion.productIds || [], productIds);
  }
  if (variantIds.length > 0 || action === "set") {
    promotion.variantIds = mergeIds(promotion.variantIds || [], variantIds);
  }
  if (categoryIds.length > 0 || action === "set") {
    promotion.categoryIds = mergeIds(promotion.categoryIds || [], categoryIds);
  }
  if (brandIds.length > 0 || action === "set") {
    promotion.brandIds = mergeIds(promotion.brandIds || [], brandIds);
  }

  await promotion.save();

  await recordAuditLog({
    actorId: actor?._id || actor?.id,
    targetId: promotion._id,
    action: "PROMOTION_TARGETS_UPDATED",
    entityType: "product_discount",
    beforeState,
    afterState: promotion.toObject(),
    req,
  });

  return promotion;
};

/**
 * Preview proposed promotional pricing against selected or sample products without mutating database records.
 *
 * @param {Object} params
 * @param {string} [params.promotionId]
 * @param {Object} [params.promotionData]
 * @param {Array<string>} [params.productIds]
 * @param {Array<string>} [params.variantIds]
 * @param {number} [params.limit]
 * @param {boolean} [params.overrideFloor]
 * @param {string} [params.overrideReason]
 * @param {Object} params.actor
 * @param {Object} [params.req]
 * @returns {Promise<Object>}
 */
const previewPromotion = async ({
  promotionId = null,
  promotionData = null,
  productIds = [],
  variantIds = [],
  limit = 10,
  overrideFloor = false,
  overrideReason = null,
  actor = null,
  req = null,
}) => {
  let promo = null;

  if (promotionId) {
    promo = await ProductDiscount.findOne({ _id: promotionId, deletedAt: null }).lean();
    if (!promo) {
      throw new AppError("Promotion not found for preview", 404, "PROMOTION_NOT_FOUND");
    }
  } else if (promotionData) {
    promo = {
      _id: new mongoose.Types.ObjectId(),
      name: promotionData.name || "Preview Promotion",
      discountType: promotionData.discountType,
      value: promotionData.value,
      scope: promotionData.scope || DISCOUNT_SCOPES.ALL,
      productIds: promotionData.productIds || [],
      variantIds: promotionData.variantIds || [],
      categoryIds: promotionData.categoryIds || [],
      brandIds: promotionData.brandIds || [],
      startsAt: promotionData.startsAt || new Date(Date.now() - 60000),
      endsAt: promotionData.endsAt || new Date(Date.now() + 86400000 * 30),
      status: DISCOUNT_STATUSES.ACTIVE,
      priority: Number(promotionData.priority) || 0,
      maxDiscountAmount: promotionData.maxDiscountAmount || null,
      minSellingPrice: promotionData.minSellingPrice || null,
      fundingSource: promotionData.fundingSource || FUNDING_SOURCES.PLATFORM,
      allowCoupons: promotionData.allowCoupons !== false,
    };
  } else {
    throw new AppError("Either promotionId or promotionData must be supplied", 400, "MISSING_PREVIEW_INPUT");
  }

  // Gather target variants and products
  const previewCandidates = [];
  const boundedLimit = Math.min(50, Math.max(1, Number(limit) || 10));

  if (variantIds.length > 0) {
    const variants = await ProductVariant.find({
      _id: { $in: variantIds.slice(0, boundedLimit) },
      deletedAt: null,
    })
      .populate("productId")
      .lean();

    for (const v of variants) {
      if (v.productId && !v.productId.deletedAt) {
        previewCandidates.push({ product: v.productId, variant: v });
      }
    }
  } else if (productIds.length > 0) {
    const products = await Product.find({
      _id: { $in: productIds.slice(0, boundedLimit) },
      deletedAt: null,
    }).lean();

    for (const p of products) {
      const v = await ProductVariant.findOne({
        productId: p._id,
        isDefault: true,
        deletedAt: null,
      }).lean();
      previewCandidates.push({ product: p, variant: v });
    }
  } else if (promo.scope === DISCOUNT_SCOPES.CATEGORIES && promo.categoryIds?.length > 0) {
    const products = await Product.find({
      categoryId: { $in: promo.categoryIds },
      deletedAt: null,
    })
      .limit(boundedLimit)
      .lean();

    for (const p of products) {
      const v = await ProductVariant.findOne({
        productId: p._id,
        isDefault: true,
        deletedAt: null,
      }).lean();
      previewCandidates.push({ product: p, variant: v });
    }
  } else if (promo.scope === DISCOUNT_SCOPES.BRANDS && promo.brandIds?.length > 0) {
    const products = await Product.find({
      brandId: { $in: promo.brandIds },
      deletedAt: null,
    })
      .limit(boundedLimit)
      .lean();

    for (const p of products) {
      const v = await ProductVariant.findOne({
        productId: p._id,
        isDefault: true,
        deletedAt: null,
      }).lean();
      previewCandidates.push({ product: p, variant: v });
    }
  } else if (promo.scope === DISCOUNT_SCOPES.PRODUCTS && promo.productIds?.length > 0) {
    const products = await Product.find({
      _id: { $in: promo.productIds.slice(0, boundedLimit) },
      deletedAt: null,
    }).lean();

    for (const p of products) {
      const v = await ProductVariant.findOne({
        productId: p._id,
        isDefault: true,
        deletedAt: null,
      }).lean();
      previewCandidates.push({ product: p, variant: v });
    }
  } else {
    // Default: sample active products
    const products = await Product.find({ deletedAt: null })
      .limit(boundedLimit)
      .lean();

    for (const p of products) {
      const v = await ProductVariant.findOne({
        productId: p._id,
        isDefault: true,
        deletedAt: null,
      }).lean();
      previewCandidates.push({ product: p, variant: v });
    }
  }

  // Authoritative evaluation time
  const evalDate = new Date();
  const previewItems = [];
  let floorViolationsCount = 0;
  let overriddenCount = 0;
  let eligibleCount = 0;

  for (const { product, variant } of previewCandidates) {
    const pricing = await pricingEngineService.calculateEffectivePrice({
      product,
      variant,
      asOfDate: evalDate,
      activePromotions: [promo],
      actor,
      overrideFloor,
    });

    const isFloorViolation = pricing.floorPriceCheck?.passed === false;
    const wasOverridden = pricing.floorPriceCheck?.wasOverridden === true;

    if (isFloorViolation) {
      floorViolationsCount++;
    }
    if (wasOverridden) {
      overriddenCount++;
    }
    if (pricing.isPromotional) {
      eligibleCount++;
    }

    previewItems.push({
      productId: product._id.toString(),
      variantId: variant?._id?.toString() || null,
      productName: product.name,
      variantName: variant?.name || "Default",
      sku: variant?.sku || product.sku,
      regularPrice: pricing.regularPrice,
      compareAtPrice: pricing.compareAtPrice,
      promotionalDiscountAmount: pricing.promotionalDiscountAmount,
      effectivePrice: pricing.effectivePrice,
      discountPercentage: pricing.discountPercentage,
      mrpDiscountPercentage: pricing.mrpDiscountPercentage,
      isPromotional: pricing.isPromotional,
      fundingSource: pricing.fundingSource,
      allowCoupons: pricing.allowCoupons,
      floorPriceCheck: pricing.floorPriceCheck,
      overrideReason: wasOverridden ? overrideReason : null,
      warnings: isFloorViolation
        ? [`Selling price violates configured floor of ₹${pricing.floorPriceCheck.floorPrice}`]
        : [],
    });
  }

  // If override was granted during preview, write an explicit audit log with reason
  if (overriddenCount > 0 && actor) {
    await recordAuditLog({
      actorId: actor._id || actor.id,
      targetId: promo._id,
      action: "PROMOTION_PREVIEW_FLOOR_OVERRIDE",
      entityType: "product_discount",
      afterState: {
        reason: overrideReason,
        overriddenCount,
        promotionName: promo.name,
      },
      req,
    });
  }

  return {
    summary: {
      totalTested: previewItems.length,
      eligibleCount,
      floorViolationsCount,
      overriddenCount,
      evaluationTime: evalDate,
    },
    items: previewItems,
    promotion: {
      id: promo._id?.toString(),
      name: promo.name,
      discountType: promo.discountType,
      value: String(promo.value),
      scope: promo.scope,
      fundingSource: promo.fundingSource,
      allowCoupons: promo.allowCoupons,
      minSellingPrice: promo.minSellingPrice ? String(promo.minSellingPrice) : null,
      maxDiscountAmount: promo.maxDiscountAmount ? String(promo.maxDiscountAmount) : null,
    },
  };
};

module.exports = {
  createPromotion,
  listPromotions,
  getPromotionById,
  updatePromotion,
  transitionStatus,
  deletePromotion,
  assignTargets,
  previewPromotion,
  resolveLifecycleStatus,
};
