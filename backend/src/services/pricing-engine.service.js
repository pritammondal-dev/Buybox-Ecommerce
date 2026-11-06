const mongoose = require("mongoose");
const productDiscountRepository = require("../repositories/product-discount.repository");
const productRepository = require("../repositories/product.repository");
const productVariantRepository = require("../repositories/product-variant.repository");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const { recordAuditLog } = require("./governance.service");
const AppError = require("../errors/AppError");
const {
  DISCOUNT_TYPES,
  DISCOUNT_STATUSES,
  DISCOUNT_SCOPES,
  FUNDING_SOURCES,
} = require("../constants/promotion.constants");

const MINOR_UNIT_SCALE = 100;

/**
 * Convert a decimal number, string, or Decimal128 into integer minor units (scale 100).
 *
 * Example:
 * "1299.00" -> 129900
 * 20 -> 2000
 *
 * @param {number|string|mongoose.Types.Decimal128} value
 * @returns {number}
 */
const decimalToMinorUnits = (value) => {
  if (value === null || value === undefined) {
    throw new AppError("Monetary value cannot be null or undefined", 400, "INVALID_MONEY_VALUE");
  }

  const decimalString =
    typeof value?.toString === "function" ? value.toString().trim() : String(value).trim();

  if (!/^-?\d+(\.\d+)?$/.test(decimalString)) {
    throw new AppError(
      `Invalid monetary format: "${decimalString}"`,
      400,
      "INVALID_MONEY_VALUE"
    );
  }

  const sign = decimalString.startsWith("-") ? -1 : 1;
  const unsigned = decimalString.replace("-", "");
  const [wholePart = "0", fractionalPart = ""] = unsigned.split(".");
  const normalizedFraction = fractionalPart.padEnd(2, "0").slice(0, 2);

  const wholeMinor = Number(wholePart) * MINOR_UNIT_SCALE;
  const fracMinor = Number(normalizedFraction);
  const minorUnits = wholeMinor + fracMinor;

  if (!Number.isSafeInteger(minorUnits)) {
    throw new AppError("Monetary value is too large", 400, "MONEY_VALUE_TOO_LARGE");
  }

  return sign * minorUnits;
};

/**
 * Convert integer minor units into a canonical decimal string (scale 100).
 *
 * Example:
 * 129900 -> "1299.00"
 * 0 -> "0.00"
 *
 * @param {number} minorUnits
 * @returns {string}
 */
const minorUnitsToDecimalString = (minorUnits) => {
  if (!Number.isSafeInteger(minorUnits)) {
    throw new AppError("Invalid minor unit amount", 500, "INVALID_MINOR_UNIT_AMOUNT");
  }

  const sign = minorUnits < 0 ? "-" : "";
  const abs = Math.abs(minorUnits);
  const wholePart = Math.floor(abs / MINOR_UNIT_SCALE);
  const fractionalPart = String(abs % MINOR_UNIT_SCALE).padStart(2, "0");

  return `${sign}${wholePart}.${fractionalPart}`;
};

/**
 * Check if the actor possesses Superadmin authority or the promotions:override_floor permission.
 *
 * @param {Object} actor
 * @returns {boolean}
 */
const isActorAuthorizedForFloorOverride = (actor) => {
  if (!actor) return false;
  const roleStr = String(actor.role || "").toLowerCase().replace(/[-_]/g, "");
  if (roleStr === "superadmin") return true;
  if (
    Array.isArray(actor.roles) &&
    actor.roles.some((r) => String(r).toLowerCase().replace(/[-_]/g, "") === "superadmin")
  ) {
    return true;
  }
  if (actor.isSuperAdmin === true) return true;
  const perms = [
    ...(Array.isArray(actor.permissions) ? actor.permissions : []),
    ...(Array.isArray(actor.effectivePermissions) ? actor.effectivePermissions : []),
  ];
  if (
    perms.includes("promotions:override_floor") ||
    perms.includes("promotions.override_floor") ||
    perms.includes("*")
  ) {
    return true;
  }
  return false;
};

/**
 * Evaluate if a promotion is scope- and time-eligible for a given product and variant.
 *
 * Authority rule: startsAt <= evaluationTime < endsAt. Expired or scheduled in the future must not apply.
 *
 * @param {Object} params
 * @param {Object} params.promotion
 * @param {Object} params.product
 * @param {Object} [params.variant]
 * @param {Date} params.asOfDate
 * @returns {boolean}
 */
const isPromotionEligible = ({ promotion, product, variant, asOfDate }) => {
  if (!promotion) return false;

  // Lifecycle status check
  if (promotion.status !== DISCOUNT_STATUSES.ACTIVE) {
    return false;
  }

  // Authoritative time check: startsAt <= asOfDate < endsAt
  const startsAt = new Date(promotion.startsAt).getTime();
  const endsAt = new Date(promotion.endsAt).getTime();
  const evalTime = asOfDate.getTime();

  if (evalTime < startsAt || evalTime >= endsAt) {
    return false;
  }

  // Soft delete check
  if (promotion.deletedAt) {
    return false;
  }

  // Scope check
  const scope = promotion.scope || DISCOUNT_SCOPES.ALL;
  if (scope === DISCOUNT_SCOPES.ALL) {
    return true;
  }

  const pId = product?._id?.toString() || product?.id?.toString();
  const vId = variant?._id?.toString() || variant?.id?.toString();
  const catId = product?.categoryId?.toString();
  const brandId = product?.brandId?.toString();

  if (scope === DISCOUNT_SCOPES.PRODUCTS) {
    const pList = (promotion.productIds || []).map((id) => id?.toString());
    return pList.includes(pId);
  }

  if (scope === DISCOUNT_SCOPES.VARIANTS) {
    if (!vId) return false;
    const vList = (promotion.variantIds || []).map((id) => id?.toString());
    return vList.includes(vId);
  }

  if (scope === DISCOUNT_SCOPES.CATEGORIES) {
    if (!catId) return false;
    const cList = (promotion.categoryIds || []).map((id) => id?.toString());
    return cList.includes(catId);
  }

  if (scope === DISCOUNT_SCOPES.BRANDS) {
    if (!brandId) return false;
    const bList = (promotion.brandIds || []).map((id) => id?.toString());
    return bList.includes(brandId);
  }

  return false;
};

/**
 * Calculate the discount amount in minor units for a specific promotion against a regular price.
 * Respects maximum discount amount cap.
 *
 * @param {Object} params
 * @param {Object} params.promotion
 * @param {number} params.regularPriceMinor
 * @returns {{ discountMinor: number, effectivePriceMinor: number }}
 */
const calculatePromotionDiscount = ({ promotion, regularPriceMinor }) => {
  if (regularPriceMinor <= 0) {
    return { discountMinor: 0, effectivePriceMinor: regularPriceMinor };
  }

  let discountMinor = 0;
  const discountType = promotion.discountType;

  if (discountType === DISCOUNT_TYPES.PERCENTAGE) {
    const rawVal =
      typeof promotion.value?.toString === "function"
        ? promotion.value.toString()
        : String(promotion.value);
    const pct = Number(rawVal);
    if (isNaN(pct) || pct <= 0) {
      throw new AppError("Invalid percentage discount value", 400, "INVALID_DISCOUNT_VALUE");
    }
    // Round to nearest minor unit (cents/paise)
    discountMinor = Math.round((regularPriceMinor * pct) / 100);
  } else if (discountType === DISCOUNT_TYPES.FIXED_AMOUNT) {
    discountMinor = decimalToMinorUnits(promotion.value);
    if (discountMinor <= 0) {
      throw new AppError("Invalid fixed discount value", 400, "INVALID_DISCOUNT_VALUE");
    }
  } else {
    throw new AppError(`Unsupported discount type: ${discountType}`, 400, "UNSUPPORTED_DISCOUNT_TYPE");
  }

  // Maximum discount cap
  if (promotion.maxDiscountAmount !== null && promotion.maxDiscountAmount !== undefined) {
    const maxDiscountMinor = decimalToMinorUnits(promotion.maxDiscountAmount);
    if (maxDiscountMinor < 0) {
      throw new AppError("Negative maximum discount cap is not allowed", 400, "INVALID_DISCOUNT_VALUE");
    }
    discountMinor = Math.min(discountMinor, maxDiscountMinor);
  }

  // Cap at regular price (effective price cannot be negative)
  discountMinor = Math.min(discountMinor, regularPriceMinor);
  const effectivePriceMinor = regularPriceMinor - discountMinor;

  return { discountMinor, effectivePriceMinor };
};

/**
 * Check price floor protection and handle permission-controlled audited override.
 *
 * @param {Object} params
 * @param {Object} params.promotion
 * @param {number} params.effectivePriceMinor
 * @param {Object} [params.actor]
 * @param {boolean} [params.overrideFloor]
 * @returns {Promise<{ passed: boolean, floorPrice: string|null, wasOverridden: boolean, error?: string }>}
 */
const checkPriceFloor = async ({
  promotion,
  effectivePriceMinor,
  actor = null,
  overrideFloor = false,
}) => {
  if (
    promotion.minSellingPrice === null ||
    promotion.minSellingPrice === undefined
  ) {
    return { passed: true, floorPrice: null, wasOverridden: false };
  }

  const floorMinor = decimalToMinorUnits(promotion.minSellingPrice);
  const floorString = minorUnitsToDecimalString(floorMinor);

  if (effectivePriceMinor >= floorMinor) {
    return { passed: true, floorPrice: floorString, wasOverridden: false };
  }

  // Floor is violated: effectivePrice < minSellingPrice
  if (overrideFloor === true) {
    if (!isActorAuthorizedForFloorOverride(actor)) {
      return {
        passed: false,
        floorPrice: floorString,
        wasOverridden: false,
        error: "UNAUTHORIZED_FLOOR_OVERRIDE",
      };
    }

    // Authorized override: Record audit log
    if (actor && (actor.id || actor._id)) {
      await recordAuditLog({
        actorId: actor._id || actor.id,
        targetId: promotion._id || null,
        action: "PROMOTION_PRICE_FLOOR_OVERRIDE",
        entityType: "product_discount",
        beforeState: {
          minSellingPrice: floorString,
          effectivePrice: minorUnitsToDecimalString(effectivePriceMinor),
        },
        afterState: {
          overrideGranted: true,
          overriddenBy: actor.email || actor.id || actor._id,
        },
      });
    }

    return { passed: true, floorPrice: floorString, wasOverridden: true };
  }

  // Rejection without override
  return {
    passed: false,
    floorPrice: floorString,
    wasOverridden: false,
    error: "FLOOR_PRICE_VIOLATION",
  };
};

/**
 * Select the single best promotion among eligible candidates using deterministic priority rules:
 * 1. Higher priority first.
 * 2. If tied: Higher monetary customer savings (discountMinor).
 * 3. If tied: Earlier startsAt timestamp.
 * 4. If tied: Ascending string comparison of promotion ID.
 *
 * @param {Object} params
 * @param {Array} params.promotions
 * @param {number} params.regularPriceMinor
 * @param {Object} params.product
 * @param {Object} [params.variant]
 * @param {Date} params.asOfDate
 * @param {Object} [params.actor]
 * @param {boolean} [params.overrideFloor]
 * @returns {Promise<Object>}
 */
const resolveBestPromotion = async ({
  promotions,
  regularPriceMinor,
  product,
  variant,
  asOfDate,
  actor,
  overrideFloor,
}) => {
  const candidates = [];
  let firstFloorViolation = null;

  for (const promotion of promotions) {
    if (!isPromotionEligible({ promotion, product, variant, asOfDate })) {
      continue;
    }

    const { discountMinor, effectivePriceMinor } = calculatePromotionDiscount({
      promotion,
      regularPriceMinor,
    });

    if (discountMinor <= 0) {
      continue;
    }

    const floorResult = await checkPriceFloor({
      promotion,
      effectivePriceMinor,
      actor,
      overrideFloor,
    });

    if (!floorResult.passed) {
      if (!firstFloorViolation) {
        firstFloorViolation = {
          promotion,
          discountMinor,
          effectivePriceMinor,
          floorResult,
        };
      }
      continue; // Disqualified by price floor protection
    }

    candidates.push({
      promotion,
      discountMinor,
      effectivePriceMinor,
      floorResult,
      priority: Number(promotion.priority) || 0,
      startsAt: new Date(promotion.startsAt).getTime(),
      id: promotion._id ? promotion._id.toString() : String(candidates.length),
    });
  }

  if (candidates.length === 0) {
    return { winning: null, floorViolation: firstFloorViolation };
  }

  // Deterministic conflict resolution
  candidates.sort((a, b) => {
    // 1. Highest priority
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    // 2. Highest customer monetary savings
    if (b.discountMinor !== a.discountMinor) {
      return b.discountMinor - a.discountMinor;
    }
    // 3. Earlier startsAt
    if (a.startsAt !== b.startsAt) {
      return a.startsAt - b.startsAt;
    }
    // 4. Stable tie-breaker: ID
    return a.id.localeCompare(b.id);
  });

  return { winning: candidates[0], floorViolation: firstFloorViolation };
};

/**
 * Calculate the effective promotional pricing for a product or variant.
 *
 * INVARIANT: Never rewrites Product.price or ProductVariant.price.
 * INVARIANT: MRP (compareAtPrice) is never artificially inflated or invented.
 *
 * @param {Object} params
 * @param {Object} params.product Product document or plain object
 * @param {Object} [params.variant] ProductVariant document or plain object
 * @param {Date} [params.asOfDate] Authoritative evaluation time (defaults to now)
 * @param {Array} [params.activePromotions] In-memory active promotions (optional, queries DB if omitted)
 * @param {Object} [params.actor] User performing the request
 * @param {boolean} [params.overrideFloor] Request price floor override
 * @returns {Promise<Object>} Normalized pricing result
 */
const calculateEffectivePrice = async ({
  product,
  variant = null,
  asOfDate = new Date(),
  activePromotions = null,
  actor = null,
  overrideFloor = false,
}) => {
  if (!product) {
    throw new AppError("Product is required for pricing evaluation", 400, "PRODUCT_REQUIRED");
  }

  // 1. Authoritative regular selling price
  const rawRegularPrice = variant?.price ?? product?.price;
  if (rawRegularPrice === null || rawRegularPrice === undefined) {
    throw new AppError("Authoritative regular selling price is missing", 400, "PRICE_MISSING");
  }
  const regularPriceMinor = decimalToMinorUnits(rawRegularPrice);
  if (regularPriceMinor < 0) {
    throw new AppError("Regular selling price cannot be negative", 400, "NEGATIVE_PRICE");
  }
  const regularPriceString = minorUnitsToDecimalString(regularPriceMinor);

  // 2. Reference / MRP Price (Preserve existing meaning; NEVER invent missing MRP)
  const rawCompareAtPrice = variant?.compareAtPrice ?? product?.compareAtPrice;
  let compareAtPriceMinor = null;
  let compareAtPriceString = null;

  if (rawCompareAtPrice !== null && rawCompareAtPrice !== undefined) {
    const parsedCapMinor = decimalToMinorUnits(rawCompareAtPrice);
    // Only accept valid reference prices where compareAtPrice >= regularPrice
    if (parsedCapMinor >= regularPriceMinor) {
      compareAtPriceMinor = parsedCapMinor;
      compareAtPriceString = minorUnitsToDecimalString(compareAtPriceMinor);
    }
  }

  // 3. Resolve active promotions if not passed in-memory
  let promotionsToEvaluate = activePromotions;
  if (!Array.isArray(promotionsToEvaluate)) {
    const pId = product._id || product.id;
    const vId = variant?._id || variant?.id;
    const catId = product.categoryId;
    const brandId = product.brandId;

    promotionsToEvaluate = await productDiscountRepository.findEligibleDiscounts({
      asOfDate,
      productId: pId,
      variantId: vId,
      categoryId: catId,
      brandId: brandId,
    });
  }

  // 4. Resolve single winning promotion
  const matchResult = await resolveBestPromotion({
    promotions: promotionsToEvaluate || [],
    regularPriceMinor,
    product,
    variant,
    asOfDate,
    actor,
    overrideFloor,
  });

  const winningMatch = matchResult?.winning || null;
  const floorViolation = matchResult?.floorViolation || null;

  const currency = variant?.currency || product?.currency || "INR";
  const sku = variant?.sku || product?.sku || "";
  const productIdStr = (product._id || product.id || "").toString();
  const variantIdStr = (variant?._id || variant?.id || "").toString();

  // 5. Build normalized response
  if (!winningMatch) {
    // No promotional discount applies: regular selling price is effective price
    let totalDiscountAmountMinor = 0;
    let mrpDiscountPercentage = null;

    if (compareAtPriceMinor !== null && compareAtPriceMinor > regularPriceMinor) {
      totalDiscountAmountMinor = compareAtPriceMinor - regularPriceMinor;
      mrpDiscountPercentage = Math.round(
        (totalDiscountAmountMinor / compareAtPriceMinor) * 100
      );
    }

    return {
      productId: productIdStr,
      variantId: variantIdStr,
      sku,
      currency,
      regularPrice: regularPriceString,
      compareAtPrice: compareAtPriceString,
      effectivePrice: regularPriceString,
      promotionalDiscountAmount: "0.00",
      discountAmount: minorUnitsToDecimalString(totalDiscountAmountMinor),
      discountPercentage: 0,
      mrpDiscountPercentage,
      isPromotional: false,
      promotion: null,
      fundingSource: null,
      allowCoupons: true,
      floorPriceCheck: floorViolation
        ? {
            passed: false,
            floorPrice: floorViolation.floorResult.floorPrice,
            wasOverridden: false,
            error: floorViolation.floorResult.error,
          }
        : {
            passed: true,
            floorPrice: null,
            wasOverridden: false,
          },
      evaluationTime: asOfDate,
    };
  }

  // Promotional discount applies
  const { promotion, discountMinor, effectivePriceMinor, floorResult } = winningMatch;
  const effectivePriceString = minorUnitsToDecimalString(effectivePriceMinor);
  const promotionalDiscountString = minorUnitsToDecimalString(discountMinor);

  // Total discount against compareAtPrice if available, otherwise promotional discount
  let totalDiscountAmountMinor = discountMinor;
  let mrpDiscountPercentage = null;

  if (compareAtPriceMinor !== null && compareAtPriceMinor > effectivePriceMinor) {
    totalDiscountAmountMinor = compareAtPriceMinor - effectivePriceMinor;
    mrpDiscountPercentage = Math.round(
      (totalDiscountAmountMinor / compareAtPriceMinor) * 100
    );
  }

  const promoDiscountPercentage =
    regularPriceMinor > 0
      ? Math.round((discountMinor / regularPriceMinor) * 100)
      : 0;

  const promoValueString =
    typeof promotion.value?.toString === "function"
      ? promotion.value.toString()
      : String(promotion.value);

  return {
    productId: productIdStr,
    variantId: variantIdStr,
    sku,
    currency,
    regularPrice: regularPriceString,
    compareAtPrice: compareAtPriceString,
    effectivePrice: effectivePriceString,
    promotionalDiscountAmount: promotionalDiscountString,
    discountAmount: minorUnitsToDecimalString(totalDiscountAmountMinor),
    discountPercentage: promoDiscountPercentage,
    mrpDiscountPercentage,
    isPromotional: true,
    promotion: {
      id: (promotion._id || promotion.id || "").toString(),
      name: promotion.name,
      discountType: promotion.discountType,
      value: promoValueString,
      fundingSource: promotion.fundingSource || FUNDING_SOURCES.PLATFORM,
      allowCoupons: promotion.allowCoupons !== false,
      priority: Number(promotion.priority) || 0,
    },
    fundingSource: promotion.fundingSource || FUNDING_SOURCES.PLATFORM,
    allowCoupons: promotion.allowCoupons !== false,
    floorPriceCheck: {
      passed: floorResult.passed,
      floorPrice: floorResult.floorPrice,
      wasOverridden: floorResult.wasOverridden,
    },
    evaluationTime: asOfDate,
  };
};

/**
 * Resolve promotional pricing for an existing product or variant in the database.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} [params.productId]
 * @param {string|mongoose.Types.ObjectId} [params.variantId]
 * @param {Date} [params.asOfDate]
 * @param {Object} [params.actor]
 * @param {boolean} [params.overrideFloor]
 * @returns {Promise<Object>}
 */
const resolveProductPricing = async ({
  productId = null,
  variantId = null,
  asOfDate = new Date(),
  actor = null,
  overrideFloor = false,
}) => {
  let product = null;
  let variant = null;

  if (variantId) {
    variant = await productVariantRepository.findById(variantId);
    if (!variant || variant.deletedAt) {
      throw new AppError("Product variant not found", 404, "VARIANT_NOT_FOUND");
    }
    product = await productRepository.findById(variant.productId);
    if (!product || product.deletedAt) {
      throw new AppError("Parent product not found", 404, "PRODUCT_NOT_FOUND");
    }
  } else if (productId) {
    product = await productRepository.findById(productId);
    if (!product || product.deletedAt) {
      throw new AppError("Product not found", 404, "PRODUCT_NOT_FOUND");
    }

    if (product.productType === "simple") {
      variant = await ProductVariant.findOne({
        productId: product._id,
        isDefault: true,
        deletedAt: null,
      });
      if (!variant) {
        variant = await ProductVariant.findOne({
          productId: product._id,
          deletedAt: null,
        });
      }
    } else {
      // Variable product: use default variant if set, else minimum price active variant
      if (product.defaultVariantId) {
        variant = await ProductVariant.findOne({
          _id: product.defaultVariantId,
          isActive: true,
          deletedAt: null,
        });
      }
      if (!variant) {
        const variants = await productVariantRepository.findByProductId(product._id);
        const purchasable = (variants || []).filter((v) => v.isActive && !v.deletedAt);
        if (purchasable.length > 0) {
          purchasable.sort((a, b) => {
            const pA = Number(a.price.toString());
            const pB = Number(b.price.toString());
            return pA - pB;
          });
          variant = purchasable[0];
        }
      }
    }
  } else {
    throw new AppError("Either productId or variantId must be provided", 400, "MISSING_IDENTIFIER");
  }

  return calculateEffectivePrice({
    product,
    variant,
    asOfDate,
    actor,
    overrideFloor,
  });
};

module.exports = {
  decimalToMinorUnits,
  minorUnitsToDecimalString,
  isPromotionEligible,
  calculatePromotionDiscount,
  checkPriceFloor,
  isActorAuthorizedForFloorOverride,
  resolveBestPromotion,
  calculateEffectivePrice,
  resolveProductPricing,
};
